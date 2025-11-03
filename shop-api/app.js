// app.js (Đã cập nhật thêm trường Ghi chú)

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const moment = require("moment"); 
const jwt = require("jsonwebtoken"); 

const app = express(); 
app.use(cors());
app.use(express.json());

const MONGO_URI = "mongodb://127.0.0.1:27017/shopdb"; 
const JWT_SECRET = "MY_SUPER_SECRET_KEY_123456"; 

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => console.log("Connected to MongoDB"));

const isoNow = () => moment().toISOString();
const docToJson = (doc) => {
  if (!doc) return null;
  const json = doc.toObject ? doc.toObject() : doc;
  delete json.__v;
  delete json._id; 
  return json;
};

// ----------------- SCHEMAS & MODELS -----------------

// User (Đã có isBlocked)
const userSchema = new mongoose.Schema({
  id: Number,
  name: String,
  email: String,
  password: String,
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  isBlocked: { type: Boolean, default: false }, 
  created_at: { type: Date, default: Date.now },
});
const User = mongoose.model("User", userSchema);

// Product
const productSchema = new mongoose.Schema({
  id: Number,
  name: String,
  brand: String, 
  category: String,
  price: Number,
  discount: { type: Number, default: 0 },
  description: String,
  sizes: [String],
  image_url: String, 
  created_at: { type: Date, default: Date.now },
});
const Product = mongoose.model("Product", productSchema);

// Order Item
const orderItemSchema = new mongoose.Schema({
  product_id: Number,
  name: String,
  size: String,
  price: Number,
  quantity: Number,
});

// 🚀 CẬP NHẬT: Thêm trường 'notes' vào Order
const orderSchema = new mongoose.Schema({
  id: Number,
  order_code: String,
  user_id: Number,
  customer_name: String, // Tên người nhận
  customer_email: String,
  shipping_address: String,
  phone_number: String,
  payment_method: String,
  notes: { type: String, default: '' }, // 👈 THÊM TRƯỜNG GHI CHÚ
  total_amount: Number,
  items: [orderItemSchema],
  status: { type: String, enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"], default: "Pending" },
  created_at: { type: Date, default: Date.now },
});
const Order = mongoose.model("Order", orderSchema);


// ----------------- MIDDLEWARE XÁC THỰC -----------------
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; 
  if (!token) {
    return res.status(401).json({ message: 'Không tìm thấy token.' });
  }
  jwt.verify(token, JWT_SECRET, (err, userPayload) => {
    if (err) {
      return res.status(403).json({ message: 'Token không hợp lệ.' });
    }
    req.user = userPayload; 
    next();
  });
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Yêu cầu quyền Admin.' });
  }
};

// ----------------- APIs -----------------

// --- AUTH APIs ---
app.post("/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email đã tồn tại." });
    }
    const last = await User.findOne().sort({ id: -1 });
    const nextId = last ? last.id + 1 : 1;
    const newUser = new User({
      id: nextId,
      name,
      email,
      password,
      role: 'customer'
    });
    await newUser.save();
    res.status(201).json({ message: "Đăng ký thành công!", user: docToJson(newUser) });
  } catch (err) {
    res.status(500).json({ message: "Lỗi Server." });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email, password });
    if (!user) {
      return res.status(401).json({ message: "Email hoặc mật khẩu không đúng." });
    }
    if (user.isBlocked) {
      return res.status(403).json({ message: "Tài khoản của bạn đã bị khóa." });
    }
    const tokenPayload = { 
      userId: user.id, 
      email: user.email, 
      role: user.role 
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' }); 
    res.status(200).json({ 
      message: "Đăng nhập thành công!", 
      token, 
      user: docToJson(user) 
    });
  } catch (err) {
    console.error("Lỗi đăng nhập:", err);
    res.status(500).json({ message: "Lỗi Server." });
  }
});

// --- CUSTOMER APIs ---
app.get("/api/products", verifyToken, async (req, res) => {
  try {
    const brand = req.query.brand; 
    let query = {};
    if (brand && brand !== 'Tất cả') {
      query.brand = brand;
    }
    const products = await Product.find(query).limit(100); 
    res.status(200).json(products.map(docToJson));
  } catch (err) {
    res.status(500).json({ message: "Lỗi Server khi tải sản phẩm." });
  }
});

app.get("/api/brands", verifyToken, async (req, res) => {
  try {
    const brands = await Product.distinct("brand");
    res.status(200).json(brands); 
  } catch (err) {
    res.status(500).json({ message: "Lỗi Server." });
  }
});

app.get("/api/products/search", verifyToken, async (req, res) => {
  try {
    const query = req.query.q; 
    if (!query) { return res.status(200).json([]); }
    const searchRegex = new RegExp(query, 'i'); 
    const products = await Product.find({
      $or: [
        { name: { $regex: searchRegex } },
        { brand: { $regex: searchRegex } } 
      ]
    }).limit(50); 
    res.status(200).json(products.map(docToJson));
  } catch (err) {
    res.status(500).json({ message: "Lỗi Server khi tìm kiếm." });
  }
});

app.get("/api/orders/history/:userId", verifyToken, async (req, res) => { 
  const userId = parseInt(req.params.userId); 
  if (req.user.userId !== userId) {
    return res.status(403).json({ message: "Không được phép xem lịch sử đơn hàng của người khác." });
  }
  try {
    const orders = await Order.find({ user_id: userId }).sort({ created_at: -1 }); 
    res.status(200).json(orders.map(docToJson));
  } catch (err) {
    res.status(500).json({ message: "Lỗi Server khi tải lịch sử đơn hàng." });
  }
});

// 🚀 CẬP NHẬT: API Đặt hàng (Thêm 'notes')
app.post("/api/orders", verifyToken, async (req, res) => { 
  const {
    userId, customerName, shippingAddress, phoneNumber, 
    paymentMethod, totalAmount, items, notes // 👈 Lấy 'notes' từ body
  } = req.body;
  
  if (req.user.userId !== userId) {
    return res.status(403).json({ message: "Token không khớp với ID người dùng." });
  }
  if (!userId || !customerName || !shippingAddress || !totalAmount || !items || items.length === 0) {
    return res.status(400).json({ message: "Thiếu trường thông tin bắt buộc" });
  }
  try {
    const last = await Order.findOne().sort({ id: -1 });
    const nextId = last ? last.id + 1 : 1;
    const orderIdCode = `#S${moment().format('YYYY')}${(nextId % 10000).toString().padStart(4, '0')}`;
    const newOrder = new Order({
      id: nextId,
      order_code: orderIdCode,
      user_id: userId,
      customer_name: customerName, // Dùng tên người nhận
      customer_email: req.user.email,
      shipping_address: shippingAddress,
      phone_number: phoneNumber,
      payment_method: paymentMethod || "COD", 
      notes: notes || "", // 👈 Lưu ghi chú
      total_amount: totalAmount,
      items: items, 
      status: "Pending",
      created_at: isoNow(),
    });
    await newOrder.save();
    res.status(201).json({ message: "Đặt hàng thành công!", order: docToJson(newOrder) });
  } catch (err) {
    console.error("Lỗi khi tạo đơn hàng:", err);
    res.status(500).json({ message: "Lỗi Server khi đặt hàng." });
  }
});


// ----------------- ADMIN APIs -----------------
app.get("/api/admin/users", verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-password'); 
    res.status(200).json(users.map(docToJson));
  } catch (err) {
    res.status(500).json({ message: "Lỗi Server." });
  }
});

app.get("/api/admin/orders", verifyToken, isAdmin, async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ created_at: -1 });
    res.status(200).json(orders.map(docToJson));
  } catch (err) {
    res.status(500).json({ message: "Lỗi Server." });
  }
});

app.put("/api/admin/orders/:orderId", verifyToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = parseInt(req.params.orderId);
    if (!['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ." });
    }
    const updatedOrder = await Order.findOneAndUpdate(
      { id: orderId },
      { $set: { status: status } },
      { new: true }
    );
    if (!updatedOrder) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    }
    res.status(200).json(docToJson(updatedOrder));
  } catch (err) {
    res.status(500).json({ message: "Lỗi Server." });
  }
});

// (API 11, 12, 13 - CRUD Sản phẩm)
app.post("/api/admin/products", verifyToken, isAdmin, async (req, res) => {
  try {
    const last = await Product.findOne().sort({ id: -1 });
    const nextId = last ? last.id + 1 : 1;
    const newProduct = new Product({
      id: nextId,
      name: req.body.name,
      brand: req.body.brand,
      category: req.body.category || req.body.brand,
      price: req.body.price,
      discount: req.body.discount || 0,
      description: req.body.description,
      sizes: req.body.sizes, 
      image_url: req.body.image_url,
      created_at: isoNow(),
    });
    await newProduct.save();
    res.status(201).json(docToJson(newProduct));
  } catch (err) {
    res.status(500).json({ message: "Lỗi Server." });
  }
});

app.put("/api/admin/products/:productId", verifyToken, isAdmin, async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const updatedData = req.body;
    const updatedProduct = await Product.findOneAndUpdate(
      { id: productId },
      { $set: updatedData },
      { new: true }
    );
    if (!updatedProduct) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }
    res.status(200).json(docToJson(updatedProduct));
  } catch (err) {
    res.status(500).json({ message: "Lỗi Server." });
  }
});

app.delete("/api/admin/products/:productId", verifyToken, isAdmin, async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const result = await Product.deleteOne({ id: productId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }
    res.status(200).json({ message: "Xóa sản phẩm thành công." });
  } catch (err) {
    res.status(500).json({ message: "Lỗi Server." });
  }
});

// API 14: (UPDATE) Chuyển đổi trạng thái Block/Unblock
app.put("/api/admin/users/:userId/toggle-block", verifyToken, isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { isBlocked } = req.body; 
    if (req.user.userId === userId) {
      return res.status(400).json({ message: "Không thể tự khóa tài khoản của chính mình." });
    }
    const updatedUser = await User.findOneAndUpdate(
      { id: userId },
      { $set: { isBlocked: isBlocked } }, 
      { new: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }
    res.status(200).json(docToJson(updatedUser));
  } catch (err) {
    res.status(500).json({ message: "Lỗi Server." });
  }
});

app.post("/api/orders", verifyToken, async (req, res) => {
  const {
    userId,
    customerName,
    shippingAddress,
    phoneNumber,
    paymentMethod,
    totalAmount,
    items,
    notes
  } = req.body;

  // Kiểm tra token hợp lệ
  if (req.user.userId !== userId) {
    return res.status(403).json({ message: "Token không khớp với ID người dùng." });
  }

  // Kiểm tra đầu vào
  if (!userId || !customerName || !shippingAddress || !totalAmount || !items || items.length === 0) {
    return res.status(400).json({ message: "Thiếu thông tin bắt buộc khi đặt hàng." });
  }

  try {
    // ✅ Lấy ID đơn hàng mới
    const last = await Order.findOne().sort({ id: -1 });
    const nextId = last ? last.id + 1 : 1;
    const orderIdCode = `#S${moment().format('YYYY')}${(nextId % 10000).toString().padStart(4, '0')}`;

    // ✅ Gắn đầy đủ thông tin sản phẩm (bao gồm hình ảnh)
    const orderItems = items.map(i => ({
      product_id: i.product_id,
      name: i.name,
      size: i.size || '',
      price: i.price,
      quantity: i.quantity,
      image_url: i.image_url || i.product_image || '', // 👈 lấy ảnh từ client, fallback nếu chưa có
    }));

    // ✅ Tạo đơn hàng mới
    const newOrder = new Order({
      id: nextId,
      order_code: orderIdCode,
      user_id: userId,
      customer_name: customerName,
      customer_email: req.user.email,
      shipping_address: shippingAddress,
      phone_number: phoneNumber,
      payment_method: paymentMethod || "COD",
      notes: notes || "",
      total_amount: totalAmount,
      items: orderItems, // ✅ sản phẩm đã có ảnh
      status: "Pending",
      created_at: moment().toISOString(),
    });

    await newOrder.save();

    res.status(201).json({
      message: "Đặt hàng thành công!",
      order: docToJson(newOrder),
    });

  } catch (err) {
    console.error("❌ Lỗi khi tạo đơn hàng:", err);
    res.status(500).json({ message: "Lỗi Server khi đặt hàng." });
  }
});  

// ----------------- LISTEN -----------------
const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => { 
  console.log(`\n---------------------------------`);
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`---------------------------------`);
});
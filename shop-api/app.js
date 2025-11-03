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
db.once("open", () => console.log("✅ Connected to MongoDB"));

const isoNow = () => moment().toISOString();
const docToJson = (doc) => {
  if (!doc) return null;
  const json = doc.toObject ? doc.toObject() : doc;
  delete json.__v;
  delete json._id;
  return json;
};

// ----------------- SCHEMAS & MODELS -----------------
const userSchema = new mongoose.Schema({
  id: Number,
  name: String,
  email: String,
  password: String,
  role: { type: String, enum: ["customer", "admin"], default: "customer" },
  isBlocked: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
});
const User = mongoose.model("User", userSchema);

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
  stock: { type: Number, default: 0 }, // ✅ thêm số lượng tồn kho
  created_at: { type: Date, default: Date.now },
});
const Product = mongoose.model("Product", productSchema);

const orderItemSchema = new mongoose.Schema({
  product_id: Number,
  name: String,
  size: String,
  price: Number,
  quantity: Number,
  image_url: String,
});

const orderSchema = new mongoose.Schema({
  id: Number,
  order_code: String,
  user_id: Number,
  customer_name: String,
  customer_email: String,
  shipping_address: String,
  phone_number: String,
  payment_method: String,
  notes: { type: String, default: "" },
  total_amount: Number,
  items: [orderItemSchema],
  status: {
    type: String,
    enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
    default: "Pending",
  },
  created_at: { type: Date, default: Date.now },
});
const Order = mongoose.model("Order", orderSchema);

// ----------------- MIDDLEWARE -----------------
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Không tìm thấy token." });
  jwt.verify(token, JWT_SECRET, (err, userPayload) => {
    if (err) return res.status(403).json({ message: "Token không hợp lệ." });
    req.user = userPayload;
    next();
  });
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") next();
  else res.status(403).json({ message: "Yêu cầu quyền Admin." });
};

// ----------------- AUTH -----------------
app.post("/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: "Email đã tồn tại." });
    const last = await User.findOne().sort({ id: -1 });
    const nextId = last ? last.id + 1 : 1;
    const user = new User({ id: nextId, name, email, password });
    await user.save();
    res.status(201).json({ message: "Đăng ký thành công!", user: docToJson(user) });
  } catch {
    res.status(500).json({ message: "Lỗi server khi đăng ký." });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email, password });
    if (!user) return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu." });
    if (user.isBlocked) return res.status(403).json({ message: "Tài khoản đã bị khóa." });
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );
    res.json({ message: "Đăng nhập thành công!", token, user: docToJson(user) });
  } catch {
    res.status(500).json({ message: "Lỗi server khi đăng nhập." });
  }
});

// ----------------- CUSTOMER -----------------
app.get("/api/products", verifyToken, async (req, res) => {
  try {
    const brand = req.query.brand;
    const query = brand && brand !== "Tất cả" ? { brand } : {};
    const products = await Product.find(query).limit(100);
    res.json(products.map(docToJson));
  } catch {
    res.status(500).json({ message: "Lỗi khi tải sản phẩm." });
  }
});

app.get("/api/brands", verifyToken, async (req, res) => {
  try {
    const brands = await Product.distinct("brand");
    res.json(brands);
  } catch {
    res.status(500).json({ message: "Lỗi server khi tải thương hiệu." });
  }
});

app.post("/api/orders", verifyToken, async (req, res) => {
  const { userId, customerName, shippingAddress, phoneNumber, paymentMethod, totalAmount, items, notes } = req.body;
  if (req.user.userId !== userId)
    return res.status(403).json({ message: "Token không khớp với người dùng." });
  try {
    const last = await Order.findOne().sort({ id: -1 });
    const nextId = last ? last.id + 1 : 1;
    const orderCode = `#S${moment().format("YYYY")}${(nextId % 10000)
      .toString()
      .padStart(4, "0")}`;
    const orderItems = items.map((i) => ({
      product_id: i.product_id,
      name: i.name,
      size: i.size || "",
      price: i.price,
      quantity: i.quantity,
      image_url: i.image_url || "",
    }));
    const newOrder = new Order({
      id: nextId,
      order_code: orderCode,
      user_id: userId,
      customer_name: customerName,
      customer_email: req.user.email,
      shipping_address: shippingAddress,
      phone_number: phoneNumber,
      payment_method: paymentMethod || "COD",
      notes: notes || "",
      total_amount: totalAmount,
      items: orderItems,
      status: "Pending",
      created_at: isoNow(),
    });
    await newOrder.save();
    res.status(201).json({ message: "Đặt hàng thành công!", order: docToJson(newOrder) });
  } catch (err) {
    console.error("Lỗi khi tạo đơn:", err);
    res.status(500).json({ message: "Lỗi server khi đặt hàng." });
  }
});

// ----------------- ADMIN -----------------
app.get("/api/admin/users", verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}, "-password");
    res.json(users.map(docToJson));
  } catch {
    res.status(500).json({ message: "Lỗi server khi tải người dùng." });
  }
});

app.get("/api/admin/orders", verifyToken, isAdmin, async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ created_at: -1 });
    res.json(orders.map(docToJson));
  } catch {
    res.status(500).json({ message: "Lỗi server khi tải đơn hàng." });
  }
});

// ✅ Duyệt đơn hàng & trừ kho
app.put("/api/admin/orders/:id/status", verifyToken, isAdmin, async (req, res) => {
  const orderId = parseInt(req.params.id);
  const { status } = req.body;

  try {
    const order = await Order.findOne({ id: orderId });
    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });

    if (status === "Delivered" && order.status !== "Delivered") {
      for (const item of order.items) {
        const product = await Product.findOne({ id: item.product_id });
        if (!product) {
          return res.status(404).json({ message: `Không tìm thấy sản phẩm: ${item.name}` });
        }
        if (product.stock < item.quantity) {
          return res.status(400).json({
            message: `Sản phẩm "${product.name}" không đủ hàng (còn ${product.stock}).`,
          });
        }
        product.stock -= item.quantity;
        await product.save();
      }
    }

    order.status = status;
    await order.save();

    res.json({ message: "Cập nhật trạng thái đơn hàng thành công!", order: docToJson(order) });
  } catch (err) {
    console.error("❌ Lỗi duyệt đơn:", err);
    res.status(500).json({ message: "Lỗi server khi duyệt đơn." });
  }
});

// ----------------- INVENTORY -----------------
const inventoryRoutes = require("./routes/inventory");
app.use("/api/admin/inventory", inventoryRoutes);

// ----------------- LISTEN -----------------
const PORT = 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server is running on port ${PORT}`);
});

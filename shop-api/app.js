// app.js
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const moment = require("moment");
const jwt = require("jsonwebtoken");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config({ override: true });

const app = express();
app.use(cors());
app.use(express.json());

// ================= CONFIG =================
const MONGO_URI  = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || "MY_SUPER_SECRET_KEY_123456";

// (tuỳ chọn) in ra để kiểm tra đã đọc đúng .env, nhưng ẩn user/pass:
console.log(
  "Using MONGO_URI =",
  (MONGO_URI || "").replace(/\/\/.*?:.*?@/, "//<user>:<pass>@")
);

// ================= DB CONNECT =================
mongoose
  .connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 })
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((e) => console.error("❌ MongoDB connection error:", e.message));

// ================= HELPERS =================
const docToJson = (doc) => {
  if (!doc) return null;
  const json = doc.toObject ? doc.toObject() : doc;
  delete json.__v;
  delete json._id;
  return json;
};

// ================= SCHEMAS =================
const userSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true },
    name: String,
    email: String,
    password: String,
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    isBlocked: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
const User = mongoose.model("User", userSchema);

// ✅ Hỗ trợ tồn kho theo size qua Map
const productSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true },
    name: { type: String, required: true },
    brand: String,
    category: String,
    price: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    description: { type: String, default: "" },
    image_url: { type: String, default: "" },
    material: { type: String, default: "" },

    stock: { type: Number, default: 0 }, // tổng tồn kho
    size_stocks: { type: Map, of: Number, default: {} }, // tồn theo size
    sizes: [String],

    created_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
const Product = mongoose.model("Product", productSchema);

const orderItemSchema = new mongoose.Schema({
  product_id: Number, // id số tự tăng của Product
  name: String,
  size: String,
  price: Number,
  quantity: Number,
  image_url: String,
});

const orderSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true },
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
  },
  { timestamps: true }
);
const Order = mongoose.model("Order", orderSchema);

// ================= MIDDLEWARE =================
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Không tìm thấy token." });
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ message: "Token không hợp lệ." });
    req.user = payload; // { userId, email, role }
    next();
  });
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") return next();
  return res.status(403).json({ message: "Yêu cầu quyền Admin." });
};

// ================= AUTH =================
app.post("/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: "Email đã tồn tại." });

    const last = await User.findOne().sort({ id: -1 });
    const nextId = last ? last.id + 1 : 1;

    const user = new User({ id: nextId, name, email, password });
    await user.save();
    res.status(201).json({ message: "Đăng ký thành công!", user: docToJson(user) });
  } catch (e) {
    console.error("❌ Lỗi đăng ký:", e);
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
  } catch (e) {
    console.error("❌ Lỗi đăng nhập:", e);
    res.status(500).json({ message: "Lỗi server khi đăng nhập." });
  }
});

// ================= PUBLIC/CUSTOMER APIs =================
app.get("/api/products", verifyToken, async (req, res) => {
  try {
    const brand = req.query.brand;
    const query = brand && brand !== "Tất cả" ? { brand } : {};
    const products = await Product.find(query).limit(200);
    res.json(products.map(docToJson));
  } catch (e) {
    console.error("❌ Lỗi tải sản phẩm:", e);
    res.status(500).json({ message: "Lỗi khi tải sản phẩm." });
  }
});

app.get("/api/brands", verifyToken, async (req, res) => {
  try {
    const brands = await Product.distinct("brand");
    res.json(brands);
  } catch (e) {
    console.error("❌ Lỗi tải brands:", e);
    res.status(500).json({ message: "Lỗi server khi tải thương hiệu." });
  }
});

// Khách đặt hàng
app.post("/api/orders", verifyToken, async (req, res) => {
  const {
    userId,
    customerName,
    shippingAddress,
    phoneNumber,
    paymentMethod,
    totalAmount,
    items,
    notes,
  } = req.body;

  if (req.user.userId !== userId)
    return res.status(403).json({ message: "Token không khớp với người dùng." });

  try {
    const last = await Order.findOne().sort({ id: -1 });
    const nextId = last ? last.id + 1 : 1;
    const orderCode = `#S${moment().format("YYYY")}${(nextId % 10000)
      .toString()
      .padStart(4, "0")}`;

    const orderItems = (items || []).map((i) => ({
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
      created_at: moment().toISOString(),
    });

    await newOrder.save();

    // 🔔 thông báo admin
    try {
      req.app.get("socketio")?.emit("newOrder", {
        id: newOrder.id,
        order_code: newOrder.order_code,
        customer_name: newOrder.customer_name,
        total_amount: newOrder.total_amount,
        created_at: newOrder.created_at,
        status: "Pending",
      });
    } catch {}

    // 🔔 thông báo riêng KH (room user-<id>)
    try {
      req.app.get("socketio")?.to(`user-${newOrder.user_id}`).emit("userOrderCreated", {
        id: newOrder.id,
        order_code: newOrder.order_code,
        status: newOrder.status,
        total_amount: newOrder.total_amount,
        created_at: newOrder.created_at,
      });
    } catch {}

    res.status(201).json({ message: "Đặt hàng thành công!", order: docToJson(newOrder) });
  } catch (e) {
    console.error("❌ Lỗi khi tạo đơn:", e);
    res.status(500).json({ message: "Lỗi server khi đặt hàng." });
  }
});

// Lịch sử đơn hàng của KH
app.get("/api/orders/history/:userId", verifyToken, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) return res.status(400).json({ message: "ID không hợp lệ." });
    if (req.user.role !== "admin" && req.user.userId !== userId) {
      return res.status(403).json({ message: "Không có quyền xem lịch sử của người khác." });
    }
    const orders = await Order.find({ user_id: userId }).sort({ created_at: -1 });
    res.json(orders.map(docToJson));
  } catch (e) {
    console.error("❌ Lỗi tải lịch sử đơn:", e);
    res.status(200).json([]);
  }
});

// ================= ADMIN APIs (users) =================
app.get("/api/admin/users", verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}, "-password");
    res.json(users.map(docToJson));
  } catch (e) {
    console.error("❌ Lỗi tải người dùng:", e);
    res.status(200).json([]);
  }
});

// === Alias: GET /api/orders (admin only, xem danh sách tất cả đơn)
app.get("/api/orders", verifyToken, isAdmin, async (req, res) => {
  try {
    const orders = await Order.find().sort({ created_at: -1 });
    res.json(orders.map(docToJson));
  } catch (e) {
    console.error("❌ Lỗi tải đơn (alias /api/orders):", e);
    res.status(200).json([]);
  }
});

// ================= MOUNT ROUTES (INVENTORY & ORDERS) =================
// Hai file route này ĐÃ tự kiểm tra verifyToken + isAdmin bên trong.
// => mount thẳng, không bọc middleware lần nữa.
// DEBUG: xem app đang kết nối DB nào
app.get("/debug/db", (req, res) => {
  const conn = mongoose.connection;
  res.json({
    dbName: conn.name,
    host: conn.host,
    user: conn.user || null
  });
});

// DEBUG: liệt kê nhanh vài user (ẩn password)
app.get("/debug/users", async (req, res) => {
  const users = await User.find({}, "id email role").limit(10);
  res.json(users);
});
const inventoryRoutes = require("./routes/inventory");
const orderRoutes = require("./routes/orders");
app.use("/api/admin/inventory", inventoryRoutes);
app.use("/api/admin/orders", orderRoutes);

// ================= SOCKET.IO =================
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.set("socketio", io);

io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);

  // Client gọi ngay sau khi connect để vào phòng theo userId
  socket.on("registerUser", (userId) => {
    const n = Number(userId);
    if (Number.isFinite(n)) {
      const room = `user-${n}`;
      socket.join(room);
      console.log(`📌 ${socket.id} joined ${room}`);
    }
  });

  socket.on("disconnect", () => console.log("❌ Disconnected:", socket.id));
});

// ================= START SERVER =================
// Giữ nguyên port 3000 như bạn yêu cầu (ưu tiên .env nếu có).
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server is running on port ${PORT}`);
});

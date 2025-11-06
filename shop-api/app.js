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
app.use("/api/auth", require("./routes/auth"));

// ================= CONFIG =================
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || "MY_SUPER_SECRET_KEY_123456";

// Ẩn user/pass khi in URI
console.log("Using MONGO_URI =", (MONGO_URI || "").replace(/\/\/.*?:.*?@/, "//<user>:<pass>@"));

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

// ================= MODELS =================
const User = require("./models/User");
const Product = require("./models/Product");
const Order = require("./models/Order");

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

    const user = new User({ id: nextId, name, email, password, role: "customer" });
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

// ================= PUBLIC PRODUCT APIs =================
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ id: 1 }).limit(200);
    res.json(products.map(docToJson));
  } catch (e) {
    console.error("❌ Lỗi tải sản phẩm:", e);
    res.status(500).json({ message: "Lỗi khi tải sản phẩm." });
  }
});

// ================= CHECKOUT =================
app.post("/api/orders", verifyToken, async (req, res) => {
  const uid = Number(req.user.userId);
  if (!Number.isFinite(uid)) return res.status(401).json({ message: "Token không hợp lệ." });

  const { customerName, shippingAddress, phoneNumber, paymentMethod, totalAmount, items, notes } =
    req.body;

  try {
    const last = await Order.findOne().sort({ id: -1 });
    const nextId = last ? last.id + 1 : 1;
    const orderCode = `#S${moment().format("YYYY")}${(nextId % 10000).toString().padStart(4, "0")}`;

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
      user_id: uid,
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
    res.status(201).json({ message: "Đặt hàng thành công!", order: docToJson(newOrder) });
  } catch (e) {
    console.error("❌ Lỗi khi tạo đơn:", e);
    res.status(500).json({ message: "Lỗi server khi đặt hàng." });
  }
});

// ================= ORDER HISTORY =================
// CUSTOMER xem lịch sử của chính mình
app.get("/api/orders/history", verifyToken, async (req, res) => {
  try {
    const me = Number(req.user.userId);
    const orders = await Order.find({ user_id: me }).sort({ created_at: -1 });
    res.json(orders.map(docToJson));
  } catch (e) {
    console.error("❌ Lỗi tải lịch sử đơn (self):", e);
    res.status(200).json([]);
  }
});

// Alias cho FE: /me
app.get("/api/orders/history/me", verifyToken, async (req, res) => {
  try {
    const me = Number(req.user.userId);
    const orders = await Order.find({ user_id: me }).sort({ created_at: -1 });
    res.json(orders.map(docToJson));
  } catch (e) {
    console.error("❌ Lỗi tải lịch sử đơn (me):", e);
    res.status(200).json([]);
  }
});

// ADMIN xem lịch sử của user bất kỳ
app.get("/api/orders/history/:userId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ message: "Không có quyền xem lịch sử người khác." });

    const targetId = Number(req.params.userId);
    const orders = await Order.find({ user_id: targetId }).sort({ created_at: -1 });
    res.json(orders.map(docToJson));
  } catch (e) {
    console.error("❌ Lỗi tải lịch sử đơn (admin):", e);
    res.status(200).json([]);
  }
});

// ================= ADMIN APIs =================
app.get("/api/admin/users", verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}, "-password");
    res.json(users.map(docToJson));
  } catch (e) {
    console.error("❌ Lỗi tải người dùng:", e);
    res.status(200).json([]);
  }
});

// ================= SOCKET =================
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.set("socketio", io);

io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);
  socket.on("registerUser", (userId) => {
    const n = Number(userId);
    if (Number.isFinite(n)) socket.join(`user-${n}`);
  });
  socket.on("disconnect", () => console.log("❌ Disconnected:", socket.id));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`✅ Server is running on port ${PORT}`));

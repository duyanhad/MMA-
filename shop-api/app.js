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
const MONGO_URI  = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || "MY_SUPER_SECRET_KEY_123456";

// (tuỳ chọn) in ra để kiểm tra đã đọc đúng .env, nhưng ẩn user/pass:
console.log(
  "Using MONGO_URI =",
  (MONGO_URI || "").replace(/\/\/.*?:.*?@/, "//<user>:<pass>@")
);

// ================= DB CONNECT =================


// ================= HELPERS =================
const docToJson = (doc) => {
  if (!doc) return null;
  const json = doc.toObject ? doc.toObject() : doc;
  delete json.__v;
  delete json._id;
  return json;
};

// ✅ Chuẩn hoá Product: Map -> Object cho size_stocks + ép key về string
const productToJson = (doc) => {
  if (!doc) return null;
  const p = doc.toObject ? doc.toObject() : { ...doc };

  delete p.__v;
  delete p._id;

  if (p.size_stocks instanceof Map) {
    p.size_stocks = Object.fromEntries(p.size_stocks);
  }
  const norm = {};
  for (const k in p.size_stocks || {}) {
    norm[String(k)] = Number(p.size_stocks[k] || 0);
  }
  p.size_stocks = norm;

  return p;
};

/* ================= MODELS (fix lỗi OverwriteModelError) ================ */
// ❗ Thay cho toàn bộ khối SCHEMAS cũ: chỉ import model đã định nghĩa sẵn
const User    = require("./models/User");
const Product = require("./models/Product");
const Order   = require("./models/Order");
/* ====================================================================== */

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
app.get("/api/products", async (req, res) => {
  try {
    const brand = req.query.brand;
    const query = brand && brand !== "Tất cả" ? { brand } : {};
    const products = await Product.find(query).sort({ id: 1 }).limit(200);
    res.json(products.map(productToJson));
  } catch (e) {
    console.error("❌ Lỗi tải sản phẩm:", e);
    res.status(500).json({ message: "Lỗi khi tải sản phẩm." });
  }
});

// ✅ Chi tiết sản phẩm public
app.get("/api/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID không hợp lệ." });
    const p = await Product.findOne({ id });
    if (!p) return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    res.json(productToJson(p));
  } catch (e) {
    console.error("❌ Lỗi lấy chi tiết sản phẩm:", e);
    res.status(500).json({ message: "Lỗi server khi lấy chi tiết sản phẩm." });
  }
});

app.get("/api/brands", async (req, res) => {
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

// ================= DEBUG =================
app.get("/debug/db", (req, res) => {
  const conn = mongoose.connection;
  res.json({
    dbName: conn.name,
    host: conn.host,
    user: conn.user || null
  });
});

app.get("/debug/users", async (req, res) => {
  const users = await User.find({}, "id email role").limit(10);
  res.json(users);
});

// ================= MOUNT ROUTES (INVENTORY & ORDERS) =================
const inventoryRoutes = require("./routes/inventory");
const orderRoutes = require("./routes/orders");
app.use("/api/admin/inventory", inventoryRoutes);
app.use("/api/admin/orders", orderRoutes);
// 🆕 Public detail để FE gọi /api/orders/:id (có verifyToken trong routes)
app.use("/api/orders", orderRoutes.publicRouter); // <-- thêm dòng này

// ================= SOCKET.IO =================
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.set("socketio", io);

io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);

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

app.get("/health", (req, res) => {
  const state = mongoose.connection.readyState; // 1 = connected
  res.status(200).json({
    ok: state === 1,
    state, // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    db: mongoose.connection.name || null
  });
});

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    // tăng timeout để cold start Render ổn định hơn
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000,       // 30s
      socketTimeoutMS: 45000,                // tùy chọn, an toàn hơn
    });
    console.log("✅ Connected to MongoDB Atlas");

    // Lắng nghe bằng server (để socket.io hoạt động)
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Mongo connect failed:", err.message);
    // Thử lại sau 5s để tránh 502 khi Atlas delay
    setTimeout(start, 5000);
  }
}
start();
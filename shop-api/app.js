const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const moment = require("moment");
const jwt = require("jsonwebtoken");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());

// ================= DATABASE =================
const MONGO_URI = "mongodb://127.0.0.1:27017/shopdb";
const JWT_SECRET = "MY_SUPER_SECRET_KEY_123456";

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => console.log("✅ Connected to MongoDB"));

// ================= HELPERS =================
const docToJson = (doc) => {
  if (!doc) return null;
  const json = doc.toObject ? doc.toObject() : doc;
  delete json.__v;
  delete json._id;
  return json;
};

// ================= SCHEMAS =================
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
  stock: { type: Number, default: 0 },
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

// ================= MIDDLEWARE =================
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

// ================= AUTH =================
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
  } catch (err) {
    console.error("❌ Lỗi đăng ký:", err);
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
  } catch (err) {
    console.error("❌ Lỗi đăng nhập:", err);
    res.status(500).json({ message: "Lỗi server khi đăng nhập." });
  }
});

// ================= CUSTOMER =================
app.get("/api/products", verifyToken, async (req, res) => {
  try {
    const brand = req.query.brand;
    const query = brand && brand !== "Tất cả" ? { brand } : {};
    const products = await Product.find(query).limit(100);
    res.json(products.map(docToJson));
  } catch (err) {
    console.error("❌ Lỗi tải sản phẩm:", err);
    res.status(500).json({ message: "Lỗi khi tải sản phẩm." });
  }
});

app.get("/api/brands", verifyToken, async (req, res) => {
  try {
    const brands = await Product.distinct("brand");
    res.json(brands);
  } catch (err) {
    console.error("❌ Lỗi tải brands:", err);
    res.status(500).json({ message: "Lỗi server khi tải thương hiệu." });
  }
});

// ================= ORDERS (CUSTOMER) =================
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
      created_at: moment().toISOString(),
    });

    await newOrder.save();

    // 🔔 Emit đơn mới cho admin
    try {
      req.app.get("socketio")?.emit("newOrder", {
        id: newOrder.id,
        order_code: newOrder.order_code,
        customer_name: newOrder.customer_name,
        total_amount: newOrder.total_amount,
        created_at: newOrder.created_at,
        status: "Pending",
      });
    } catch (e) {
      console.warn("⚠️ Emit newOrder failed:", e?.message);
    }

    res.status(201).json({
      message: "Đặt hàng thành công!",
      order: newOrder.toObject ? newOrder.toObject() : newOrder,
    });
  } catch (err) {
    console.error("❌ Lỗi khi tạo đơn:", err);
    res.status(500).json({ message: "Lỗi server khi đặt hàng." });
  }
});

// ================= ADMIN APIs =================
app.get("/api/admin/users", verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}, "-password");
    res.json(users.map(docToJson));
  } catch (err) {
    console.error("❌ Lỗi tải người dùng:", err);
    res.status(200).json([]); // tránh client crash
  }
});

app.get("/api/admin/orders", verifyToken, isAdmin, async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ created_at: -1 });
    res.json(orders.map(docToJson));
  } catch (err) {
    console.error("❌ Lỗi tải đơn hàng:", err);
    res.status(200).json([]);
  }
});

// ✅ Khóa/Mở khóa user (không khóa được admin)
app.put("/api/admin/users/:id/block", verifyToken, isAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { isBlocked } = req.body || {};
    if (isNaN(targetId)) return res.status(400).json({ message: "ID không hợp lệ." });

    const actor = await User.findOne({ id: req.user?.userId });
    if (!actor || actor.role !== "admin") {
      return res.status(403).json({ message: "Yêu cầu quyền Admin." });
    }

    const target = await User.findOne({ id: targetId });
    if (!target) return res.status(404).json({ message: "Không tìm thấy người dùng." });
    if (target.role === "admin") {
      return res.status(403).json({ message: "Không thể khóa tài khoản admin." });
    }

    target.isBlocked = !!isBlocked;
    await target.save();
    res.json({
      message: target.isBlocked ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản.",
      user: { id: target.id, email: target.email, isBlocked: target.isBlocked, role: target.role },
    });
  } catch (e) {
    console.error("❌ Lỗi block/unblock user:", e);
    res.status(500).json({ message: "Lỗi server." });
  }
});

// ✅ Duyệt/Hủy/Đổi trạng thái đơn – trừ kho khi chuyển sang Delivered
app.put("/api/admin/orders/:id/status", verifyToken, isAdmin, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const { status } = req.body || {};

    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ message: "ID đơn hàng không hợp lệ." });
    }
    const valid = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
    if (!valid.includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ." });
    }

    const order = await Order.findOne({ id: orderId });
    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });

    // Trừ kho một lần khi chuyển sang Delivered
    if (order.status !== "Delivered" && status === "Delivered") {
      // kiểm tra đủ hàng
      for (const it of order.items) {
        const p = await Product.findOne({ id: it.product_id });
        if (!p) return res.status(404).json({ message: `Không tìm thấy SP: ${it.name}` });
        if ((p.stock || 0) < it.quantity) {
          return res.status(400).json({
            message: `Sản phẩm "${p.name}" không đủ hàng (còn ${p.stock}).`,
          });
        }
      }
      // trừ kho
      for (const it of order.items) {
        const p = await Product.findOne({ id: it.product_id });
        p.stock = Math.max(0, (p.stock || 0) - it.quantity);
        await p.save();
      }
    }

    order.status = status;
    await order.save();

    try {
      req.app.get("socketio")?.emit("orderUpdated", { id: order.id, status: order.status });
    } catch {}

    res.json({
      message: "Cập nhật trạng thái đơn hàng thành công!",
      order: {
        id: order.id,
        order_code: order.order_code,
        status: order.status,
        total_amount: order.total_amount,
        created_at: order.created_at,
      },
    });
  } catch (e) {
    console.error("❌ Lỗi duyệt/hủy đơn:", e);
    res.status(500).json({ message: "Lỗi server khi cập nhật đơn hàng." });
  }
});

// ================= SOCKET.IO THÔNG BÁO =================
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.set("socketio", io);

io.on("connection", (socket) => {
  console.log("✅ Admin connected:", socket.id);
  socket.on("disconnect", () => console.log("❌ Admin disconnected:", socket.id));
});

// ================= INVENTORY (mount đúng middleware & truyền Product) =================
const inventoryRoutes = require("./routes/inventory")(Product);
app.use("/api/admin/inventory", verifyToken, isAdmin, inventoryRoutes);

// ================= START SERVER =================
const PORT = 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server is running on port ${PORT}`);
});

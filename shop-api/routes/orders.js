// routes/orders.js
const express = require("express");
const jwt = require("jsonwebtoken");
const Order = require("../models/Order");

const router = express.Router();         // Router cho /api/admin/orders
const publicRouter = express.Router();   // Router cho /api/orders

const JWT_SECRET = process.env.JWT_SECRET || "MY_SUPER_SECRET_KEY_123456";

/* ------------------------ AUTH MIDDLEWARES ------------------------ */
const verifyToken = (req, res, next) => {
  try {
    const token = (req.headers["authorization"] || "").split(" ")[1];
    if (!token) return res.status(401).json({ message: "Không tìm thấy token." });

    jwt.verify(token, JWT_SECRET, (err, payload) => {
      if (err) return res.status(403).json({ message: "Token không hợp lệ." });
      req.user = payload; // { userId, email, role }
      next();
    });
  } catch (e) {
    return res.status(401).json({ message: "Token không hợp lệ." });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user?.role === "admin") return next();
  return res.status(403).json({ message: "Yêu cầu quyền Admin." });
};

/* ----------------------------- HELPERS ---------------------------- */
const toJson = (doc) =>
  doc?.toObject ? doc.toObject({ versionKey: false }) : doc;

/* ======================= ADMIN: LIST ALL ORDERS =================== */
// GET /api/admin/orders
router.get("/", verifyToken, isAdmin, async (_req, res) => {
  try {
    const orders = await Order.find().sort({ created_at: -1 });
    res.json(orders.map(toJson));
  } catch (e) {
    console.error("❌ Lỗi tải đơn (admin):", e);
    res.status(500).json({ message: "Lỗi server khi tải danh sách đơn." });
  }
});

/* ======================= ADMIN: ORDER DETAIL ====================== */
// GET /api/admin/orders/:id
router.get("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const idParam = String(req.params.id || "").trim();
    let order = null;

    // id số tự tăng
    if (/^\d+$/.test(idParam)) {
      order = await Order.findOne({ id: Number(idParam) });
    }
    // nếu không phải số, thử _id Mongo
    if (!order) {
      try { order = await Order.findById(idParam); } catch (_) {}
    }
    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });

    res.json(toJson(order));
  } catch (e) {
    console.error("❌ Lỗi chi tiết đơn (admin):", e);
    res.status(500).json({ message: "Lỗi server khi lấy chi tiết đơn." });
  }
});

/* ======================= ADMIN: UPDATE STATUS ===================== */
// PUT /api/admin/orders/:id/status
router.put("/:id/status", verifyToken, isAdmin, async (req, res) => {
  try {
    const idParam = String(req.params.id || "").trim();
    const nextStatus = String(req.body?.status || "").trim();

    const ALLOW = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
    if (!ALLOW.includes(nextStatus)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ." });
    }

    let order = null;
    if (/^\d+$/.test(idParam)) {
      order = await Order.findOne({ id: Number(idParam) });
    }
    if (!order) {
      try { order = await Order.findById(idParam); } catch (_) {}
    }
    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });

    order.status = nextStatus;
    await order.save();

    res.json({ message: "Cập nhật trạng thái thành công.", order: toJson(order) });
  } catch (e) {
    console.error("❌ Lỗi cập nhật trạng thái:", e);
    res.status(500).json({ message: "Lỗi server khi cập nhật trạng thái đơn." });
  }
});

/* ========================= PUBLIC: ORDER DETAIL =================== */
/*  GET /api/orders/:id
    - Cho user hoặc admin xem chi tiết đơn.
    - User CHỈ xem được đơn của chính họ (order.user_id === req.user.userId). */
publicRouter.get("/:id", verifyToken, async (req, res) => {
  try {
    const idParam = String(req.params.id || "").trim();
    let order = null;

    if (/^\d+$/.test(idParam)) {
      order = await Order.findOne({ id: Number(idParam) });
    }
    if (!order) {
      try { order = await Order.findById(idParam); } catch (_) {}
    }
    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });

    // Nếu không phải admin, chỉ được xem đơn của mình
    if (req.user.role !== "admin" && order.user_id !== req.user.userId) {
      return res.status(403).json({ message: "Không có quyền xem đơn này." });
    }

    res.json(toJson(order));
  } catch (e) {
    console.error("❌ Lỗi chi tiết đơn (public):", e);
    res.status(500).json({ message: "Lỗi server khi lấy chi tiết đơn." });
  }
});

module.exports = router;
// Export thêm public router để mount tại /api/orders
module.exports.publicRouter = publicRouter;

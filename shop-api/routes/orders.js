// routes/orders.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const Order = require('../models/Order');     // ✅ là Mongoose Model
const Product = require('../models/Product'); // ✅ dùng để trừ kho

const JWT_SECRET = "MY_SUPER_SECRET_KEY_123456";

// ---- middlewares riêng cho route này ----
const verifyToken = (req, res, next) => {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Không tìm thấy token.' });
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ message: 'Token không hợp lệ.' });
    req.user = payload; // {userId, email, role}
    next();
  });
};
const isAdmin = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  return res.status(403).json({ message: 'Yêu cầu quyền Admin.' });
};

// ---- Lấy danh sách đơn hàng ----
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ created_at: -1 });
    res.json(orders);
  } catch (err) {
    console.error('❌ Lỗi tải đơn hàng:', err);
    res.status(500).json({ message: 'Lỗi server khi tải đơn hàng.' });
  }
});

// ---- Cập nhật trạng thái đơn hàng, trừ kho khi Delivered ----
router.put('/:id/status', verifyToken, isAdmin, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const { status } = req.body || {};

    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ message: 'ID đơn hàng không hợp lệ.' });
    }
    const valid = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
    if (!valid.includes(status)) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
    }

    const order = await Order.findOne({ id: orderId });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });

    // Chỉ trừ kho 1 lần khi chuyển sang Delivered
    if (order.status !== 'Delivered' && status === 'Delivered') {
      // kiểm tra đủ hàng
      for (const it of order.items) {
        const p = await Product.findOne({ id: it.product_id });
        if (!p) {
          return res.status(404).json({ message: `Không tìm thấy sản phẩm: ${it.name}` });
        }
        // Nếu có size_stocks thì ưu tiên trừ theo size
        if (p.size_stocks && p.size_stocks instanceof Map && it.size) {
          const cur = Number(p.size_stocks.get(it.size) || 0);
          if (cur < it.quantity) {
            return res.status(400).json({ message: `Size ${it.size} của "${p.name}" không đủ hàng.` });
          }
        } else {
          if ((p.stock || 0) < it.quantity) {
            return res.status(400).json({ message: `Sản phẩm "${p.name}" không đủ hàng (còn ${p.stock}).` });
          }
        }
      }
      // trừ kho
      for (const it of order.items) {
        const p = await Product.findOne({ id: it.product_id });
        if (p.size_stocks && p.size_stocks instanceof Map && it.size) {
          const cur = Number(p.size_stocks.get(it.size) || 0);
          p.size_stocks.set(it.size, Math.max(0, cur - it.quantity));
          // cập nhật stock tổng cho đồng bộ
          const total = Array.from(p.size_stocks.values()).reduce((s, n) => s + Number(n || 0), 0);
          p.stock = total;
        } else {
          p.stock = Math.max(0, (p.stock || 0) - it.quantity);
        }
        await p.save();
      }
    }

    order.status = status;
    await order.save();

    // emit socket nếu cần (admin dashboard / user)
    try {
      req.app.get('socketio')?.emit('orderUpdated', { id: order.id, status: order.status });
      req.app.get('socketio')?.to(`user-${order.user_id}`).emit('userOrderUpdated', {
        id: order.id,
        order_code: order.order_code,
        status: order.status,
        total_amount: order.total_amount,
        created_at: order.created_at,
      });
    } catch {}

    res.json({ message: 'Cập nhật trạng thái đơn hàng thành công!', order });
  } catch (e) {
    console.error('❌ Lỗi duyệt/hủy đơn:', e);
    res.status(500).json({ message: 'Lỗi server khi cập nhật đơn hàng.' });
  }
});

module.exports = router;

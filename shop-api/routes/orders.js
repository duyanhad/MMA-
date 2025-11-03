const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');

// ✅ API: Admin duyệt đơn (hoặc cập nhật trạng thái)
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });

    // Nếu đơn đang ở Pending và được duyệt (Delivered)
    if (order.status !== 'Delivered' && status === 'Delivered') {
      for (const item of order.items) {
        const product = await Product.findById(item.product_id);
        if (product) {
          product.stock = Math.max(0, product.stock - item.quantity);
          await product.save();
        }
      }
    }

    order.status = status;
    await order.save();

    res.json({ message: 'Cập nhật đơn hàng thành công', order });
  } catch (error) {
    console.error('❌ Lỗi duyệt đơn:', error);
    res.status(500).json({ message: 'Lỗi server khi cập nhật đơn hàng' });
  }
});

module.exports = router;

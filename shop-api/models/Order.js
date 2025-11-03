// routes/admin/orders.js
const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');

// ✅ Lấy danh sách tất cả đơn hàng (admin xem)
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ created_at: -1 });
    res.status(200).json(orders);
  } catch (error) {
    console.error('❌ Lỗi tải đơn hàng:', error);
    res.status(500).json({ message: 'Lỗi server khi tải đơn hàng.' });
  }
});

// ✅ Cập nhật trạng thái đơn hàng (duyệt / hủy / ... )
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    }

    // 🔹 Nếu đơn từ Pending -> Delivered → trừ sản phẩm trong kho
    if (order.status !== 'Delivered' && status === 'Delivered') {
      console.log('🟢 Đơn được duyệt, tiến hành trừ hàng trong kho...');
      await Promise.all(
        order.items.map(async (item) => {
          try {
            const product = await Product.findById(item.product_id);
            if (product) {
              const oldStock = product.stock;
              const newStock = Math.max(0, oldStock - item.quantity);
              product.stock = newStock;
              await product.save();
              console.log(
                `🔻 Đã trừ ${item.quantity} sản phẩm "${product.name}" (tồn kho: ${oldStock} → ${newStock})`
              );
            } else {
              console.warn(`⚠️ Không tìm thấy sản phẩm ID: ${item.product_id}`);
            }
          } catch (err) {
            console.error('❌ Lỗi khi cập nhật sản phẩm:', err);
          }
        })
      );
    }

    // 🔹 Cập nhật trạng thái đơn
    order.status = status;
    await order.save();

    res.status(200).json({ message: 'Cập nhật đơn hàng thành công!', order });
  } catch (error) {
    console.error('❌ Lỗi cập nhật trạng thái:', error);
    res.status(500).json({ message: 'Lỗi server khi cập nhật đơn hàng.' });
  }
});

module.exports = router;

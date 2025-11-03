const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');

// ✅ Lấy tất cả đơn hàng
router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ created_at: -1 });
    res.status(200).json(orders);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách đơn hàng:', err);
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách đơn hàng.' });
  }
});

// ✅ Lấy tất cả người dùng (nếu bạn có collection User)
router.get('/users', async (req, res) => {
  try {
    // ⚠️ Nếu bạn chưa có model User thì comment dòng này lại
    const users = []; // hoặc await User.find()
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách người dùng.' });
  }
});

// ✅ Cập nhật trạng thái đơn hàng và trừ tồn kho
router.put('/orders/:id/status', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const orderId = req.params.id;
    const { status } = req.body;

    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    }

    // Chỉ xử lý trừ kho nếu chuyển sang "Delivered" lần đầu
    if (status === 'Delivered' && order.status !== 'Delivered') {
      for (const item of order.items) {
        const productId = item.product_id || item.productId || item.id;
        const quantity = item.quantity || 1;

        const product = await Product.findOne({
          $or: [
            { _id: productId },
            { id: productId } // Trường hợp bạn dùng id dạng số
          ]
        }).session(session);

        if (!product) {
          await session.abortTransaction();
          session.endSession();
          return res.status(404).json({ message: `Không tìm thấy sản phẩm (${productId}).` });
        }

        if (product.stock < quantity) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            message: `Sản phẩm "${product.name}" không đủ hàng (Còn ${product.stock}, cần ${quantity}).`
          });
        }

        product.stock -= quantity;
        await product.save({ session });
      }
    }

    // Cập nhật trạng thái đơn hàng
    order.status = status;
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ message: 'Cập nhật trạng thái đơn hàng thành công và đã trừ kho!' });
  } catch (err) {
    console.error('Lỗi cập nhật đơn hàng:', err);
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Lỗi server khi cập nhật đơn hàng.' });
  }
});

module.exports = router;

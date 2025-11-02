// routes/orders.js
const express = require('express');
const router = express.Router();
const Order = require('../models/Order'); // Import Order Model

// API 1: Đặt hàng mới (Lưu đơn hàng vào DB)
router.post('/', async (req, res) => {
  try {
    const newOrder = new Order({
      ...req.body, // Nhận tất cả thông tin từ Frontend
      orderId: 'ORD-' + Date.now().toString().slice(-6), // Tự tạo mã ngắn
    });

    const order = await newOrder.save();
    // Trả về orderId đã tạo để Frontend hiển thị
    res.status(201).json({ message: 'Đặt hàng thành công!', orderId: order.orderId });
  } catch (error) {
    console.error('Lỗi khi lưu đơn hàng:', error);
    res.status(500).json({ message: 'Lỗi Server khi đặt hàng.' });
  }
});

// API 2: Lấy lịch sử mua hàng theo userId
router.get('/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        // Tìm tất cả đơn hàng của userId và sắp xếp theo ngày mới nhất
        const orders = await Order.find({ userId })
                                   .sort({ timestamp: -1 });

        res.status(200).json(orders);
    } catch (error) {
        console.error('Lỗi khi tải lịch sử đơn hàng:', error);
        res.status(500).json({ message: 'Lỗi Server khi tải lịch sử.' });
    }
});

module.exports = router;
// models/Order.js
const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  // Liên kết đơn hàng với người dùng (Quan trọng)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', 
    required: true,
  },
  
  // Thông tin người nhận
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  shippingAddress: { type: String, required: true },
  paymentMethod: { type: String, default: 'COD' },

  // Danh sách sản phẩm
  items: [
    {
      id: { type: String, required: true }, 
      name: { type: String, required: true },
      selectedSize: { type: String },
      quantity: { type: Number, required: true },
      final_price: { type: Number, required: true }, 
    },
  ],

  // Tổng tiền và phí
  totalAmount: { type: Number, required: true },
  shippingFee: { type: Number, default: 0 },
  
  // Trạng thái (để người dùng theo dõi)
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending',
  },
  orderId: { type: String, unique: true }, 

}, {
  timestamps: true // Tự động thêm createdAt và updatedAt
});

module.exports = mongoose.model('Order', OrderSchema);
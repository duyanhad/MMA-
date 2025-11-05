// models/Order.js
const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  product_id: Number,      // id số tự tăng của Product
  name: String,
  size: String,
  price: Number,
  quantity: Number,
  image_url: String,
});

const OrderSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true },
    order_code: String,
    user_id: Number,
    customer_name: String,
    customer_email: String,
    shipping_address: String,
    phone_number: String,
    payment_method: String,
    notes: { type: String, default: "" },
    total_amount: Number,
    items: [OrderItemSchema],
    status: {
      type: String,
      enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
      default: "Pending",
    },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// ⚠️ Quan trọng: export đúng Mongoose model
module.exports = mongoose.models.Order || mongoose.model('Order', OrderSchema);

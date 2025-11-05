// shop-api/models/Product.js
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true },         // id số tự tăng
    name: { type: String, required: true },
    brand: { type: String, default: '' },
    category: { type: String, default: '' },

    price: { type: Number, required: true },
    discount: { type: Number, default: 0 },     // %
    final_price: { type: Number },              // optional nếu bạn muốn lưu

    description: { type: String, default: '' },
    material: { type: String, default: '' },
    image_url: { type: String, default: '' },

    // 👉 TỒN THEO SIZE + DANH SÁCH SIZE
    size_stocks: { type: Map, of: Number, default: {} }, // { "38": 12, "39": 0, ... }
    sizes: [String],                                     // ["38","39",...]

    // 👉 TỔNG TỒN = tổng của size_stocks
    stock: { type: Number, default: 0 },

    created_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Product || mongoose.model('Product', ProductSchema);

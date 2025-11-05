// models/Product.js
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true }, // id tự tăng bên app
    name: { type: String, required: true, trim: true },
    brand: { type: String, default: '', trim: true },
    category: { type: String, default: '', trim: true },

    price: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 }, // %
    final_price: { type: Number }, // optional: có thể bỏ nếu FE tự tính

    description: { type: String, default: '' },
    material: { type: String, default: '' },
    image_url: { type: String, default: '' },

    // Tồn theo size
    size_stocks: { type: Map, of: Number, default: {} },
    sizes: { type: [String], default: [] },

    // Tổng tồn (tính từ size_stocks)
    stock: { type: Number, default: 0 },

    created_at: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    minimize: false, // ⚠️ lưu cả Map rỗng
    toObject: { virtuals: true, versionKey: false, transform: mapTransform },
    toJSON:   { virtuals: true, versionKey: false, transform: mapTransform },
  }
);

// Chuyển Map -> Object và ép key về string khi xuất JSON
function mapTransform(_doc, ret) {
  if (ret._id) delete ret._id;
  if (ret.size_stocks instanceof Map) {
    ret.size_stocks = Object.fromEntries(ret.size_stocks);
  }
  const norm = {};
  for (const k in (ret.size_stocks || {})) {
    norm[String(k)] = Number(ret.size_stocks[k] || 0);
  }
  ret.size_stocks = norm;
  return ret;
}

// Tính tổng tồn & danh sách size từ size_stocks
function syncStockAndSizes(doc) {
  if (!(doc.size_stocks instanceof Map)) {
    doc.size_stocks = new Map(Object.entries(doc.size_stocks || {}));
  }
  let total = 0;
  const sizes = [];
  for (const [k, v] of doc.size_stocks.entries()) {
    const qty = Number(v || 0);
    total += qty;
    // dùng string để FE tra theo "38"
    const key = String(k);
    if (!sizes.includes(key)) sizes.push(key);
    // đảm bảo giá trị trong Map là Number
    doc.size_stocks.set(key, qty);
  }
  doc.stock = total;
  doc.sizes = sizes.sort(); // tùy bạn có muốn sort không
}

// Đồng bộ trước khi lưu
ProductSchema.pre('save', function(next) {
  syncStockAndSizes(this);
  // optional: tự tính final_price
  if (typeof this.price === 'number' && typeof this.discount === 'number') {
    this.final_price = Math.round(this.price * (1 - this.discount / 100));
  }
  next();
});

// Đồng bộ khi update bằng findOneAndUpdate (các route admin inventory)
ProductSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate() || {};
  // nếu update size_stocks, đồng bộ lại stock & sizes thông qua pipeline
  if (update.size_stocks || (update.$set && update.$set.size_stocks)) {
    const set = update.$set || update;
    const raw = set.size_stocks || {};
    // ép về object thuần (trường hợp client gửi Map)
    const obj = raw instanceof Map ? Object.fromEntries(raw) : raw;

    // tính tổng và sizes
    const sizes = Object.keys(obj).map(String);
    const total = sizes.reduce((sum, k) => sum + Number(obj[k] || 0), 0);

    set.sizes = sizes;
    set.stock = total;
    set.size_stocks = obj; // để mongoose tự lưu thành Map
    update.$set = set;
  }

  // optional final_price khi update
  if (update.price !== undefined || (update.$set && update.$set.price !== undefined) ||
      update.discount !== undefined || (update.$set && update.$set.discount !== undefined)) {
    const price = (update.$set?.price ?? update.price);
    const discount = (update.$set?.discount ?? update.discount);
    if (price !== undefined || discount !== undefined) {
      const p = Number(price ?? this.get('price') ?? 0);
      const d = Number(discount ?? this.get('discount') ?? 0);
      const fp = Math.round(p * (1 - d / 100));
      if (!update.$set) update.$set = {};
      update.$set.final_price = fp;
    }
  }

  next();
});

// Index hỗ trợ tìm kiếm nhanh theo tên/brand
ProductSchema.index({ name: 'text', brand: 'text' });

module.exports = mongoose.models.Product || mongoose.model('Product', ProductSchema);

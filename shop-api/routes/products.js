// routes/products.js
const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

// Chuẩn hoá Map -> Object và ép key size thành string
const normalize = (doc) => {
  const p = doc.toObject ? doc.toObject() : { ...doc };
  if (p.size_stocks instanceof Map) {
    p.size_stocks = Object.fromEntries(p.size_stocks);
  }
  const out = {};
  for (const k in p.size_stocks || {}) out[String(k)] = Number(p.size_stocks[k] || 0);
  p.size_stocks = out;
  return p;
};

// GET /api/products  -> danh sách sản phẩm (public)
router.get("/", async (_req, res) => {
  try {
    const list = await Product.find({}).sort({ id: 1 });
    res.json(list.map(normalize));
  } catch (e) {
    console.error("❌ Lỗi tải list products:", e);
    res.status(500).json({ message: "Lỗi server khi tải sản phẩm." });
  }
});

// GET /api/products/:id  -> chi tiết theo id (public)
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID không hợp lệ" });

    const p = await Product.findOne({ id });
    if (!p) return res.status(404).json({ message: "Không tìm thấy sản phẩm" });

    res.json(normalize(p));
  } catch (e) {
    console.error("❌ Lỗi lấy chi tiết sản phẩm:", e);
    res.status(500).json({ message: "Lỗi server khi lấy chi tiết sản phẩm." });
  }
});

module.exports = router;

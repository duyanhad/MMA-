// routes/inventory.js
const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const { verifyToken, isAdmin } = require("../middleware/auth");

// ✅ API 1: Lấy toàn bộ danh sách sản phẩm (cho quản lý kho)
router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const products = await Product.find().sort({ id: 1 });
    res.status(200).json(products);
  } catch (err) {
    console.error("❌ Lỗi tải kho:", err);
    res.status(500).json({ message: "Lỗi server khi tải danh sách sản phẩm." });
  }
});

// ✅ API 2: Cập nhật số lượng tồn kho thủ công
router.put("/update-stock", verifyToken, isAdmin, async (req, res) => {
  try {
    const { productId, change } = req.body;
    if (!productId || change === undefined) {
      return res.status(400).json({ message: "Thiếu thông tin sản phẩm hoặc thay đổi tồn kho." });
    }

    const product = await Product.findOne({ id: productId });
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }

    // Nếu chưa có trường stock thì khởi tạo mặc định = 0
    if (typeof product.stock !== "number") product.stock = 0;

    product.stock = Math.max(0, product.stock + change);
    await product.save();

    res.status(200).json({ message: "Cập nhật tồn kho thành công.", product });
  } catch (err) {
    console.error("❌ Lỗi cập nhật tồn kho:", err);
    res.status(500).json({ message: "Lỗi server khi cập nhật tồn kho." });
  }
});

// ✅ API 3: Khi Admin duyệt đơn hàng thì tự động trừ tồn kho
// (được gọi từ /api/admin/orders/:id/status khi status = "Delivered")
router.post("/deduct", verifyToken, isAdmin, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Danh sách sản phẩm không hợp lệ." });
    }

    for (const item of items) {
      const product = await Product.findOne({ id: item.product_id });
      if (product) {
        if (typeof product.stock !== "number") product.stock = 0;
        product.stock = Math.max(0, product.stock - (item.quantity || 0));
        await product.save();
      }
    }

    res.status(200).json({ message: "Đã trừ số lượng sản phẩm theo đơn hàng." });
  } catch (err) {
    console.error("❌ Lỗi khi trừ số lượng:", err);
    res.status(500).json({ message: "Lỗi server khi trừ tồn kho." });
  }
});

module.exports = router;

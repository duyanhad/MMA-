// routes/inventory.js
const express = require("express");

/**
 * Router Kho hàng (Inventory).
 * Mount trong app.js:
 *   const inventoryRoutes = require("./routes/inventory")(Product);
 *   app.use("/api/admin/inventory", verifyToken, isAdmin, inventoryRoutes);
 */
module.exports = function inventoryRoutesFactory(Product) {
  const router = express.Router();

  // Helper: chuẩn hoá id từ params/body
  const normalizeId = (raw) => {
    if (raw === undefined || raw === null) return NaN;
    // chấp nhận " 12 ", "12", 12
    const n = Number(String(raw).trim());
    return Number.isFinite(n) ? n : NaN;
  };

  // Helper: bỏ _id, __v
  const leanProduct = (p) => {
    const obj = p.toObject ? p.toObject() : p;
    delete obj.__v;
    delete obj._id;
    return obj;
  };

  // ========== GET: danh sách tồn kho ==========
  router.get("/", async (req, res) => {
    try {
      const products = await Product.find({}).sort({ id: 1 });
      res.json(products.map(leanProduct));
    } catch (e) {
      console.error("❌ Lỗi tải kho:", e);
      res.status(500).json({ message: "Lỗi server khi tải kho." });
    }
  });

  // ========== PUT: cập nhật tồn kho nhanh (±) ==========
  // body: { productId?: number|string, id?: number|string, change: number|string }
  router.put("/update-stock", async (req, res) => {
    try {
      const rawId = req.body?.productId ?? req.body?.id;
      const rawChange = req.body?.change;
      const productId = normalizeId(rawId);
      const change = normalizeId(rawChange);

      // Log để debug nhanh khi phía client gửi sai key
      console.log("📦 update-stock payload:", req.body);

      if (!Number.isFinite(productId)) {
        return res.status(400).json({ message: "ID không hợp lệ." });
      }
      if (!Number.isFinite(change) || change === 0) {
        return res.status(400).json({ message: "Giá trị thay đổi không hợp lệ." });
      }

      const product = await Product.findOne({ id: productId });
      if (!product) return res.status(404).json({ message: "Không tìm thấy sản phẩm." });

      const oldStock = Number(product.stock || 0);
      const newStock = Math.max(0, oldStock + change);
      product.stock = newStock;
      await product.save();

      // realtime cho dashboard/kho
      try { req.app.get("socketio")?.emit("inventoryChanged", { id: product.id, stock: product.stock }); } catch {}

      res.json({
        message: "Cập nhật tồn kho thành công!",
        product: { id: product.id, name: product.name, stock: product.stock },
      });
    } catch (e) {
      console.error("❌ Lỗi cập nhật tồn kho:", e);
      res.status(500).json({ message: "Lỗi server khi cập nhật tồn kho." });
    }
  });

  // ========== POST: thêm sản phẩm ==========
  // body: { name, brand, category, price, discount, sizes[], image_url, description, stock }
  router.post("/", async (req, res) => {
    try {
      const {
        id, // nếu gửi kèm id cũ thì bỏ qua, id sẽ auto-increment
        name, brand, category, price, discount = 0,
        sizes = [], image_url = "", description = "", stock = 0,
      } = req.body || {};

      if (!name || String(name).trim() === "") {
        return res.status(400).json({ message: "Tên sản phẩm không được bỏ trống." });
      }
      if (!Number.isFinite(Number(price))) {
        return res.status(400).json({ message: "Giá không hợp lệ." });
      }

      // Lấy id mới (auto-increment theo trường id Number)
      const last = await Product.findOne().sort({ id: -1 });
      const nextId = last ? (Number(last.id) + 1) : 1;

      const sizesArr = Array.isArray(sizes)
        ? sizes
        : String(sizes || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

      const p = new Product({
        id: nextId,
        name: String(name).trim(),
        brand: String(brand || "").trim(),
        category: String(category || "").trim(),
        price: Number(price),
        discount: Number(discount || 0),
        sizes: sizesArr,
        image_url: String(image_url || "").trim(),
        description: String(description || "").trim(),
        stock: Number(stock || 0),
        created_at: new Date(),
      });
      await p.save();

      try { req.app.get("socketio")?.emit("inventoryChanged", { id: p.id, stock: p.stock }); } catch {}

      res.status(201).json({ message: "Đã thêm sản phẩm.", product: leanProduct(p) });
    } catch (e) {
      console.error("❌ Lỗi thêm sản phẩm:", e);
      res.status(500).json({ message: "Lỗi server khi thêm sản phẩm." });
    }
  });

  // ========== PUT: sửa sản phẩm theo id ==========
  router.put("/:id", async (req, res) => {
    try {
      const id = normalizeId(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "ID không hợp lệ." });

      const payload = { ...req.body };
      // đảm bảo các field số
      if (payload.price != null) payload.price = Number(payload.price);
      if (payload.discount != null) payload.discount = Number(payload.discount);
      if (payload.stock != null) payload.stock = Math.max(0, Number(payload.stock) || 0);
      if (payload.sizes != null && !Array.isArray(payload.sizes)) {
        payload.sizes = String(payload.sizes)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      // Không cho đổi id qua body
      delete payload.id;

      const p = await Product.findOneAndUpdate({ id }, payload, { new: true });
      if (!p) return res.status(404).json({ message: "Không tìm thấy sản phẩm." });

      try { req.app.get("socketio")?.emit("inventoryChanged", { id: p.id, stock: p.stock }); } catch {}

      res.json({ message: "Đã cập nhật sản phẩm.", product: leanProduct(p) });
    } catch (e) {
      console.error("❌ Lỗi sửa sản phẩm:", e);
      res.status(500).json({ message: "Lỗi server khi sửa sản phẩm." });
    }
  });

  // ========== DELETE: xoá sản phẩm theo id ==========
  router.delete("/:id", async (req, res) => {
    try {
      const id = normalizeId(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "ID không hợp lệ." });

      const p = await Product.findOneAndDelete({ id });
      if (!p) return res.status(404).json({ message: "Không tìm thấy sản phẩm." });

      try { req.app.get("socketio")?.emit("inventoryChanged", { id: p.id, stock: 0 }); } catch {}

      res.json({ message: "Đã xoá sản phẩm.", product: leanProduct(p) });
    } catch (e) {
      console.error("❌ Lỗi xoá sản phẩm:", e);
      res.status(500).json({ message: "Lỗi server khi xoá sản phẩm." });
    }
  });

  return router;
};

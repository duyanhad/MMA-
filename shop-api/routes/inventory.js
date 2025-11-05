// routes/inventory.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Product = require("../models/Product");

// ✅ Lấy secret từ .env (an toàn hơn hard-code)
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_IN_ENV_FILE";

/* -------------------------- AUTH MIDDLEWARES -------------------------- */
const verifyToken = (req, res, next) => {
  try {
    const token = (req.headers["authorization"] || "").split(" ")[1];
    if (!token) return res.status(401).json({ message: "Không tìm thấy token." });

    jwt.verify(token, JWT_SECRET, (err, payload) => {
      if (err) return res.status(403).json({ message: "Token không hợp lệ." });
      req.user = payload; // { userId, email, role }
      next();
    });
  } catch (e) {
    return res.status(401).json({ message: "Token không hợp lệ." });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user?.role === "admin") return next();
  return res.status(403).json({ message: "Yêu cầu quyền Admin." });
};

/* ------------------------------- HELPERS ------------------------------ */
// Chuyển Mongo Map -> plain object để client (RN) đọc được
const mapToObj = (doc) => {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  if (obj.size_stocks && obj.size_stocks instanceof Map) {
    obj.size_stocks = Object.fromEntries(obj.size_stocks);
  }
  return obj;
};

// Tính tổng stock từ size_stocks
const sumSizeStocks = (sizeMap) =>
  Array.from(sizeMap.values()).reduce((s, v) => s + Number(v || 0), 0);

/* --------------------------------- GET -------------------------------- */
// ✅ Lấy toàn bộ sản phẩm (trả full fields, gồm cả description)
router.get("/", verifyToken, isAdmin, async (_req, res) => {
  try {
    const products = await Product.find({}).sort({ id: 1 });
    res.json(products.map(mapToObj));
  } catch (e) {
    console.error("❌ Lỗi tải kho:", e);
    res.status(500).json({ message: "Lỗi server khi tải kho." });
  }
});

/* ----------------------------- PUT CỤ THỂ TRƯỚC ----------------------- */
// ⚠️ Đặt TRƯỚC route /:id, để không bị khớp nhầm

// Tăng/giảm stock tổng
router.put("/update-stock", verifyToken, isAdmin, async (req, res) => {
  try {
    const productId = Number(req.body.productId);
    const change = Number(req.body.change || 0);
    if (!Number.isFinite(productId)) {
      return res.status(400).json({ message: "ID không hợp lệ." });
    }
    const p = await Product.findOne({ id: productId });
    if (!p) return res.status(404).json({ message: "Không tìm thấy sản phẩm." });

    p.stock = Math.max(0, (p.stock || 0) + change);
    await p.save();
    res.json({ message: "Cập nhật thành công", product: mapToObj(p) });
  } catch (e) {
    console.error("❌ Lỗi cập nhật stock:", e);
    res.status(500).json({ message: "Lỗi server khi cập nhật tồn kho." });
  }
});

// Tăng/giảm theo size
router.put("/update-size", verifyToken, isAdmin, async (req, res) => {
  try {
    const productId = Number(req.body.productId);
    const size = String(req.body.size || "").trim();
    const change = Number(req.body.change || 0);

    if (!Number.isFinite(productId) || !size) {
      return res.status(400).json({ message: "ID hoặc size không hợp lệ." });
    }

    const p = await Product.findOne({ id: productId });
    if (!p) return res.status(404).json({ message: "Không tìm thấy sản phẩm." });

    if (!(p.size_stocks instanceof Map)) p.size_stocks = new Map();
    const cur = Number(p.size_stocks.get(size) || 0);
    const next = Math.max(0, cur + change);
    p.size_stocks.set(size, next);

    // Đồng bộ tổng & danh sách size
    p.stock = sumSizeStocks(p.size_stocks);
    if (!Array.isArray(p.sizes)) p.sizes = [];
    if (!p.sizes.includes(size)) p.sizes.push(size);

    await p.save();
    res.json({ message: "Cập nhật size thành công", product: mapToObj(p) });
  } catch (e) {
    console.error("❌ Lỗi update-size:", e);
    res.status(500).json({ message: "Lỗi server khi cập nhật size." });
  }
});

// Set số lượng 1 size (nhập trực tiếp)
router.put("/set-size", verifyToken, isAdmin, async (req, res) => {
  try {
    const productId = Number(req.body.productId);
    const size = String(req.body.size || "").trim();
    const quantity = Number(req.body.quantity || 0);

    if (!Number.isFinite(productId) || !size || !Number.isFinite(quantity)) {
      return res.status(400).json({ message: "Dữ liệu không hợp lệ." });
    }

    const p = await Product.findOne({ id: productId });
    if (!p) return res.status(404).json({ message: "Không tìm thấy sản phẩm." });

    if (!(p.size_stocks instanceof Map)) p.size_stocks = new Map();
    p.size_stocks.set(size, Math.max(0, quantity));

    // Đồng bộ tổng & danh sách size
    p.stock = sumSizeStocks(p.size_stocks);
    if (!Array.isArray(p.sizes)) p.sizes = [];
    if (!p.sizes.includes(size)) p.sizes.push(size);

    await p.save();
    res.json({ message: "Đã đặt số lượng size", product: mapToObj(p) });
  } catch (e) {
    console.error("❌ Lỗi set-size:", e);
    res.status(500).json({ message: "Lỗi server khi đặt số lượng size." });
  }
});

/* -------------------------- GET/POST/PUT/DELETE by id ----------------- */
// Lấy chi tiết 1 sản phẩm theo id (id tự tăng)
router.get("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "ID không hợp lệ." });
    }
    const p = await Product.findOne({ id });
    if (!p) return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    res.json(mapToObj(p));
  } catch (e) {
    console.error("❌ Lỗi lấy chi tiết:", e);
    res.status(500).json({ message: "Lỗi server khi lấy chi tiết sản phẩm." });
  }
});

/* --------------------------------- POST ------------------------------- */
// Tạo sản phẩm mới
router.post("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, brand, category, price, discount, description, image_url } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ message: "Thiếu name hoặc price." });
    }

    // Tính id tự tăng
    const last = await Product.findOne().sort({ id: -1 });
    const nextId = last ? last.id + 1 : 1;

    // Chuẩn hóa size_stocks
    const sizeMap = new Map(Object.entries(req.body.size_stocks || {}));
    const total = sumSizeStocks(sizeMap);

    const doc = new Product({
      id: nextId,
      name,
      brand,
      category,
      price,
      discount: discount || 0,
      description: description || "",
      image_url: image_url || "",
      size_stocks: sizeMap,
      stock: total,
      sizes: Array.from(sizeMap.keys()),
    });

    await doc.save();
    const obj = mapToObj(doc);
    return res.status(201).json({ message: "Tạo sản phẩm thành công", product: obj });
  } catch (e) {
    console.error("❌ Lỗi tạo sản phẩm:", e);
    res.status(500).json({ message: "Lỗi server khi tạo sản phẩm." });
  }
});

/* ---------------------------------- PUT ------------------------------- */
// Cập nhật toàn bộ trường sản phẩm theo id
router.put("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "ID không hợp lệ." });
    }

    const p = await Product.findOne({ id });
    if (!p) return res.status(404).json({ message: "Không tìm thấy sản phẩm." });

    const fields = ["name", "brand", "category", "price", "discount", "description", "image_url"];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) p[f] = req.body[f];
    });

    if (req.body.size_stocks) {
      const sizeMap = new Map(Object.entries(req.body.size_stocks));
      p.size_stocks = sizeMap;
      p.sizes = Array.from(sizeMap.keys());
      p.stock = sumSizeStocks(sizeMap);
    }

    await p.save();
    res.json({ message: "Cập nhật sản phẩm thành công", product: mapToObj(p) });
  } catch (e) {
    console.error("❌ Lỗi cập nhật sản phẩm:", e);
    res.status(500).json({ message: "Lỗi server khi cập nhật sản phẩm." });
  }
});

/* -------------------------------- DELETE ------------------------------ */
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "ID không hợp lệ." });
    }
    const p = await Product.findOneAndDelete({ id });
    if (!p) return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    res.json({ message: "Đã xóa sản phẩm." });
  } catch (e) {
    console.error("❌ Lỗi xóa sản phẩm:", e);
    res.status(500).json({ message: "Lỗi server khi xóa sản phẩm." });
  }
});

module.exports = router;

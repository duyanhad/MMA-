// routes/orders.js
const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Product = require("../models/Product");

// ✅ Lấy danh sách đơn (admin xem) — luôn trả MẢNG
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find().sort({ created_at: -1 });
    return res.status(200).json(Array.isArray(orders) ? orders : []);
  } catch (error) {
    console.error("❌ Lỗi tải đơn hàng:", error);
    // Trả [] để client không bị .filter crash
    return res.status(500).json([]);
  }
});

// ✅ Khách hàng tạo đơn hàng (checkout) — emit thông báo cho admin
router.post("/", async (req, res) => {
  try {
    const io = req.app.get("socketio");
    const {
      user_id,
      customer_name,
      customer_email,
      shipping_address,
      phone_number,
      payment_method,
      notes,
      total_amount,
      items,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Giỏ hàng trống" });
    }

    // tạo id tự tăng đơn giản
    const last = await Order.findOne().sort({ id: -1 });
    const nextId = last ? last.id + 1 : 1;
    const orderCode = `#S${new Date().getFullYear()}${String(nextId).padStart(4, "0")}`;

    const newOrder = await Order.create({
      id: nextId,
      order_code: orderCode,
      user_id,
      customer_name,
      customer_email,
      shipping_address,
      phone_number,
      payment_method: payment_method || "COD",
      notes: notes || "",
      total_amount,
      items,
      status: "Pending",
      created_at: new Date(),
    });

    // 🔔 Emit tới admin dashboard
    if (io) {
      io.emit("newOrder", {
        id: newOrder.id,
        order_code: newOrder.order_code,
        customer_name: newOrder.customer_name,
        total_amount: newOrder.total_amount,
        created_at: newOrder.created_at,
      });
    }

    return res.status(201).json({ message: "Đặt hàng thành công!", order: newOrder });
  } catch (error) {
    console.error("❌ Lỗi tạo đơn:", error);
    return res.status(500).json({ message: "Lỗi server khi tạo đơn hàng" });
  }
});

// ✅ Admin cập nhật trạng thái đơn — nếu Delivered thì trừ kho
router.put("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });

    if (order.status !== "Delivered" && status === "Delivered") {
      await Promise.all(
        order.items.map(async (item) => {
          try {
            const product = await Product.findById(item.product_id);
            if (product) {
              const newStock = Math.max(0, (product.stock || 0) - (item.quantity || 0));
              product.stock = newStock;
              await product.save();
            }
          } catch (err) {
            console.error("❌ Lỗi khi cập nhật sản phẩm:", err);
          }
        })
      );
    }

    order.status = status;
    await order.save();

    return res.status(200).json({ message: "Cập nhật đơn hàng thành công!", order });
  } catch (error) {
    console.error("❌ Lỗi cập nhật trạng thái:", error);
    return res.status(500).json({ message: "Lỗi server khi cập nhật đơn hàng." });
  }
});

module.exports = router;

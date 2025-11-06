// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // Để khớp với app.js (JWT đang dùng user.id)
    id:       { type: Number, unique: true, sparse: true },

    // Schema cũ yêu cầu username — giữ lại để tương thích
    username: { type: String, required: true },

    // BE hiện tạo bằng trường "name" => chấp nhận luôn
    name:     { type: String },

    email:    { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },

    role:     { type: String, default: "customer" }, // "admin" | "customer"
    isBlocked:{ type: Boolean, default: false },
  },
  { timestamps: true }
);

// Nếu chỉ gửi "name" mà thiếu "username", tự map trước khi lưu
userSchema.pre("save", function (next) {
  if (!this.username && this.name) this.username = this.name;
  next();
});

// Tránh OverwriteModelError khi hot-reload/nodemon
module.exports = mongoose.models.User || mongoose.model("User", userSchema);

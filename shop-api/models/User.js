// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email:    { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role:     { type: String, default: "user" }, // có thể là 'admin' hoặc 'user'
  },
  { timestamps: true }
);

// ✅ Dòng này rất quan trọng để tránh OverwriteModelError khi hot reload hoặc require lại
module.exports = mongoose.models.User || mongoose.model("User", userSchema);

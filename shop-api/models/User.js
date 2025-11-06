// shop-api/models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // để khớp với các API khác (JWT dùng user.id)
    id:        { type: Number, unique: true, sparse: true },

    // tên hiển thị
    name:      { type: String, required: true },

    // yêu cầu username, nhưng mặc định lấy từ name
    username:  {
      type: String,
      required: true,
      default: function () {
        return this.name;
      },
      trim: true,
    },

    email:     { type: String, required: true, unique: true, index: true, trim: true },
    password:  { type: String, required: true },

    role:      { type: String, default: "customer" }, // "admin" | "customer"
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Backup: nếu vì lý do gì đó default chưa set, đảm bảo username có giá trị trước khi save
userSchema.pre("save", function (next) {
  if (!this.username && this.name) this.username = this.name;
  next();
});

// Tránh OverwriteModelError khi nodemon reload
module.exports = mongoose.models.User || mongoose.model("User", userSchema);

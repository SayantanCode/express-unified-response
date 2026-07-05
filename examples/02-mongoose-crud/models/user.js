const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Email must be a valid address"],
    },
    role: {
      type: String,
      enum: { values: ["user", "admin"], message: "Role must be 'user' or 'admin'" },
      default: "user",
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
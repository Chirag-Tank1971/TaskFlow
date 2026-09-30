const mongoose = require("mongoose");

const agentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Available", "Not-Available", "Decommissioned"],
      default: "Available",
    },
    role: {
      type: String,
      enum: ["agent"],
      default: "agent",
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        return ret;
      },
    },
    toObject: {
      transform: function (doc, ret) {
        delete ret.password;
        return ret;
      },
    },
  }
);

// Indexes for performance
agentSchema.index({ status: 1 });
agentSchema.index({ createdAt: -1 });
agentSchema.index({ updatedAt: -1 });

module.exports = mongoose.model("Agent", agentSchema);
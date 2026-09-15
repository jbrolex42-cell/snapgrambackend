const mongoose = require("mongoose");

const userSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    tokenId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
    },

    deviceName: {
      type: String,
      default: "Unknown device",
      trim: true,
      maxlength: 200,
    },

    platform: {
      type: String,
      default: "Unknown",
      trim: true,
      maxlength: 100,
    },

    userAgent: {
      type: String,
      default: "",
      maxlength: 1000,
    },

    ipAddress: {
      type: String,
      default: "",
      maxlength: 100,
    },

    location: {
      type: String,
      default: "Unknown location",
      maxlength: 200,
    },

    lastSeen: {
      type: Date,
      default: Date.now,
    },

    revokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSessionSchema.index({
  user: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "UserSession",
  userSessionSchema
);
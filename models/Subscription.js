const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    plan: {
      type: String,
      enum: ["free", "creator", "pro", "business"],
      default: "free",
      required: true,
    },

    status: {
      type: String,
      enum: [
        "active",
        "expired",
        "cancelled",
        "pending",
        "past_due",
      ],
      default: "active",
      required: true,
    },

    currency: {
      type: String,
      default: "KES",
      uppercase: true,
    },

    price: {
      type: Number,
      default: 0,
      min: 0,
    },

    interval: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    autoRenew: {
      type: Boolean,
      default: false,
    },

    lastPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentTransaction",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Subscription",
  subscriptionSchema
);
const mongoose = require("mongoose");

const earningSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    source: {
      type: String,
      enum: [
        "gift",
        "subscription",
        "ads",
        "bonus",
        "other",
      ],
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "USD",
      uppercase: true,
      trim: true,
      maxlength: 10,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "completed",
        "paid",
        "failed",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },

    reference: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    gift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gift",
      default: null,
      index: true,
    },

    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },

    reel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

earningSchema.index({
  user: 1,
  createdAt: -1,
});

earningSchema.index({
  user: 1,
  status: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "Earning",
  earningSchema
);
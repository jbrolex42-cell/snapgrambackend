const mongoose = require("mongoose");

const payoutSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    payoutMethod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayoutMethod",
      default: null,
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
        "processing",
        "paid",
        "failed",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },

    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    provider: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },

    providerTransactionId: {
      type: String,
      default: null,
      trim: true,
    },

    failureReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    requestedAt: {
      type: Date,
      default: Date.now,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

payoutSchema.index({
  user: 1,
  createdAt: -1,
});

payoutSchema.index({
  user: 1,
  status: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "Payout",
  payoutSchema
);
const mongoose = require("mongoose");

const PAYMENT_PLANS = [
  "free",
  "plus",
  "pro",
  "premium",
];

const PAYMENT_STATUSES = [
  "pending",
  "completed",
  "failed",
  "cancelled",
];

const paymentTransactionSchema = new mongoose.Schema(
  {

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
      index: true,
    },

    plan: {
      type: String,
      required: true,
      enum: PAYMENT_PLANS,
      lowercase: true,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "KES",
      uppercase: true,
      trim: true,
    },

    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },

    provider: {
      type: String,
      enum: ["mpesa"],
      default: "mpesa",
      lowercase: true,
    },

    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "pending",
      index: true,
      lowercase: true,
    },

    merchantRequestId: {
      type: String,
      default: undefined,
      trim: true,
    },

    checkoutRequestId: {
      type: String,
      default: undefined,
      trim: true,
    },

    mpesaReceiptNumber: {
      type: String,
      default: undefined,
      trim: true,
    },

    resultCode: {
      type: Number,
      default: null,
    },

    resultDescription: {
      type: String,
      default: "",
      trim: true,
    },

    transactionDate: {
      type: Date,
      default: null,
    },

    callbackPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },

  {
    timestamps: true,
  }
);

paymentTransactionSchema.index(
  { checkoutRequestId: 1 },
  {
    unique: true,
    sparse: true,
    name: "checkoutRequestId_unique",
  }
);

paymentTransactionSchema.index(
  { merchantRequestId: 1 },
  {
    unique: true,
    sparse: true,
    name: "merchantRequestId_unique",
  }
);

paymentTransactionSchema.index({
  user: 1,
  createdAt: -1,
});

paymentTransactionSchema.index({
  status: 1,
  createdAt: -1,
});

paymentTransactionSchema.index({
  subscription: 1,
  createdAt: -1,
});

paymentTransactionSchema.statics.getPaymentPlans =
  function () {
    return PAYMENT_PLANS;
  };

paymentTransactionSchema.statics.isValidPlan =
  function (plan) {
    return PAYMENT_PLANS.includes(
      String(plan || "")
        .trim()
        .toLowerCase()
    );
  };

module.exports = mongoose.model(
  "PaymentTransaction",
  paymentTransactionSchema
);
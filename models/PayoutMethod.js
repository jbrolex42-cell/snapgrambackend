const mongoose = require("mongoose");

const payoutMethodSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "bank_account",
        "mobile_money",
        "paypal",
        "other",
      ],
      required: true,
    },

    provider: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },

    accountName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 150,
    },

    /*
     * Do not return sensitive account information
     * directly to the mobile application.
     *
     * Prefer storing a provider/token reference.
     */
    providerAccountId: {
      type: String,
      default: null,
      select: false,
    },

    last4: {
      type: String,
      default: null,
      trim: true,
      maxlength: 4,
    },

    email: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },

    country: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
      maxlength: 3,
    },

    currency: {
      type: String,
      default: "USD",
      trim: true,
      uppercase: true,
      maxlength: 10,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    isDefault: {
      type: Boolean,
      default: true,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "verified",
        "disabled",
      ],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "PayoutMethod",
  payoutMethodSchema
);
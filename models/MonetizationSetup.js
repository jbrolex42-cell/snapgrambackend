const mongoose = require("mongoose");

const monetizationSetupSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    setupStarted: {
      type: Boolean,
      default: false,
    },

    setupComplete: {
      type: Boolean,
      default: false,
    },

    paymentInformationComplete: {
      type: Boolean,
      default: false,
    },

    taxInformationComplete: {
      type: Boolean,
      default: false,
    },

    preferencesComplete: {
      type: Boolean,
      default: false,
    },

    payoutMethod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayoutMethod",
      default: null,
    },

    taxCountry: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 3,
      default: null,
    },

    taxStatus: {
      type: String,
      enum: [
        "not_started",
        "pending",
        "complete",
        "review",
        "rejected",
      ],
      default: "not_started",
    },

    taxInformationSubmittedAt: {
      type: Date,
      default: null,
    },

    payoutCurrency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 10,
      default: "KES",
    },

    preferences: {
      giftsEnabled: {
        type: Boolean,
        default: true,
      },

      subscriptionsEnabled: {
        type: Boolean,
        default: false,
      },

      adsEnabled: {
        type: Boolean,
        default: false,
      },

      notificationsEnabled: {
        type: Boolean,
        default: true,
      },
    },

    startedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "MonetizationSetup",
  monetizationSetupSchema
);
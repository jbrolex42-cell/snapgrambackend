const mongoose = require("mongoose");

const monetizationProfileSchema =
  new mongoose.Schema(
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
        index: true,
      },

      professionalAccount: {
        type: Boolean,
        default: false,
      },

      enabled: {
        type: Boolean,
        default: true,
      },

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

      policyStatus: {
        type: String,
        enum: [
          "eligible",
          "review",
          "limited",
          "restricted",
        ],
        default: "eligible",
      },

      policyMessage: {
        type: String,
        default: "",
        maxlength: 1000,
      },

      manuallyReviewed: {
        type: Boolean,
        default: false,
      },

      reviewedAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

module.exports = mongoose.model(
  "MonetizationProfile",
  monetizationProfileSchema
);
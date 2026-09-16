const mongoose = require("mongoose");

const giftSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    giftType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    giftName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    coins: {
      type: Number,
      required: true,
      min: 1,
    },

    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
      index: true,
    },

    reel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
      index: true,
    },

    message: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "completed",
        "failed",
        "refunded",
      ],
      default: "completed",
      index: true,
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

giftSchema.index({
  recipient: 1,
  createdAt: -1,
});

giftSchema.index({
  sender: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Gift", giftSchema);
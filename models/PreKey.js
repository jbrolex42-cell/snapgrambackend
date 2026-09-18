const mongoose = require("mongoose");

const preKeySchema = new mongoose.Schema(
  {
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      required: true,
      index: true,
    },

    keyId: {
      type: Number,
      required: true,
    },

    publicKey: {
      type: String,
      required: true,
      trim: true,
    },

    consumed: {
      type: Boolean,
      default: false,
      index: true,
    },

    consumedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

preKeySchema.index(
  {
    device: 1,
    keyId: 1,
  },
  {
    unique: true,
  }
);

module.exports =
  mongoose.models.PreKey ||
  mongoose.model("PreKey", preKeySchema);
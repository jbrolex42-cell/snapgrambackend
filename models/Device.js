const mongoose = require("mongoose");

const signedPreKeySchema = new mongoose.Schema(
  {
    keyId: {
      type: Number,
      required: true,
    },

    publicKey: {
      type: String,
      required: true,
      trim: true,
    },

    signature: {
      type: String,
      required: true,
      trim: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const kyberPreKeySchema = new mongoose.Schema(
  {
    keyId: {
      type: Number,
      required: true,
    },

    publicKey: {
      type: String,
      required: true,
      trim: true,
    },

    signature: {
      type: String,
      required: true,
      trim: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const deviceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    deviceId: {
      type: Number,
      required: true,
      min: 1,
      max: 2147483647,
    },

    registrationId: {
      type: Number,
      required: true,
    },

    identityKey: {
      type: String,
      required: true,
      trim: true,
    },

    signedPreKey: {
      type: signedPreKeySchema,
      required: true,
    },

    kyberPreKey: {
      type: kyberPreKeySchema,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

deviceSchema.index(
  {
    user: 1,
    deviceId: 1,
  },
  {
    unique: true,
  }
);

module.exports =
  mongoose.models.Device ||
  mongoose.model("Device", deviceSchema);
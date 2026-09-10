const mongoose = require("mongoose");

const callSchema = new mongoose.Schema(
  {
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: ["voice", "video"],
      required: true,
    },

    participants: [
  {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
],

    status: {
      type: String,
      enum: [
        "calling",
        "ringing",
        "accepted",
        "rejected",
        "ended",
        "missed",
      ],
      default: "calling",
    },

    startedAt: {
      type: Date,
      default: null,
    },

    endedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

callSchema.index({
  caller: 1,
  createdAt: -1,
});

callSchema.index({
  receiver: 1,
  createdAt: -1,
});

callSchema.index({
  participants: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "Call",
  callSchema
);
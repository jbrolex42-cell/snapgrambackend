const mongoose = require("mongoose");

const callSchema = new mongoose.Schema(
  {
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["voice", "video"],
      required: true,
      index: true,
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
        "cancelled",
        "ended",
        "missed",
      ],
      default: "calling",
      index: true,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    answeredAt: {
      type: Date,
      default: null,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    duration: {
      type: Number,
      default: 0,
      min: 0,
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

callSchema.index({
  status: 1,
  createdAt: -1,
});

callSchema.index({
  caller: 1,
  receiver: 1,
  status: 1,
  createdAt: -1,
});

callSchema.index({
  receiver: 1,
  caller: 1,
  status: 1,
  createdAt: -1,
});

callSchema.pre("save", function (next) {
  const ids = new Set();

  if (Array.isArray(this.participants)) {
    for (const participant of this.participants) {
      if (participant) {
        ids.add(String(participant));
      }
    }
  }

  if (this.caller) {
    ids.add(String(this.caller));
  }

  if (this.receiver) {
    ids.add(String(this.receiver));
  }

  this.participants = [
    ...ids,
  ];

  next();
});

module.exports =
  mongoose.models.Call ||
  mongoose.model("Call", callSchema);
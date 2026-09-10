const mongoose = require("mongoose");

const liveSchema = new mongoose.Schema(
  {
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    status: {
      type: String,
      enum: ["scheduled", "live", "ended"],
      default: "live",
      index: true,
    },

    visibility: {
      type: String,
      enum: ["public", "followers"],
      default: "public",
      index: true,
    },

    thumbnail: {
      type: String,
      default: "",
    },

    viewerCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    peakViewerCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    commentsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    scheduledFor: {
      type: Date,
      default: null,
    },

    roomId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

liveSchema.index({
  host: 1,
  status: 1,
  createdAt: -1,
});

liveSchema.index({
  status: 1,
  createdAt: -1,
});

liveSchema.index({
  status: 1,
  startedAt: -1,
});

liveSchema.index({
  visibility: 1,
  status: 1,
  startedAt: -1,
});

liveSchema.pre("save", function (next) {
  if (this.viewerCount < 0) {
    this.viewerCount = 0;
  }

  if (this.peakViewerCount < this.viewerCount) {
    this.peakViewerCount = this.viewerCount;
  }

  if (this.likesCount < 0) {
    this.likesCount = 0;
  }

  if (this.commentsCount < 0) {
    this.commentsCount = 0;
  }

  next();
});

module.exports = mongoose.model("Live", liveSchema);
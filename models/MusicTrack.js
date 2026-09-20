const mongoose = require("mongoose");

const musicTrackSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    artist: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    album: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    artworkUrl: {
      type: String,
      default: "",
      trim: true,
    },

    audioUrl: {
      type: String,
      required: true,
      trim: true,
    },

    durationMs: {
      type: Number,
      required: true,
      min: 0,
    },

    provider: {
      type: String,
      default: "snapgram",
      trim: true,
    },

    providerTrackId: {
      type: String,
      required: true,
      trim: true,
    },

    genre: {
      type: String,
      default: "",
      trim: true,
    },

    explicit: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },

    playCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    useCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    territories: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

musicTrackSchema.index({
  title: "text",
  artist: "text",
  album: "text",
});

musicTrackSchema.index({
  isActive: 1,
  isFeatured: 1,
  useCount: -1,
  createdAt: -1,
});

musicTrackSchema.index({
  isActive: 1,
  playCount: -1,
  createdAt: -1,
});

module.exports = mongoose.model("MusicTrack", musicTrackSchema);
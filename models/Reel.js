const mongoose = require("mongoose");

const reelSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    video: {
      url: {
        type: String,
        required: true,
      },

      publicId: {
        type: String,
      },

      duration: {
        type: Number,
        default: 0,
      },
    },

    thumbnail: {
      url: {
        type: String,
        default: "",
      },

      publicId: {
        type: String,
        default: "",
      },
    },

    caption: {
      type: String,
      maxlength: 2200,
      default: "",
    },

    music: {
      name: {
        type: String,
        default: "",
      },

      artist: {
        type: String,
        default: "",
      },

      url: {
        type: String,
        default: "",
      },
    },

    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    commentsCount: {
      type: Number,
      default: 0,
    },

    sharesCount: {
      type: Number,
      default: 0,
    },

    saves: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    views: {
      type: Number,
      default: 0,
    },

    hashtags: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

reelSchema.index({
  createdAt: -1,
});

module.exports =
  mongoose.model("Reel", reelSchema);
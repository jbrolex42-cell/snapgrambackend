const mongoose = require("mongoose");

const mediaSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },

    publicId: {
      type: String,
      default: null,
      trim: true,
    },

    type: {
      type: String,
      enum: ["image", "video"],
      default: "image",
      required: true,
    },

    width: {
      type: Number,
      default: null,
    },

    height: {
      type: Number,
      default: null,
    },

    duration: {
      type: Number,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const locationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "",
    },

    latitude: {
      type: Number,
      default: null,
    },

    longitude: {
      type: Number,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const postSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    media: {
      type: [mediaSchema],
      required: true,
      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.length >= 1 &&
            value.length <= 10
          );
        },
        message: "A post must contain between 1 and 10 media files.",
      },
    },

    postType: {
      type: String,
      enum: ["post", "reel", "repost"],
      default: "post",
      required: true,
      index: true,
    },

    caption: {
      type: String,
      trim: true,
      maxlength: 2200,
      default: "",
    },

    location: {
      type: locationSchema,
      default: () => ({
        name: "",
        latitude: null,
        longitude: null,
      }),
    },

    taggedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    savedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    repostedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    repostOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
      index: true,
    },

    repostsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    commentsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    sharesCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    views: {
      type: Number,
      default: 0,
      min: 0,
    },

    visibility: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
      index: true,
    },

    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },

    archivedAt: {
      type: Date,
      default: null,
    },

    music: {
      trackId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MusicTrack",
        default: null,
      },

      title: {
        type: String,
        default: "",
        trim: true,
      },

      artist: {
        type: String,
        default: "",
        trim: true,
      },

      album: {
        type: String,
        default: "",
        trim: true,
      },

      artworkUrl: {
        type: String,
        default: "",
        trim: true,
      },

      provider: {
        type: String,
        default: "snapgram",
        trim: true,
      },
 
      providerTrackId: {
        type: String,
        default: "",
        trim: true,
      },

      startMs: {
        type: Number,
        default: 0,
         min: 0,
      },

      durationMs: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,
    },

    toObject: {
      virtuals: true,
    },
  }
);

postSchema.index({
  user: 1,
  postType: 1,
  isArchived: 1,
  createdAt: -1,
});

postSchema.index({
  savedBy: 1,
  createdAt: -1,
});

postSchema.index({
  likes: 1,
  createdAt: -1,
});

postSchema.index({
  taggedUsers: 1,
  createdAt: -1,
});

postSchema.index({
  repostOf: 1,
  createdAt: -1,
});

postSchema.index({
  user: 1,
  visibility: 1,
  createdAt: -1,
});

postSchema.index({
  user: 1,
  postType: 1,
  isArchived: 1,
  visibility: 1,
  createdAt: -1,
});

postSchema.index({
  "music.trackId": 1,
  createdAt: -1,
});

module.exports = mongoose.model("Post", postSchema);
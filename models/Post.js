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
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      maxlength: 300,
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
  { _id: false }
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
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length >= 1 && value.length <= 10;
        },
        message: "A post must contain between 1 and 10 media files.",
      },
      required: true,
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

    visibility: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
      index: true,
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

postSchema.virtual("likesCount").get(function () {
  return Array.isArray(this.likes) ? this.likes.length : 0;
});

module.exports = mongoose.model("Post", postSchema);
const mongoose = require("mongoose");

const highlightSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      trim: true,
      maxlength: 30,
      default: "Highlight",
    },

    coverUrl: {
      type: String,
      default: "",
    },

    storyIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Story",
      },
    ],
  },
  {
    timestamps: true,
  }
);

highlightSchema.index({ user: 1, createdAt: -1 });

module.exports =
  mongoose.models.Highlight ||
  mongoose.model("Highlight", highlightSchema);
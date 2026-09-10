const mongoose = require("mongoose");

const hashtagSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
      },

      posts: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Post",
        },
      ],
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "Hashtag",
    hashtagSchema
  );
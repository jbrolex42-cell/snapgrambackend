const mongoose =
  require("mongoose");

const commentSchema =
  new mongoose.Schema(
    {
      user: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      post: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Post",
        default: null,
      },

      reel: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Reel",
        default: null,
      },

      text: {
        type: String,
        required: true,
        maxlength: 1000,
      },

      likes: [
        {
          type:
            mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],

      parentComment: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Comment",
        default: null,
      },
    },

    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "Comment",
    commentSchema
  );
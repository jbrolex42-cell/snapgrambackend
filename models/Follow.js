const mongoose = require("mongoose");

const followSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate follows
followSchema.index(
  {
    follower: 1,
    following: 1,
  },
  {
    unique: true,
  }
);

// Find a user's followers efficiently
followSchema.index({
  following: 1,
  createdAt: -1,
});

// Find who a user follows efficiently
followSchema.index({
  follower: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Follow", followSchema);
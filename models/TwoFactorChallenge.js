const mongoose = require("mongoose");

const twoFactorChallengeSchema =
  new mongoose.Schema(
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      challengeToken: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      codeHash: {
        type: String,
        required: true,
      },

      attempts: {
        type: Number,
        default: 0,
        min: 0,
      },

      expiresAt: {
        type: Date,
        required: true,
        index: true,
      },

      verifiedAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

/*
 * MongoDB automatically removes expired
 * challenges.
 */
twoFactorChallengeSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  }
);

module.exports =
  mongoose.model(
    "TwoFactorChallenge",
    twoFactorChallengeSchema
  );
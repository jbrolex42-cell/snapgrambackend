const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {

    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      minlength: 6,
      select: false,
      default: null,
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      default: null,
    },

    facebookId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      default: null,
    },

    authProvider: {
      type: String,
      enum: ["local", "google", "facebook"],
      default: "local",
    },

    fullName: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "",
    },

    bio: {
      type: String,
      maxlength: 150,
      default: "",
    },

    avatar: {
      type: String,
      default: "",
    },

    website: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },

    pronouns: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "",
    },

    gender: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "",
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    verificationStatus: {
      type: String,
      enum: [
        "none",
        "pending",
        "approved",
        "rejected",
      ],
      default: "none",
    },

    isAdmin: {
      type: Boolean,
      default: false,
    },

    followersCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    followingCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    isPrivate: {
      type: Boolean,
      default: false,
    },

    isDeactivated: {
      type: Boolean,
      default: false,
      index: true,
    },

    deactivatedAt: {
      type: Date,
      default: null,
    },

    closeFriends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    mutedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    restrictedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    savedPosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
      },
    ],

    isOnline: {
      type: Boolean,
      default: false,
    },

    lastSeen: {
      type: Date,
      default: null,
    },

    passwordResetToken: {
      type: String,
      default: undefined,
    },

    passwordResetExpires: {
      type: Date,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
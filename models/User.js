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

    // --------------------------------------------------
    // VERIFICATION
    // --------------------------------------------------

    isVerified: {
      type: Boolean,
      default: false,
      index: true,
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
      index: true,
    },

    isAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },

    // --------------------------------------------------
    // FOLLOWERS
    // --------------------------------------------------

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

    // --------------------------------------------------
    // PRIVACY
    // --------------------------------------------------

    isPrivate: {
      type: Boolean,
      default: false,
      index: true,
    },

    // --------------------------------------------------
    // ACCOUNT STATUS
    // --------------------------------------------------

    isDeactivated: {
      type: Boolean,
      default: false,
      index: true,
    },

    deactivatedAt: {
      type: Date,
      default: null,
    },

    // --------------------------------------------------
    // CLOSE FRIENDS
    // --------------------------------------------------

    closeFriends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // --------------------------------------------------
    // BLOCKED USERS
    // --------------------------------------------------

    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // --------------------------------------------------
    // MUTED USERS
    // --------------------------------------------------

    mutedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // --------------------------------------------------
    // RESTRICTED USERS
    // --------------------------------------------------

    restrictedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // --------------------------------------------------
    // SAVED POSTS
    // --------------------------------------------------

    savedPosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
      },
    ],

    // --------------------------------------------------
    // ONLINE STATUS
    // --------------------------------------------------

    isOnline: {
      type: Boolean,
      default: false,
      index: true,
    },

    lastSeen: {
      type: Date,
      default: null,
    },

    // --------------------------------------------------
    // PASSWORD RESET
    // --------------------------------------------------

    passwordResetToken: {
      type: String,
      default: undefined,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      default: undefined,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// --------------------------------------------------
// INDEXES
// --------------------------------------------------

userSchema.index({
  username: 1,
});

userSchema.index({
  email: 1,
});

userSchema.index({
  isDeactivated: 1,
  createdAt: -1,
});

userSchema.index({
  verificationStatus: 1,
  createdAt: -1,
});

module.exports = mongoose.model("User", userSchema);
const User = require("../models/User");
const Post = require("../models/Post");

const uploadToCloudinary = require("../utils/uploadToCloudinary");

function formatUser(user) {
  return {
    _id: user._id,
    username: user.username,
    fullName: user.fullName || "",
    bio: user.bio || "",
    avatar: user.avatar || "",
    website: user.website || "",
    pronouns: user.pronouns || "",
    gender: user.gender || "",

    isVerified: Boolean(user.isVerified),

    verificationStatus:
      user.verificationStatus || "none",

    followersCount:
      Number(user.followersCount) || 0,

    followingCount:
      Number(user.followingCount) || 0,

    isPrivate: Boolean(user.isPrivate),
  };
}

async function getUserProfile(req, res) {
  try {
    const username = String(
      req.params.username || ""
    )
      .trim()
      .toLowerCase();

    if (!username) {
      return res.status(400).json({
        message: "Username is required",
      });
    }

    const user = await User.findOne({
      username,
    })
      .select(
        [
          "_id",
          "username",
          "fullName",
          "bio",
          "avatar",
          "website",
          "pronouns",
          "gender",
          "isVerified",
          "verificationStatus",
          "followersCount",
          "followingCount",
          "isPrivate",
          "createdAt",
        ].join(" ")
      )
      .lean();

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const currentUserId =
      req.user?._id?.toString();

    const profileUserId =
      user._id.toString();

    const isOwnProfile =
      currentUserId === profileUserId;

    return res.json({
      user: {
        ...formatUser(user),
        isFollowing: false,
        isOwnProfile,
      },
    });
  } catch (error) {
    console.error(
      "GET USER PROFILE ERROR:",
      error
    );

    return res.status(500).json({
      message: "Unable to load profile",
    });
  }
}

async function updateProfile(req, res) {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const user = await User.findById(
      req.user._id
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const username =
      typeof req.body?.username === "string"
        ? req.body.username.trim().toLowerCase()
        : user.username;

    if (!username) {
      return res.status(400).json({
        message: "Username is required",
      });
    }

    if (
      username.length < 3 ||
      username.length > 30
    ) {
      return res.status(400).json({
        message:
          "Username must be between 3 and 30 characters",
      });
    }

    if (!/^[a-z0-9._]+$/.test(username)) {
      return res.status(400).json({
        message:
          "Username can only contain letters, numbers, periods and underscores",
      });
    }

    if (username !== user.username) {
      const existingUser =
        await User.findOne({
          username,
          _id: {
            $ne: user._id,
          },
        })
          .select("_id")
          .lean();

      if (existingUser) {
        return res.status(409).json({
          message:
            "That username is already taken",
        });
      }
    }

    const fullName =
      typeof req.body?.fullName === "string"
        ? req.body.fullName.trim()
        : typeof req.body?.name === "string"
        ? req.body.name.trim()
        : user.fullName;

    if (fullName.length > 50) {
      return res.status(400).json({
        message:
          "Full name cannot exceed 50 characters",
      });
    }

    const bio =
      typeof req.body?.bio === "string"
        ? req.body.bio.trim()
        : user.bio;

    if (bio.length > 150) {
      return res.status(400).json({
        message:
          "Bio cannot exceed 150 characters",
      });
    }

    const website =
      typeof req.body?.website === "string"
        ? req.body.website.trim()
        : user.website;

    if (website.length > 300) {
      return res.status(400).json({
        message:
          "Website cannot exceed 300 characters",
      });
    }

    const pronouns =
      typeof req.body?.pronouns === "string"
        ? req.body.pronouns.trim()
        : user.pronouns;

    if (pronouns.length > 50) {
      return res.status(400).json({
        message:
          "Pronouns cannot exceed 50 characters",
      });
    }

    const gender =
      typeof req.body?.gender === "string"
        ? req.body.gender.trim()
        : user.gender;

    if (gender.length > 50) {
      return res.status(400).json({
        message:
          "Gender cannot exceed 50 characters",
      });
    }

    user.username = username;
    user.fullName = fullName;
    user.bio = bio;
    user.website = website;
    user.pronouns = pronouns;
    user.gender = gender;

    if (req.file) {
      try {
        if (!req.file.buffer) {
          return res.status(400).json({
            message:
              "Invalid profile photo",
          });
        }

        const result =
          await uploadToCloudinary(
            req.file.buffer,
            "snapgram/profiles",
            "image"
          );

        if (!result?.secure_url) {
          return res.status(500).json({
            message:
              "Profile photo upload failed",
          });
        }

        user.avatar =
          result.secure_url;
      } catch (uploadError) {
        console.error(
          "PROFILE PHOTO UPLOAD ERROR:",
          uploadError
        );

        return res.status(500).json({
          message:
            "Unable to upload profile photo",
        });
      }
    }

    await user.save();

    return res.status(200).json({
      message:
        "Profile updated successfully",

      user: formatUser(user),
    });
  } catch (error) {
    console.error(
      "UPDATE PROFILE ERROR:",
      error
    );

    if (error?.code === 11000) {
      return res.status(409).json({
        message:
          "That username is already taken",
      });
    }

    if (
      error?.name ===
      "ValidationError"
    ) {
      const messages = Object.values(
        error.errors || {}
      )
        .map(
          (item) => item.message
        )
        .filter(Boolean);

      return res.status(400).json({
        message:
          messages.join(", ") ||
          "Invalid profile data",
      });
    }

    return res.status(500).json({
      message:
        "Unable to update profile",

      ...(process.env.NODE_ENV !==
        "production" && {
        error:
          error?.message ||
          "Unknown server error",
      }),
    });
  }
}

async function searchUsers(req, res) {
  try {
    const query = String(
      req.query?.q || ""
    ).trim();

    if (!query) {
      return res.json({
        users: [],
      });
    }

    const users =
      await User.find({
        $or: [
          {
            username: {
              $regex: query,
              $options: "i",
            },
          },
          {
            fullName: {
              $regex: query,
              $options: "i",
            },
          },
        ],
      })
        .select(
          [
            "_id",
            "username",
            "fullName",
            "avatar",
            "isVerified",
            "followersCount",
            "followingCount",
          ].join(" ")
        )
        .limit(30)
        .lean();

    const currentUserId =
      req.user?._id?.toString();

    const results = users.map(
      (user) => ({
        _id: user._id,
        username: user.username,
        fullName:
          user.fullName || "",
        name:
          user.fullName || "",
        avatar:
          user.avatar || "",
        isVerified:
          Boolean(user.isVerified),

        followersCount:
          Number(
            user.followersCount
          ) || 0,

        followingCount:
          Number(
            user.followingCount
          ) || 0,

        isFollowing: false,

        isOwnProfile:
          user._id.toString() ===
          currentUserId,
      })
    );

    return res.json({
      users: results,
    });
  } catch (error) {
    console.error(
      "SEARCH USERS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to search users",
    });
  }
}

async function getSavedPosts(req, res) {
  try {
    const user =
      await User.findById(
        req.user._id
      ).populate({
        path: "savedPosts",

        populate: {
          path: "user",
          select:
            "username fullName avatar isVerified",
        },
      });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json({
      posts:
        user.savedPosts || [],
    });
  } catch (error) {
    console.error(
      "SAVED POSTS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to load saved posts",
    });
  }
}

async function getUserPosts(req, res) {
  try {
    const username = String(
      req.params.username || ""
    )
      .trim()
      .toLowerCase();

    const user =
      await User.findOne({
        username,
      })
        .select(
          "_id username fullName avatar isPrivate isVerified"
        )
        .lean();

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const posts =
      await Post.find({
        user: user._id,
      })
        .populate(
          "user",
          "username fullName avatar isVerified"
        )
        .sort({
          createdAt: -1,
        })
        .lean();

    return res.json({
      posts,
    });
  } catch (error) {
    console.error(
      "USER POSTS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to load user posts.",
    });
  }
}

module.exports = {
  getUserProfile,
  updateProfile,
  searchUsers,
  getSavedPosts,
  getUserPosts,
};
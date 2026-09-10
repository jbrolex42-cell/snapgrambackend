const streamifier = require("streamifier");

const cloudinary = require("../config/cloudinary");
const Post = require("../models/Post");
const User = require("../models/User");
const Comment = require("../models/Comment");

const MAX_MEDIA = 10;
const MAX_CAPTION_LENGTH = 2200;

function isVideoFile(file) {
  return Boolean(
    file?.mimetype &&
      String(file.mimetype)
        .toLowerCase()
        .startsWith("video/")
  );
}

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return fallback;
}

function parseJson(value, fallback = null) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeLocation(value) {
  if (!value) {
    return {
      name: "",
      latitude: null,
      longitude: null,
    };
  }

  const parsed = parseJson(value, null);

  if (parsed && typeof parsed === "object") {
    const latitude =
      parsed.latitude !== undefined &&
      parsed.latitude !== null &&
      parsed.latitude !== ""
        ? Number(parsed.latitude)
        : null;

    const longitude =
      parsed.longitude !== undefined &&
      parsed.longitude !== null &&
      parsed.longitude !== ""
        ? Number(parsed.longitude)
        : null;

    return {
      name: String(parsed.name || "").trim(),
      latitude: Number.isFinite(latitude)
        ? latitude
        : null,
      longitude: Number.isFinite(longitude)
        ? longitude
        : null,
    };
  }

  return {
    name: String(value).trim(),
    latitude: null,
    longitude: null,
  };
}

function normalizeTaggedUsers(value) {
  if (!value) {
    return [];
  }

  const parsed = parseJson(value, null);

  const values = Array.isArray(parsed)
    ? parsed
    : String(value)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  return [
    ...new Set(
      values
        .map((item) => {
          if (typeof item === "string") {
            return item.trim();
          }

          if (item && typeof item === "object") {
            return String(
              item.id || item._id || ""
            ).trim();
          }

          return "";
        })
        .filter(Boolean)
    ),
  ];
}

function normalizeVisibility(value) {
  const visibility = String(value || "public")
    .trim()
    .toLowerCase();

  if (
    visibility === "followers" ||
    visibility === "private"
  ) {
    return visibility;
  }

  return "public";
}

function getUserId(req) {
  return (
    req.user?._id?.toString() ||
    req.user?.id?.toString() ||
    req.userId?.toString() ||
    null
  );
}

function hasId(list, id) {
  return (list || []).some(
    (item) =>
      item?.toString() === id?.toString()
  );
}

function populatePost(query) {
  return query.populate(
    "user",
    "username fullName avatar isVerified isPrivate"
  );
}

async function uploadToCloudinary(file) {
  if (!file?.buffer) {
    throw new Error(
      "Invalid uploaded media file."
    );
  }

  const isVideo = isVideoFile(file);

  return new Promise((resolve, reject) => {
    const stream =
      cloudinary.uploader.upload_stream(
        {
          folder: "snapgram/posts",
          resource_type: isVideo
            ? "video"
            : "image",
        },
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          if (!result?.secure_url) {
            reject(
              new Error(
                "Cloudinary did not return a secure URL."
              )
            );
            return;
          }

          resolve(result);
        }
      );

    streamifier
      .createReadStream(file.buffer)
      .pipe(stream);
  });
}

async function destroyCloudinaryMedia(media) {
  if (!media?.publicId) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(
      media.publicId,
      {
        resource_type:
          media.type === "video"
            ? "video"
            : "image",
      }
    );
  } catch (error) {
    console.error(
      "Cloudinary cleanup error:",
      error.message
    );
  }
}

async function cleanupUploadedMedia(media) {
  if (!Array.isArray(media)) {
    return;
  }

  await Promise.all(
    media.map((item) =>
      destroyCloudinaryMedia(item)
    )
  );
}

async function validateTaggedUsers(
  taggedUsers
) {
  if (!taggedUsers.length) {
    return [];
  }

  const users = await User.find({
    _id: {
      $in: taggedUsers,
    },
  })
    .select("_id")
    .lean();

  const validIds = new Set(
    users.map((user) =>
      user._id.toString()
    )
  );

  return taggedUsers.filter((id) =>
    validIds.has(id.toString())
  );
}

async function createPost(req, res) {
  const uploadedMedia = [];

  try {
    if (
      !req.files ||
      req.files.length === 0
    ) {
      return res.status(400).json({
        message:
          "At least one media file is required.",
      });
    }

    if (req.files.length > MAX_MEDIA) {
      return res.status(400).json({
        message:
          "A post can contain a maximum of 10 media files.",
      });
    }

    const caption = String(
      req.body.caption || ""
    ).trim();

    if (
      caption.length >
      MAX_CAPTION_LENGTH
    ) {
      return res.status(400).json({
        message:
          "Caption cannot exceed 2200 characters.",
      });
    }

    const location = normalizeLocation(
      req.body.location
    );

    const taggedUserIds =
      normalizeTaggedUsers(
        req.body.taggedUsers
      );

    const validTaggedUsers =
      await validateTaggedUsers(
        taggedUserIds
      );

    const visibility =
      normalizeVisibility(
        req.body.visibility
      );

    for (const file of req.files) {
      const result =
        await uploadToCloudinary(file);

      uploadedMedia.push({
        url: result.secure_url,
        publicId:
          result.public_id || null,
        type: isVideoFile(file)
          ? "video"
          : "image",
        width: Number.isFinite(
          result.width
        )
          ? result.width
          : null,
        height: Number.isFinite(
          result.height
        )
          ? result.height
          : null,
        duration: Number.isFinite(
          result.duration
        )
          ? result.duration
          : null,
      });
    }

    const post = await Post.create({
      user: req.user._id,
      caption,
      location,
      taggedUsers: validTaggedUsers,
      media: uploadedMedia,
      visibility,
    });

    const populatedPost =
      await populatePost(
        Post.findById(post._id)
      );

    if (!populatedPost) {
      await cleanupUploadedMedia(
        uploadedMedia
      );

      return res.status(500).json({
        message:
          "Post was created but could not be loaded.",
      });
    }

    return res.status(201).json({
      success: true,
      message:
        "Post created successfully.",
      post: populatedPost,
    });
  } catch (error) {
    console.error(
      "Create post error:",
      error
    );

    await cleanupUploadedMedia(
      uploadedMedia
    );

    if (
      error?.name ===
      "ValidationError"
    ) {
      return res.status(400).json({
        message: Object.values(
          error.errors
        )
          .map(
            (item) => item.message
          )
          .join(" "),
      });
    }

    return res.status(500).json({
      message:
        error?.message ||
        "Unable to create post.",
    });
  }
}

async function getFeed(req, res) {
  try {
    const currentUser =
      await User.findById(req.user._id)
        .select(
          "following blockedUsers mutedUsers restrictedUsers"
        )
        .lean();

    if (!currentUser) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const followingIds =
      currentUser.following || [];

    const blockedIds =
      currentUser.blockedUsers || [];

    const mutedIds =
      currentUser.mutedUsers || [];

    const excludedIds = [
      ...blockedIds,
      ...mutedIds,
    ];

    const authorIds = [
      req.user._id,
      ...followingIds,
    ].filter(
      (id, index, array) =>
        array.findIndex(
          (item) =>
            item.toString() ===
            id.toString()
        ) === index
    );

    const page = Math.max(
      Number(req.query.page) || 1,
      1
    );

    const limit = Math.min(
      Math.max(
        Number(req.query.limit) || 10,
        1
      ),
      30
    );

    const skip = (page - 1) * limit;

    const visibilityConditions = [
      {
        visibility: "public",
      },
      {
        visibility: "followers",
        user: {
          $in: [
            req.user._id,
            ...followingIds,
          ],
        },
      },
      {
        visibility: "private",
        user: req.user._id,
      },
    ];

    const filter = {
      user: {
        $in: authorIds,
        $nin: excludedIds,
      },
      $or: visibilityConditions,
    };

    const posts =
      await populatePost(
        Post.find(filter)
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean()
      );

    const postsWithState =
      posts.map((post) => ({
        ...post,

        isLiked: hasId(
          post.likes,
          req.user._id
        ),

        liked: hasId(
          post.likes,
          req.user._id
        ),

        isSaved: hasId(
          post.savedBy,
          req.user._id
        ),

        saved: hasId(
          post.savedBy,
          req.user._id
        ),

        likesCount:
          post.likes?.length || 0,

        commentsCount:
          post.commentsCount || 0,

        sharesCount:
          post.sharesCount || 0,
      }));

    const total =
      await Post.countDocuments(filter);

    return res.json({
      success: true,
      posts: postsWithState,
      page,
      limit,
      total,
      hasMore:
        skip + posts.length < total,
    });
  } catch (error) {
    console.error(
      "Get feed error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to load feed.",
    });
  }
}

async function getPost(req, res) {
  try {
    const post =
      await populatePost(
        Post.findById(req.params.id)
      );

    if (!post) {
      return res.status(404).json({
        message: "Post not found.",
      });
    }

    const userId =
      getUserId(req);

    const authorId =
      post.user?._id?.toString();

    if (
      post.visibility === "private" &&
      authorId !== userId
    ) {
      return res.status(403).json({
        message:
          "This post is private.",
      });
    }

    const currentUser =
      await User.findById(req.user._id)
        .select(
          "following blockedUsers mutedUsers"
        )
        .lean();

    if (
      post.visibility ===
        "followers" &&
      authorId !== userId &&
      !hasId(
        currentUser?.following,
        post.user?._id
      )
    ) {
      return res.status(403).json({
        message:
          "You must follow this account to view this post.",
      });
    }

    if (
      hasId(
        currentUser?.blockedUsers,
        post.user?._id
      )
    ) {
      return res.status(403).json({
        message:
          "You cannot view this post.",
      });
    }

    const plainPost =
      post.toObject
        ? post.toObject()
        : post;

    return res.json({
      success: true,
      post: {
        ...plainPost,

        isLiked: hasId(
          post.likes,
          req.user._id
        ),

        liked: hasId(
          post.likes,
          req.user._id
        ),

        isSaved: hasId(
          post.savedBy,
          req.user._id
        ),

        saved: hasId(
          post.savedBy,
          req.user._id
        ),

        likesCount:
          post.likes?.length || 0,

        commentsCount:
          post.commentsCount || 0,

        sharesCount:
          post.sharesCount || 0,
      },
    });
  } catch (error) {
    console.error(
      "Get post error:",
      error
    );

    if (
      error?.name ===
      "CastError"
    ) {
      return res.status(400).json({
        message: "Invalid post ID.",
      });
    }

    return res.status(500).json({
      message:
        "Unable to load post.",
    });
  }
}

async function deletePost(req, res) {
  try {
    const post =
      await Post.findById(
        req.params.id
      );

    if (!post) {
      return res.status(404).json({
        message: "Post not found.",
      });
    }

    if (
      post.user.toString() !==
      getUserId(req)
    ) {
      return res.status(403).json({
        message:
          "You can only delete your own posts.",
      });
    }

    await cleanupUploadedMedia(
      post.media
    );

    await Comment.deleteMany({
      post: post._id,
    });

    await post.deleteOne();

    return res.json({
      success: true,
      message:
        "Post deleted successfully.",
      postId: String(post._id),
    });
  } catch (error) {
    console.error(
      "Delete post error:",
      error
    );

    if (
      error?.name ===
      "CastError"
    ) {
      return res.status(400).json({
        message: "Invalid post ID.",
      });
    }

    return res.status(500).json({
      message:
        "Unable to delete post.",
    });
  }
}

async function savePost(req, res) {
  try {
    const post =
      await Post.findById(
        req.params.id
      );

    if (!post) {
      return res.status(404).json({
        message: "Post not found.",
      });
    }

    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message:
          "Authentication required.",
      });
    }

    if (!Array.isArray(post.savedBy)) {
      post.savedBy = [];
    }

    const alreadySaved =
      hasId(
        post.savedBy,
        userId
      );

    if (!alreadySaved) {
      post.savedBy.push(userId);
      await post.save();
    }

    return res.json({
      success: true,
      saved: true,
      savesCount:
        post.savedBy.length,
      postId: String(post._id),
    });
  } catch (error) {
    console.error(
      "Save post error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to save post.",
    });
  }
}

async function unsavePost(req, res) {
  try {
    const post =
      await Post.findById(
        req.params.id
      );

    if (!post) {
      return res.status(404).json({
        message: "Post not found.",
      });
    }

    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message:
          "Authentication required.",
      });
    }

    if (!Array.isArray(post.savedBy)) {
      post.savedBy = [];
    }

    post.savedBy =
      post.savedBy.filter(
        (savedId) =>
          savedId.toString() !==
          userId
      );

    await post.save();

    return res.json({
      success: true,
      saved: false,
      savesCount:
        post.savedBy.length,
      postId: String(post._id),
    });
  } catch (error) {
    console.error(
      "Unsave post error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to remove saved post.",
    });
  }
}

async function toggleSave(req, res) {
  try {
    const post =
      await Post.findById(
        req.params.id
      );

    if (!post) {
      return res.status(404).json({
        message: "Post not found.",
      });
    }

    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message:
          "Authentication required.",
      });
    }

    if (!Array.isArray(post.savedBy)) {
      post.savedBy = [];
    }

    const alreadySaved =
      hasId(
        post.savedBy,
        userId
      );

    if (alreadySaved) {
      post.savedBy =
        post.savedBy.filter(
          (savedId) =>
            savedId.toString() !==
            userId
        );
    } else {
      post.savedBy.push(userId);
    }

    await post.save();

    return res.json({
      success: true,
      saved: !alreadySaved,
      savesCount:
        post.savedBy.length,
      postId: String(post._id),
    });
  } catch (error) {
    console.error(
      "Toggle save error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to update saved post.",
    });
  }
}

async function createComment(
  req,
  res
) {
  try {
    const text = String(
      req.body.text || ""
    ).trim();

    const parentComment =
      req.body.parentComment ||
      null;

    if (!text) {
      return res.status(400).json({
        message:
          "Comment cannot be empty.",
      });
    }

    if (text.length > 1000) {
      return res.status(400).json({
        message:
          "Comment cannot exceed 1000 characters.",
      });
    }

    const post =
      await Post.findById(
        req.params.id
      );

    if (!post) {
      return res.status(404).json({
        message: "Post not found.",
      });
    }

    if (
      post.visibility ===
        "private" &&
      post.user.toString() !==
        getUserId(req)
    ) {
      return res.status(403).json({
        message:
          "You cannot comment on this post.",
      });
    }

    if (parentComment) {
      const parent =
        await Comment.findOne({
          _id: parentComment,
          post: post._id,
        });

      if (!parent) {
        return res.status(400).json({
          message:
            "Parent comment not found.",
        });
      }
    }

    const comment =
      await Comment.create({
        post: post._id,
        user: req.user._id,
        text,
        parentComment,
      });

    post.commentsCount =
      (post.commentsCount || 0) + 1;

    await post.save();

    const populatedComment =
      await Comment.findById(
        comment._id
      ).populate(
        "user",
        "username avatar fullName isVerified"
      );

    return res.status(201).json({
      success: true,
      comment: populatedComment,
    });
  } catch (error) {
    console.error(
      "Create comment error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to create comment.",
    });
  }
}

async function getComments(
  req,
  res
) {
  try {
    const post =
      await Post.findById(
        req.params.id
      )
        .select(
          "user visibility"
        )
        .lean();

    if (!post) {
      return res.status(404).json({
        message: "Post not found.",
      });
    }

    const comments =
      await Comment.find({
        post: req.params.id,
      })
        .populate(
          "user",
          "username avatar fullName isVerified"
        )
        .sort({
          createdAt: 1,
        })
        .lean();

    return res.json({
      success: true,
      comments,
    });
  } catch (error) {
    console.error(
      "Get comments error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to get comments.",
    });
  }
}

module.exports = {
  createPost,
  getFeed,
  getPost,
  deletePost,

  savePost,
  unsavePost,
  toggleSave,

  createComment,
  getComments,
};
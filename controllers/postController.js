const mongoose = require("mongoose");
const streamifier = require("streamifier");

const cloudinary = require("../config/cloudinary");
const Post = require("../models/Post");
const User = require("../models/User");
const Comment = require("../models/Comment");

const MAX_MEDIA = 10;
const MAX_CAPTION_LENGTH = 2200;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

const USER_FIELDS = [
  "username",
  "fullName",
  "firstName",
  "lastName",
  "name",
  "displayName",
  "avatar",
  "avatarUrl",
  "profilePicture",
  "profileImage",
  "isVerified",
  "verified",
  "isPrivate",
].join(" ");

const COMMENT_USER_FIELDS =
  "username avatar fullName isVerified verified";

function getUserId(req) {
  const value =
    req.user?._id ||
    req.user?.id ||
    req.userId ||
    null;

  return value ? String(value) : null;
}

function requireUserId(req, res) {
  const userId = getUserId(req);

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Authentication required.",
    });

    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    res.status(401).json({
      success: false,
      message: "Invalid user ID.",
    });

    return null;
  }

  return userId;
}

function getPagination(req) {
  const requestedPage = Number.parseInt(
    req.query?.page,
    10
  );

  const requestedLimit = Number.parseInt(
    req.query?.limit,
    10
  );

  const page =
    Number.isFinite(requestedPage) &&
    requestedPage > 0
      ? requestedPage
      : DEFAULT_PAGE;

  const limit =
    Number.isFinite(requestedLimit) &&
    requestedLimit > 0
      ? Math.min(
          requestedLimit,
          MAX_LIMIT
        )
      : DEFAULT_LIMIT;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

function parseJson(value, fallback = null) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (
    typeof value === "object"
  ) {
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

  if (
    parsed &&
    typeof parsed === "object"
  ) {
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
      name: String(
        parsed.name || ""
      ).trim(),

      latitude:
        Number.isFinite(latitude)
          ? latitude
          : null,

      longitude:
        Number.isFinite(longitude)
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

          if (
            item &&
            typeof item === "object"
          ) {
            return String(
              item.id ||
                item._id ||
                ""
            ).trim();
          }

          return "";
        })
        .filter(Boolean)
    ),
  ];
}

function normalizeVisibility(value) {
  const visibility = String(
    value || "public"
  )
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

function normalizePostType(value) {
  const type = String(
    value || "post"
  )
    .trim()
    .toLowerCase();

  return type === "reel"
    ? "reel"
    : "post";
}

function hasId(list, id) {
  if (!Array.isArray(list) || !id) {
    return false;
  }

  const target = String(id);

  return list.some(
    (item) => String(item) === target
  );
}

function normalizeObjectIds(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter(
      (value) =>
        value &&
        mongoose.Types.ObjectId.isValid(
          value
        )
    )
    .map(
      (value) =>
        new mongoose.Types.ObjectId(value)
    );
}

function uniqueIds(values) {
  const map = new Map();

  for (const value of values) {
    if (!value) {
      continue;
    }

    const key = String(value);

    if (!map.has(key)) {
      map.set(key, value);
    }
  }

  return [...map.values()];
}

function populatePost(query) {
  return query.populate({
    path: "user",
    select: USER_FIELDS,
  });
}

function populateRepost(query) {
  return query
    .populate({
      path: "user",
      select: USER_FIELDS,
    })
    .populate({
      path: "repostOf",
      populate: {
        path: "user",
        select: USER_FIELDS,
      },
    });
}

function addUserState(post, userId) {
  if (!post) {
    return null;
  }

  const plain =
    typeof post.toObject === "function"
      ? post.toObject()
      : post;

  const likes = Array.isArray(plain.likes)
    ? plain.likes
    : [];

  const savedBy = Array.isArray(
    plain.savedBy
  )
    ? plain.savedBy
    : [];

  const liked = hasId(likes, userId);
  const saved = hasId(savedBy, userId);

  return {
    ...plain,

    id:
      plain._id?.toString() ||
      plain.id ||
      null,

    liked,
    isLiked: liked,

    saved,
    isSaved: saved,

    likesCount: likes.length,

    commentsCount:
      Number(plain.commentsCount) || 0,

    sharesCount:
      Number(plain.sharesCount) || 0,

    repostsCount:
      Number(plain.repostsCount) || 0,
  };
}

function normalizePosts(posts, userId) {
  if (!Array.isArray(posts)) {
    return [];
  }

  return posts
    .map((post) =>
      addUserState(post, userId)
    )
    .filter(Boolean);
}

function isVideoFile(file) {
  return Boolean(
    file?.mimetype &&
      String(file.mimetype)
        .toLowerCase()
        .startsWith("video/")
  );
}

function uploadToCloudinary(file) {
  if (!file?.buffer) {
    return Promise.reject(
      new Error(
        "Invalid uploaded media file."
      )
    );
  }

  const isVideo = isVideoFile(file);

  return new Promise(
    (resolve, reject) => {
      const uploadStream =
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
        .pipe(uploadStream);
    }
  );
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
  if (!Array.isArray(media) || !media.length) {
    return;
  }

  await Promise.allSettled(
    media.map(
      destroyCloudinaryMedia
    )
  );
}

async function validateTaggedUsers(
  taggedUsers
) {
  if (!taggedUsers.length) {
    return [];
  }

  const validObjectIds =
    taggedUsers.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );

  if (!validObjectIds.length) {
    return [];
  }

  const users = await User.find({
    _id: {
      $in: validObjectIds,
    },
  })
    .select("_id")
    .lean();

  const validIds = new Set(
    users.map((user) =>
      String(user._id)
    )
  );

  return validObjectIds.filter((id) =>
    validIds.has(String(id))
  );
}

async function createPost(req, res) {
  const uploadedMedia = [];

  try {
    const userId = requireUserId(
      req,
      res
    );

    if (!userId) {
      return;
    }

    if (
      !Array.isArray(req.files) ||
      req.files.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one media file is required.",
      });
    }

    if (req.files.length > MAX_MEDIA) {
      return res.status(400).json({
        success: false,
        message:
          "A post can contain a maximum of 10 media files.",
      });
    }

    const caption = String(
      req.body?.caption || ""
    ).trim();

    if (
      caption.length >
      MAX_CAPTION_LENGTH
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Caption cannot exceed 2200 characters.",
      });
    }

    const postType = normalizePostType(
      req.body?.postType
    );

    const visibility =
      normalizeVisibility(
        req.body?.visibility
      );

    const location =
      normalizeLocation(
        req.body?.location
      );

    const taggedUsers =
      normalizeTaggedUsers(
        req.body?.taggedUsers
      );

    const validTaggedUsers =
      await validateTaggedUsers(
        taggedUsers
      );

    if (postType === "reel") {
      const containsVideo =
        req.files.some(isVideoFile);

      if (!containsVideo) {
        return res.status(400).json({
          success: false,
          message:
            "A reel must contain video media.",
        });
      }
    }

    const uploadResults =
      await Promise.all(
        req.files.map(
          uploadToCloudinary
        )
      );

    for (
      let index = 0;
      index < uploadResults.length;
      index++
    ) {
      const result =
        uploadResults[index];

      const file = req.files[index];

      uploadedMedia.push({
        url: result.secure_url,

        publicId:
          result.public_id || null,

        type:
          isVideoFile(file)
            ? "video"
            : "image",

        width:
          Number.isFinite(
            result.width
          )
            ? result.width
            : null,

        height:
          Number.isFinite(
            result.height
          )
            ? result.height
            : null,

        duration:
          Number.isFinite(
            result.duration
          )
            ? result.duration
            : null,
      });
    }

    const post = await Post.create({
      user: userId,

      media: uploadedMedia,

      postType,

      caption,

      location,

      taggedUsers:
        validTaggedUsers,

      visibility,

      likes: [],

      savedBy: [],

      repostedBy: [],

      commentsCount: 0,

      sharesCount: 0,

      repostsCount: 0,

      repostOf: null,

      isArchived: false,
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
        success: false,
        message:
          "Post was created but could not be loaded.",
      });
    }

    const responsePost =
      addUserState(
        populatedPost,
        userId
      );

    console.log(
      `[CREATE ${postType.toUpperCase()}]`,
      {
        postId: String(post._id),
        userId,
        postType,
        mediaCount:
          uploadedMedia.length,
      }
    );

    return res.status(201).json({
      success: true,

      message:
        postType === "reel"
          ? "Reel created successfully."
          : "Post created successfully.",

      post: responsePost,
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
        success: false,
        message:
          Object.values(
            error.errors || {}
          )
            .map(
              (item) =>
                item.message
            )
            .join(" "),
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Unable to create post.",
    });
  }
}

async function getMyPosts(req, res) {
  try {
    const userId = requireUserId(
      req,
      res
    );

    if (!userId) {
      return;
    }

    const {
      page,
      limit,
      skip,
    } = getPagination(req);

    const filter = {
      user: userId,
      postType: "post",
      isArchived: {
        $ne: true,
      },
    };

    const [
      posts,
      total,
    ] = await Promise.all([
      populatePost(
        Post.find(filter)
          .sort({
            createdAt: -1,
            _id: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean()
      ),

      Post.countDocuments(filter),
    ]);

    const result =
      normalizePosts(
        posts,
        userId
      );

    console.log(
      "[GET MY POSTS]",
      {
        userId,
        page,
        limit,
        found: result.length,
        total,
      }
    );

    return res.json({
      success: true,
      posts: result,
      page,
      limit,
      total,
      hasMore:
        skip + result.length < total,
    });
  } catch (error) {
    console.error(
      "Get my posts error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load your posts.",
    });
  }
}

async function getMyReels(req, res) {
  try {
    const userId = requireUserId(
      req,
      res
    );

    if (!userId) {
      return;
    }

    const {
      page,
      limit,
      skip,
    } = getPagination(req);

    const filter = {
      user: userId,
      postType: "reel",
      isArchived: {
        $ne: true,
      },
    };

    const [
      posts,
      total,
    ] = await Promise.all([
      populatePost(
        Post.find(filter)
          .sort({
            createdAt: -1,
            _id: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean()
      ),

      Post.countDocuments(filter),
    ]);

    const result =
      normalizePosts(
        posts,
        userId
      );

    console.log(
      "[GET MY REELS]",
      {
        userId,
        page,
        limit,
        found: result.length,
        total,
      }
    );

    return res.json({
      success: true,
      posts: result,
      page,
      limit,
      total,
      hasMore:
        skip + result.length < total,
    });
  } catch (error) {
    console.error(
      "Get my reels error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load your reels.",
    });
  }
}

async function getSavedPosts(req, res) {
  try {
    const userId = requireUserId(
      req,
      res
    );

    if (!userId) {
      return;
    }

    const {
      page,
      limit,
      skip,
    } = getPagination(req);

    const filter = {
      savedBy: userId,

      postType: {
        $ne: "repost",
      },

      isArchived: {
        $ne: true,
      },
    };

    const [
      posts,
      total,
    ] = await Promise.all([
      populatePost(
        Post.find(filter)
          .sort({
            createdAt: -1,
            _id: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean()
      ),

      Post.countDocuments(filter),
    ]);

    const result =
      normalizePosts(
        posts,
        userId
      );

    return res.json({
      success: true,
      posts: result,
      page,
      limit,
      total,
      hasMore:
        skip + result.length < total,
    });
  } catch (error) {
    console.error(
      "Get saved posts error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load saved posts.",
    });
  }
}

async function getLikedPosts(req, res) {
  try {
    const userId = requireUserId(
      req,
      res
    );

    if (!userId) {
      return;
    }

    const {
      page,
      limit,
      skip,
    } = getPagination(req);

    const filter = {
      likes: userId,

      postType: {
        $ne: "repost",
      },

      isArchived: {
        $ne: true,
      },
    };

    const [
      posts,
      total,
    ] = await Promise.all([
      populatePost(
        Post.find(filter)
          .sort({
            createdAt: -1,
            _id: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean()
      ),

      Post.countDocuments(filter),
    ]);

    const result =
      normalizePosts(
        posts,
        userId
      );

    console.log(
      "[GET LIKED POSTS]",
      {
        userId,
        page,
        limit,
        found: result.length,
        total,
      }
    );

    return res.json({
      success: true,
      posts: result,
      page,
      limit,
      total,
      hasMore:
        skip + result.length < total,
    });
  } catch (error) {
    console.error(
      "Get liked posts error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load liked posts.",
    });
  }
}

async function getTaggedPosts(req, res) {
  try {
    const userId = requireUserId(
      req,
      res
    );

    if (!userId) {
      return;
    }

    const {
      page,
      limit,
      skip,
    } = getPagination(req);

    const filter = {
      taggedUsers: userId,

      postType: {
        $ne: "repost",
      },

      isArchived: {
        $ne: true,
      },
    };

    const [
      posts,
      total,
    ] = await Promise.all([
      populatePost(
        Post.find(filter)
          .sort({
            createdAt: -1,
            _id: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean()
      ),

      Post.countDocuments(filter),
    ]);

    const result =
      normalizePosts(
        posts,
        userId
      );

    return res.json({
      success: true,
      posts: result,
      page,
      limit,
      total,
      hasMore:
        skip + result.length < total,
    });
  } catch (error) {
    console.error(
      "Get tagged posts error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load tagged posts.",
    });
  }
}

async function getMyReposts(req, res) {
  try {
    const userId = requireUserId(
      req,
      res
    );

    if (!userId) {
      return;
    }

    const {
      page,
      limit,
      skip,
    } = getPagination(req);

    const filter = {
      user: userId,
      postType: "repost",
    };

    const [
      posts,
      total,
    ] = await Promise.all([
      populateRepost(
        Post.find(filter)
          .sort({
            createdAt: -1,
            _id: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean()
      ),

      Post.countDocuments(filter),
    ]);

    const result =
      normalizePosts(
        posts,
        userId
      );

    return res.json({
      success: true,
      posts: result,
      page,
      limit,
      total,
      hasMore:
        skip + result.length < total,
    });
  } catch (error) {
    console.error(
      "Get my reposts error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load your reposts.",
    });
  }
}

async function getFeed(req, res) {
  try {
    const userId = requireUserId(
      req,
      res
    );

    if (!userId) {
      return;
    }

    const currentUser =
      await User.findById(userId)
        .select(
          "following blockedUsers mutedUsers restrictedUsers"
        )
        .lean();

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message:
          "User not found.",
      });
    }

    const followingIds =
      normalizeObjectIds(
        currentUser.following
      );

    const blockedIds =
      normalizeObjectIds(
        currentUser.blockedUsers
      );

    const mutedIds =
      normalizeObjectIds(
        currentUser.mutedUsers
      );

    const excludedIds =
      uniqueIds([
        ...blockedIds,
        ...mutedIds,
      ]);

    const currentUserObjectId =
      new mongoose.Types.ObjectId(
        userId
      );

    const authorIds =
      uniqueIds([
        currentUserObjectId,
        ...followingIds,
      ]);

    const {
      page,
      limit,
      skip,
    } = getPagination(req);

    const filter = {
      user: {
        $in: authorIds,
        $nin: excludedIds,
      },

      postType: "post",

      isArchived: {
        $ne: true,
      },

      $or: [
        {
          visibility: "public",
        },

        {
          visibility: "followers",

          user: {
            $in: authorIds,
          },
        },

        {
          visibility: "private",

          user: currentUserObjectId,
        },

        {
          visibility: {
            $exists: false,
          },
        },
      ],
    };

    const [
      posts,
      total,
    ] = await Promise.all([
      populatePost(
        Post.find(filter)
          .sort({
            createdAt: -1,
            _id: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean()
      ),

      Post.countDocuments(filter),
    ]);

    const result =
      normalizePosts(
        posts,
        userId
      );

    console.log(
      "[GET FEED]",
      {
        userId,

        following:
          followingIds.length,

        authors:
          authorIds.length,

        excluded:
          excludedIds.length,

        page,

        limit,

        found:
          result.length,

        total,
      }
    );

    return res.json({
      success: true,

      posts: result,

      page,

      limit,

      total,

      result: result.length,

      hasMore:
        skip + result.length < total,
    });
  } catch (error) {
    console.error(
      "Get feed error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load feed.",
    });
  }
}

async function getPost(req, res) {
  try {
    const post =
      await populateRepost(
        Post.findById(
          req.params.id
        )
      );

    if (!post) {
      return res.status(404).json({
        success: false,
        message:
          "Post not found.",
      });
    }

    const userId = getUserId(req);

    const original =
      post.postType === "repost" &&
      post.repostOf
        ? post.repostOf
        : post;

    const authorId =
      original.user?._id?.toString() ||
      original.user?.toString();

    if (
      original.visibility ===
        "private" &&
      authorId !== userId
    ) {
      return res.status(403).json({
        success: false,
        message:
          "This post is private.",
      });
    }

    if (
      original.visibility ===
        "followers" &&
      authorId !== userId
    ) {
      if (!userId) {
        return res.status(403).json({
          success: false,
          message:
            "You must be logged in to view this post.",
        });
      }

      const currentUser =
        await User.findById(userId)
          .select(
            "following blockedUsers mutedUsers"
          )
          .lean();

      if (
        hasId(
          currentUser?.blockedUsers,
          authorId
        ) ||
        hasId(
          currentUser?.mutedUsers,
          authorId
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You cannot view this post.",
        });
      }

      if (
        !hasId(
          currentUser?.following,
          authorId
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You must follow this account to view this post.",
        });
      }
    }

    return res.json({
      success: true,

      post: addUserState(
        post,
        userId
      ),
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
        success: false,
        message:
          "Invalid post ID.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Unable to load post.",
    });
  }
}

async function deletePost(req, res) {
  try {
    const userId = requireUserId(
      req,
      res
    );

    if (!userId) {
      return;
    }

    const post =
      await Post.findById(
        req.params.id
      );

    if (!post) {
      return res.status(404).json({
        success: false,
        message:
          "Post not found.",
      });
    }

    if (
      String(post.user) !==
      String(userId)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You can only delete your own posts.",
      });
    }

    if (
      post.postType === "repost" &&
      post.repostOf
    ) {
      await Post.findByIdAndUpdate(
        post.repostOf,
        {
          $pull: {
            repostedBy: post.user,
          },

          $inc: {
            repostsCount: -1,
          },
        }
      );

      await post.deleteOne();

      return res.json({
        success: true,

        message:
          "Repost removed successfully.",

        postId:
          String(post._id),
      });
    }

    await Promise.all([
      cleanupUploadedMedia(
        post.media
      ),

      Comment.deleteMany({
        post: post._id,
      }),

      Post.deleteMany({
        repostOf: post._id,
      }),
    ]);

    await post.deleteOne();

    return res.json({
      success: true,

      message:
        "Post deleted successfully.",

      postId:
        String(post._id),
    });
  } catch (error) {
    console.error(
      "Delete post error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to delete post.",
    });
  }
}

async function savePost(req, res) {
  try {
    const userId = requireUserId(
      req,
      res
    );

    if (!userId) {
      return;
    }

    const post =
      await Post.findById(
        req.params.id
      ).select(
        "_id savedBy"
      );

    if (!post) {
      return res.status(404).json({
        success: false,
        message:
          "Post not found.",
      });
    }

    const updated =
      await Post.findByIdAndUpdate(
        post._id,
        {
          $addToSet: {
            savedBy: userId,
          },
        },
        {
          new: true,
          projection: {
            savedBy: 1,
          },
        }
      ).lean();

    return res.json({
      success: true,

      saved: true,

      savesCount:
        updated?.savedBy?.length || 0,

      postId:
        String(post._id),
    });
  } catch (error) {
    console.error(
      "Save post error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to save post.",
    });
  }
}

async function unsavePost(req, res) {
  try {
    const userId = requireUserId(
      req,
      res
    );

    if (!userId) {
      return;
    }

    const updated =
      await Post.findOneAndUpdate(
        {
          _id: req.params.id,
        },
        {
          $pull: {
            savedBy: userId,
          },
        },
        {
          new: true,
          projection: {
            savedBy: 1,
          },
        }
      ).lean();

    if (!updated) {
      return res.status(404).json({
        success: false,
        message:
          "Post not found.",
      });
    }

    return res.json({
      success: true,

      saved: false,

      savesCount:
        updated.savedBy?.length || 0,

      postId:
        String(updated._id),
    });
  } catch (error) {
    console.error(
      "Unsave post error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to remove saved post.",
    });
  }
}

async function toggleSave(req, res) {
  try {
    const userId = requireUserId(
      req,
      res
    );

    if (!userId) {
      return;
    }

    const post =
      await Post.findById(
        req.params.id
      ).select(
        "_id savedBy"
      );

    if (!post) {
      return res.status(404).json({
        success: false,
        message:
          "Post not found.",
      });
    }

    const alreadySaved = hasId(
      post.savedBy,
      userId
    );

    const update = alreadySaved
      ? {
          $pull: {
            savedBy: userId,
          },
        }
      : {
          $addToSet: {
            savedBy: userId,
          },
        };

    const updated =
      await Post.findByIdAndUpdate(
        post._id,
        update,
        {
          new: true,
          projection: {
            savedBy: 1,
          },
        }
      ).lean();

    return res.json({
      success: true,

      saved: !alreadySaved,

      savesCount:
        updated?.savedBy?.length || 0,

      postId:
        String(post._id),
    });
  } catch (error) {
    console.error(
      "Toggle save error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update saved post.",
    });
  }
}

async function repostPost(req, res) {
  try {
    const userId = requireUserId(
      req,
      res
    );

    if (!userId) {
      return;
    }

    const original =
      await Post.findById(
        req.params.id
      ).lean();

    if (!original) {
      return res.status(404).json({
        success: false,
        message:
          "Post not found.",
      });
    }

    const originalId =
      original.postType === "repost" &&
      original.repostOf
        ? original.repostOf
        : original._id;

    const existing =
      await Post.findOne({
        user: userId,
        postType: "repost",
        repostOf: originalId,
      }).lean();

    if (existing) {
      return res.status(409).json({
        success: false,

        message:
          "You have already reposted this post.",

        reposted: true,

        post: addUserState(
          existing,
          userId
        ),
      });
    }

    const repostMedia =
      Array.isArray(original.media)
        ? original.media.map(
            (media) => ({
              url: media.url,

              publicId:
                media.publicId || null,

              type:
                media.type || "image",

              width:
                media.width ?? null,

              height:
                media.height ?? null,

              duration:
                media.duration ?? null,
            })
          )
        : [];

    if (!repostMedia.length) {
      return res.status(400).json({
        success: false,
        message:
          "The original post has no media and cannot be reposted.",
      });
    }

    const repost =
      await Post.create({
        user: userId,

        media: repostMedia,

        caption: "",

        location: {
          name: "",
          latitude: null,
          longitude: null,
        },

        taggedUsers: [],

        visibility: "public",

        postType: "repost",

        repostOf: originalId,

        likes: [],

        savedBy: [],

        repostedBy: [],

        commentsCount: 0,

        sharesCount: 0,

        repostsCount: 0,

        isArchived: false,
      });

    await Post.findByIdAndUpdate(
      originalId,
      {
        $addToSet: {
          repostedBy: userId,
        },

        $inc: {
          repostsCount: 1,
        },
      }
    );

    const populated =
      await populateRepost(
        Post.findById(
          repost._id
        )
      );

    return res.status(201).json({
      success: true,

      reposted: true,

      post: addUserState(
        populated,
        userId
      ),
    });
  } catch (error) {
    console.error(
      "Repost error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to repost this post.",
    });
  }
}

async function unrepostPost(req, res) {
  try {
    const userId = requireUserId(
      req,
      res
    );

    if (!userId) {
      return;
    }

    const repost =
      await Post.findOne({
        user: userId,
        postType: "repost",
        repostOf: req.params.id,
      });

    if (!repost) {
      return res.json({
        success: true,
        reposted: false,
      });
    }

    await repost.deleteOne();

    await Post.findByIdAndUpdate(
      req.params.id,
      {
        $pull: {
          repostedBy: userId,
        },

        $inc: {
          repostsCount: -1,
        },
      }
    );

    return res.json({
      success: true,

      reposted: false,

      postId: req.params.id,
    });
  } catch (error) {
    console.error(
      "Unrepost error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to remove repost.",
    });
  }
}

async function createComment(req, res) {
  try {
    const userId = requireUserId(
      req,
      res
    );

    if (!userId) {
      return;
    }

    const text = String(
      req.body?.text || ""
    ).trim();

    const parentComment =
      req.body?.parentComment ||
      null;

    if (!text) {
      return res.status(400).json({
        success: false,
        message:
          "Comment cannot be empty.",
      });
    }

    if (text.length > 1000) {
      return res.status(400).json({
        success: false,
        message:
          "Comment cannot exceed 1000 characters.",
      });
    }

    const post =
      await Post.findById(
        req.params.id
      )
        .select(
          "_id user visibility"
        )
        .lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        message:
          "Post not found.",
      });
    }

    if (
      post.visibility === "private" &&
      String(post.user) !==
        String(userId)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot comment on this post.",
      });
    }

    if (
      post.visibility ===
        "followers" &&
      String(post.user) !==
        String(userId)
    ) {
      const [
        owner,
        currentUser,
      ] = await Promise.all([
        User.findById(post.user)
          .select(
            "blockedUsers mutedUsers"
          )
          .lean(),

        User.findById(userId)
          .select(
            "following blockedUsers mutedUsers"
          )
          .lean(),
      ]);

      if (
        hasId(
          owner?.blockedUsers,
          userId
        ) ||
        hasId(
          owner?.mutedUsers,
          userId
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You cannot comment on this post.",
        });
      }

      if (
        hasId(
          currentUser?.blockedUsers,
          post.user
        ) ||
        hasId(
          currentUser?.mutedUsers,
          post.user
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You cannot comment on this post.",
        });
      }

      if (
        !hasId(
          currentUser?.following,
          post.user
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You must follow this account to comment.",
        });
      }
    }

    if (parentComment) {
      const parent =
        await Comment.findOne({
          _id: parentComment,
          post: post._id,
        })
          .select("_id")
          .lean();

      if (!parent) {
        return res.status(400).json({
          success: false,
          message:
            "Parent comment not found.",
        });
      }
    }

    const comment =
      await Comment.create({
        post: post._id,

        user: userId,

        text,

        parentComment,
      });

    await Post.findByIdAndUpdate(
      post._id,
      {
        $inc: {
          commentsCount: 1,
        },
      }
    );

    const populatedComment =
      await Comment.findById(
        comment._id
      ).populate({
        path: "user",
        select: COMMENT_USER_FIELDS,
      });

    return res.status(201).json({
      success: true,

      comment:
        populatedComment,
    });
  } catch (error) {
    console.error(
      "Create comment error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create comment.",
    });
  }
}

async function getComments(req, res) {
  try {
    const post =
      await Post.findById(
        req.params.id
      )
        .select(
          "_id user visibility"
        )
        .lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        message:
          "Post not found.",
      });
    }

    const comments =
      await Comment.find({
        post: req.params.id,
      })
        .populate({
          path: "user",
          select: COMMENT_USER_FIELDS,
        })
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
      success: false,
      message:
        "Failed to get comments.",
    });
  }
}

module.exports = {
  createPost,
  getFeed,
  getMyPosts,
  getMyReels,
  getSavedPosts,
  getLikedPosts,
  getTaggedPosts,
  getMyReposts,
  repostPost,
  unrepostPost,
  getPost,
  deletePost,
  savePost,
  unsavePost,
  toggleSave,
  createComment,
  getComments,
};
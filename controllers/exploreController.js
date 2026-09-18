const User = require("../models/User");
const Post = require("../models/Post");

const PAGE_SIZE_DEFAULT = 30;
const PAGE_SIZE_MAX = 60;
const FETCH_MULTIPLIER = 3;
const MAX_FETCH = 180;

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPage(value) {
  const page = Number.parseInt(value, 10);

  return Number.isFinite(page) && page > 0
    ? page
    : 1;
}

function getLimit(value) {
  const limit = Number.parseInt(value, 10);

  if (!Number.isFinite(limit) || limit <= 0) {
    return PAGE_SIZE_DEFAULT;
  }

  return Math.min(limit, PAGE_SIZE_MAX);
}

function getUserId(req) {
  return (
    req.user?._id ||
    req.user?.id ||
    req.userId ||
    null
  );
}

function toStringId(value) {
  if (!value) {
    return null;
  }

  return String(value);
}

function buildBlockedIds(user) {
  const blockedUsers = Array.isArray(user?.blockedUsers)
    ? user.blockedUsers
    : [];

  const mutedUsers = Array.isArray(user?.mutedUsers)
    ? user.mutedUsers
    : [];

  const ids = new Set();

  [...blockedUsers, ...mutedUsers].forEach((id) => {
    if (id) {
      ids.add(String(id));
    }
  });

  return [...ids];
}

function buildFollowingSet(user) {
  const following = Array.isArray(user?.following)
    ? user.following
    : [];

  return new Set(
    following
      .filter(Boolean)
      .map((id) => String(id))
  );
}

function isPostVisible(post, req) {
  const currentUserId = toStringId(
    getUserId(req)
  );

  const author = post?.user;

  if (!author?._id) {
    return false;
  }

  const authorId = String(author._id);

  const blockedIds = new Set(
    buildBlockedIds(req.user)
  );

  if (blockedIds.has(authorId)) {
    return false;
  }

  if (
    currentUserId &&
    authorId === currentUserId
  ) {
    return true;
  }

  if (author.isPrivate !== true) {
    return true;
  }

  const following = buildFollowingSet(req.user);

  return following.has(authorId);
}

function serializePost(post) {
  if (!post) {
    return null;
  }

  const serialized = {
    ...post,

    id:
      post.id ||
      post._id?.toString() ||
      null,

    user: post.user
      ? {
          _id: post.user._id,

          username:
            post.user.username || "",

          name:
            post.user.name ||
            post.user.fullName ||
            "",

          fullName:
            post.user.fullName ||
            post.user.name ||
            "",

          avatar:
            post.user.avatar || "",

          isVerified:
            post.user.isVerified === true,

          isPrivate:
            post.user.isPrivate === true,
        }
      : null,

    media: Array.isArray(post.media)
      ? post.media.map((media) => ({
          ...media,

          type:
            media?.type === "video"
              ? "video"
              : "image",

          url:
            media?.url ||
            media?.secure_url ||
            "",

          thumbnail:
            media?.thumbnail ||
            media?.thumbnailUrl ||
            media?.poster ||
            "",
        }))
      : [],
  };

  return serialized;
}

function buildExploreFilter(req) {
  const blockedIds = buildBlockedIds(req.user);

  return {
    user: {
      $nin: blockedIds,
    },

    postType: "post",

    isArchived: {
      $ne: true,
    },
  };
}

function getFetchLimit(limit) {
  return Math.min(
    limit * FETCH_MULTIPLIER,
    MAX_FETCH
  );
}

async function getExplorePosts(req, res) {
  try {
    const page = getPage(req.query.page);
    const limit = getLimit(req.query.limit);

    const filter = buildExploreFilter(req);

    const fetchLimit = getFetchLimit(limit);

    const posts = await Post.find(filter)
      .populate(
        "user",
        "username name fullName avatar isVerified isPrivate followers following"
      )
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .skip((page - 1) * limit)
      .limit(fetchLimit)
      .lean();

    const visiblePosts = posts.filter((post) =>
      isPostVisible(post, req)
    );

    const result = visiblePosts
      .slice(0, limit)
      .map(serializePost)
      .filter(Boolean);

    const hasMore =
      visiblePosts.length > limit ||
      posts.length >= fetchLimit;

    return res.json({
      posts: result,

      pagination: {
        page,
        limit,
        hasMore,
      },
    });
  } catch (error) {
    console.error(
      "EXPLORE POSTS ERROR:",
      error
    );

    return res.status(500).json({
      message: "Failed to load Explore.",
    });
  }
}

async function search(req, res) {
  try {
    const query = String(
      req.query.q || ""
    ).trim();

    const page = getPage(req.query.page);
    const limit = getLimit(req.query.limit);

    if (!query) {
      return res.json({
        users: [],
        posts: [],
        hashtags: [],

        pagination: {
          page,
          limit,
          hasMore: false,
        },
      });
    }

    const regex = new RegExp(
      escapeRegex(query),
      "i"
    );

    const blockedIds = buildBlockedIds(
      req.user
    );

    const following = buildFollowingSet(
      req.user
    );

    const users = await User.find({
      _id: {
        $nin: blockedIds,
      },

      $or: [
        {
          username: regex,
        },
        {
          fullName: regex,
        },
        {
          name: regex,
        },
      ],
    })
      .select(
        "_id username name fullName avatar isPrivate isVerified followers"
      )
      .limit(20)
      .lean();

    const currentUserId = toStringId(
      getUserId(req)
    );

    const visibleUsers = users.filter(
      (user) => {
        if (!user?.isPrivate) {
          return true;
        }

        if (
          currentUserId &&
          String(user._id) === currentUserId
        ) {
          return true;
        }

        return following.has(
          String(user._id)
        );
      }
    );

    const postFilter = {
      user: {
        $nin: blockedIds,
      },

      postType: "post",

      isArchived: {
        $ne: true,
      },

      $or: [
        {
          caption: regex,
        },
        {
          hashtags: regex,
        },
      ],
    };

    const fetchLimit = getFetchLimit(limit);

    const posts = await Post.find(postFilter)
      .populate(
        "user",
        "username name fullName avatar isVerified isPrivate followers following"
      )
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .skip((page - 1) * limit)
      .limit(fetchLimit)
      .lean();

    const visiblePosts = posts.filter(
      (post) =>
        isPostVisible(post, req)
    );

    const resultPosts = visiblePosts
      .slice(0, limit)
      .map(serializePost)
      .filter(Boolean);

    const hashtags = [];
    const normalizedQuery =
      query
        .replace(/^#/, "")
        .toLowerCase();

    for (const post of visiblePosts) {
      if (!Array.isArray(post.hashtags)) {
        continue;
      }

      for (const tag of post.hashtags) {
        if (!tag) {
          continue;
        }

        const cleanTag = String(tag)
          .replace(/^#/, "")
          .trim();

        if (!cleanTag) {
          continue;
        }

        if (
          !cleanTag
            .toLowerCase()
            .includes(normalizedQuery)
        ) {
          continue;
        }

        const exists = hashtags.some(
          (existing) =>
            existing.toLowerCase() ===
            cleanTag.toLowerCase()
        );

        if (!exists) {
          hashtags.push(cleanTag);
        }

        if (hashtags.length >= 20) {
          break;
        }
      }

      if (hashtags.length >= 20) {
        break;
      }
    }

    const hasMore =
      visiblePosts.length > limit ||
      posts.length >= fetchLimit;

    return res.json({
      users: visibleUsers.slice(0, 20),

      posts: resultPosts,

      hashtags: hashtags.slice(0, 20),

      pagination: {
        page,
        limit,
        hasMore,
      },
    });
  } catch (error) {
    console.error(
      "EXPLORE SEARCH ERROR:",
      error
    );

    return res.status(500).json({
      message: "Search failed.",
    });
  }
}

module.exports = {
  search,
  getExplorePosts,
};
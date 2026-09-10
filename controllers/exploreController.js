
const User = require("../models/User");
const Post = require("../models/Post");

const PAGE_SIZE_DEFAULT = 30;
const PAGE_SIZE_MAX = 60;

function escapeRegex(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPage(value) {
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function getLimit(value) {
  const limit = Number.parseInt(value, 10);

  if (!Number.isFinite(limit) || limit <= 0) {
    return PAGE_SIZE_DEFAULT;
  }

  return Math.min(limit, PAGE_SIZE_MAX);
}

function getUserId(req) {
  return req.user?._id || req.user?.id;
}

function buildBlockedIds(user) {
  const ids = new Set();

  const blockedUsers = Array.isArray(user?.blockedUsers)
    ? user.blockedUsers
    : [];

  const mutedUsers = Array.isArray(user?.mutedUsers)
    ? user.mutedUsers
    : [];

  [...blockedUsers, ...mutedUsers].forEach((id) => {
    if (id) {
      ids.add(String(id));
    }
  });

  return [...ids];
}

function buildExploreFilter(req) {
  const user = req.user;
  const userId = getUserId(req);
  const blockedIds = buildBlockedIds(user);

  const filter = {
    user: {
      $nin: blockedIds,
    },
  };

  return {
    filter,
    userId,
    blockedIds,
  };
}

async function filterVisiblePosts(posts, req) {
  const currentUserId = getUserId(req);

  const currentUserFollowing = new Set(
    (req.user?.following || []).map((id) => String(id))
  );

  const currentUserBlocked = new Set(
    buildBlockedIds(req.user)
  );

  return posts.filter((post) => {
    const user = post.user;

    if (!user?._id) {
      return false;
    }

    const authorId = String(user._id);

    if (currentUserBlocked.has(authorId)) {
      return false;
    }

    if (
      currentUserId &&
      authorId === String(currentUserId)
    ) {
      return true;
    }

    const isPrivate =
      user.isPrivate === true;

    if (!isPrivate) {
      return true;
    }

    return currentUserFollowing.has(authorId);
  });
}

function serializePost(post) {
  return {
    ...post,

    user: post.user
      ? {
          _id: post.user._id,
          username: post.user.username,
          name:
            post.user.name ||
            post.user.fullName ||
            "",
          fullName:
            post.user.fullName ||
            post.user.name ||
            "",
          avatar: post.user.avatar || "",
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
            media.type === "video"
              ? "video"
              : "image",
        }))
      : [],
  };
}

async function getExplorePosts(req, res) {
  try {
    const page = getPage(req.query.page);
    const limit = getLimit(req.query.limit);

    const {
      filter,
    } = buildExploreFilter(req);

    const fetchLimit = Math.min(
      limit * 3,
      180
    );

    const posts = await Post.find(filter)
      .populate(
        "user",
        "username fullName avatar isVerified isPrivate followers following"
      )
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .skip((page - 1) * limit)
      .limit(fetchLimit)
      .lean();

    const visiblePosts =
      await filterVisiblePosts(
        posts,
        req
      );

    const result =
      visiblePosts
        .slice(0, limit)
        .map(serializePost);

    const hasMore =
      visiblePosts.length > limit ||
      posts.length >= fetchLimit;

    res.json({
      posts: result,
      pagination: {
        page,
        limit,
        hasMore,
      },
    });
  } catch (error) {
    console.error(
      "Explore posts error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to load Explore.",
    });
  }
}

async function search(req, res) {
  try {
    const query = (
      req.query.q || ""
    ).trim();

    if (!query) {
      return res.json({
        users: [],
        posts: [],
        hashtags: [],
        pagination: {
          page: 1,
          limit: 30,
          hasMore: false,
        },
      });
    }

    const page = getPage(req.query.page);
    const limit = getLimit(req.query.limit);

    const regex = new RegExp(
      escapeRegex(query),
      "i"
    );

    const blockedIds =
      buildBlockedIds(req.user);

    const currentUserFollowing =
      new Set(
        (req.user?.following || []).map(
          (id) => String(id)
        )
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
        "_id username fullName avatar isPrivate isVerified followers"
      )
      .limit(20)
      .lean();

    const visibleUsers =
      users.filter((user) => {
        if (!user?.isPrivate) {
          return true;
        }

        if (
          req.user?._id &&
          String(user._id) ===
            String(req.user._id)
        ) {
          return true;
        }

        return currentUserFollowing.has(
          String(user._id)
        );
      });

    const posts = await Post.find({
      user: {
        $nin: blockedIds,
      },
      $or: [
        {
          caption: regex,
        },
        {
          hashtags: regex,
        },
      ],
    })
      .populate(
        "user",
        "username fullName avatar isVerified isPrivate followers following"
      )
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .skip((page - 1) * limit)
      .limit(limit * 3)
      .lean();

    const visiblePosts =
      await filterVisiblePosts(
        posts,
        req
      );

    const resultPosts =
      visiblePosts
        .slice(0, limit)
        .map(serializePost);

    const hashtags = [];

    for (const post of visiblePosts) {
      if (!Array.isArray(post.hashtags)) {
        continue;
      }

      for (const tag of post.hashtags) {
        if (!tag) {
          continue;
        }

        const cleanTag =
          String(tag).replace(
            /^#/,
            ""
          );

        if (
          cleanTag
            .toLowerCase()
            .includes(
              query.toLowerCase()
            )
        ) {
          if (
            !hashtags.some(
              (existing) =>
                existing.toLowerCase() ===
                cleanTag.toLowerCase()
            )
          ) {
            hashtags.push(cleanTag);
          }
        }

        if (hashtags.length >= 20) {
          break;
        }
      }

      if (hashtags.length >= 20) {
        break;
      }
    }

    res.json({
      users: visibleUsers.slice(0, 20),

      posts: resultPosts,

      hashtags: hashtags.slice(
        0,
        20
      ),

      pagination: {
        page,
        limit,
        hasMore:
          visiblePosts.length > limit ||
          posts.length >= limit * 3,
      },
    });
  } catch (error) {
    console.error(
      "Explore search error:",
      error
    );

    res.status(500).json({
      message: "Search failed.",
    });
  }
}

module.exports = {
  search,
  getExplorePosts,
};
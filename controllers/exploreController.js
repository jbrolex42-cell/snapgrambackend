const User = require("../models/User");
const Post = require("../models/Post");

const PAGE_SIZE_DEFAULT = 30;
const PAGE_SIZE_MAX = 60;

const FETCH_MULTIPLIER = 4;
const MAX_FETCH = 240;

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPage(value) {
  const page = Number.parseInt(value, 10);

  if (!Number.isFinite(page) || page < 1) {
    return 1;
  }

  return page;
}

function getLimit(value) {
  const limit = Number.parseInt(value, 10);

  if (!Number.isFinite(limit) || limit < 1) {
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

  for (const id of [...blockedUsers, ...mutedUsers]) {
    if (id) {
      ids.add(String(id));
    }
  }

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
  const author = post?.user;

  if (!author?._id) {
    return false;
  }

  const authorId = String(author._id);
  const currentUserId = toStringId(getUserId(req));

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

/*
 * Generate a deterministic layout from the post id.
 *
 * Important:
 * We do NOT randomly generate this on every request.
 * The same post should keep the same layout when pagination
 * or refresh happens.
 */
function getLayoutFromPost(post, index = 0) {
  const postId = String(
    post?._id ||
    post?.id ||
    ""
  );

  let hash = 0;

  for (let i = 0; i < postId.length; i += 1) {
    hash =
      (hash * 31 + postId.charCodeAt(i)) |
      0;
  }

  const value = Math.abs(hash);

  /*
   * Keep most posts normal.
   *
   * Instagram-style Explore should have:
   * - many normal squares
   * - occasional large 2x2 tiles
   * - occasional wide/tall tiles
   */
  const bucket = value % 100;

  if (bucket < 10) {
    return "large";
  }

  if (bucket < 16) {
    return "wide";
  }

  if (bucket < 22) {
    return "tall";
  }

  return "normal";
}

function getFetchLimit(limit) {
  return Math.min(
    limit * FETCH_MULTIPLIER,
    MAX_FETCH
  );
}

function serializeMedia(media) {
  if (!media) {
    return null;
  }

  const rawType = String(
    media.type || ""
  ).toLowerCase();

  const url =
    media.url ||
    media.secure_url ||
    "";

  const thumbnail =
    media.thumbnail ||
    media.thumbnailUrl ||
    media.poster ||
    "";

  const isVideo =
    rawType.includes("video") ||
    rawType.includes("reel") ||
    /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(
      String(url)
    );

  return {
    ...media,

    type: isVideo
      ? "video"
      : "image",

    url,

    thumbnail,
  };
}

function serializePost(post, index = 0) {
  if (!post) {
    return null;
  }

  const id =
    post.id ||
    post._id?.toString() ||
    null;

  const media = Array.isArray(post.media)
    ? post.media
        .map(serializeMedia)
        .filter(Boolean)
    : [];

  const firstMedia = media[0] || null;

  return {
    ...post,

    id,

    /*
     * Layout metadata used by the mobile Explore grid.
     */
    exploreLayout: getLayoutFromPost(
      post,
      index
    ),

    media,

    thumbnail:
      firstMedia?.thumbnail ||
      firstMedia?.url ||
      "",

    isVideo:
      firstMedia?.type === "video",

    mediaCount: media.length,

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
  };
}

function buildExploreFilter(req) {
  const blockedIds = buildBlockedIds(
    req.user
  );

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

async function getVisiblePosts({
  filter,
  req,
  skip,
  fetchLimit,
}) {
  const posts = await Post.find(filter)
    .populate(
      "user",
      "username name fullName avatar isVerified isPrivate followers following"
    )
    .sort({
      createdAt: -1,
      _id: -1,
    })
    .skip(skip)
    .limit(fetchLimit)
    .lean();

  return posts.filter((post) =>
    isPostVisible(post, req)
  );
}

async function getExplorePosts(req, res) {
  try {
    const page = getPage(
      req.query.page
    );

    const limit = getLimit(
      req.query.limit
    );

    const fetchLimit =
      getFetchLimit(limit);

    const skip =
      (page - 1) * limit;

    const filter =
      buildExploreFilter(req);

    const visiblePosts =
      await getVisiblePosts({
        filter,
        req,
        skip,
        fetchLimit,
      });

    const result = visiblePosts
      .slice(0, limit)
      .map((post, index) =>
        serializePost(post, index)
      )
      .filter(Boolean);

    /*
     * We intentionally don't use total count here.
     *
     * Explore is continuously changing, and visibility
     * filtering makes count-based pagination expensive.
     */
    const hasMore =
      visiblePosts.length > limit ||
      visiblePosts.length >= fetchLimit;

    return res.json({
      posts: result,

      pagination: {
        page,
        limit,
        returned: result.length,
        hasMore,
      },
    });
  } catch (error) {
    console.error(
      "EXPLORE POSTS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to load Explore.",
    });
  }
}

async function search(req, res) {
  try {
    const query = String(
      req.query.q || ""
    ).trim();

    const page = getPage(
      req.query.page
    );

    const limit = getLimit(
      req.query.limit
    );

    if (!query) {
      return res.json({
        users: [],
        posts: [],
        reels: [],
        hashtags: [],

        pagination: {
          page,
          limit,
          returned: 0,
          hasMore: false,
        },
      });
    }

    const regex = new RegExp(
      escapeRegex(query),
      "i"
    );

    const blockedIds =
      buildBlockedIds(req.user);

    const following =
      buildFollowingSet(req.user);

    const currentUserId =
      toStringId(
        getUserId(req)
      );

    /*
     * USERS
     */
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

    const visibleUsers =
      users.filter((user) => {
        if (!user?.isPrivate) {
          return true;
        }

        if (
          currentUserId &&
          String(user._id) ===
            currentUserId
        ) {
          return true;
        }

        return following.has(
          String(user._id)
        );
      });

    /*
     * POSTS
     */
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

    const fetchLimit =
      getFetchLimit(limit);

    const skip =
      (page - 1) * limit;

    const posts =
      await Post.find(postFilter)
        .populate(
          "user",
          "username name fullName avatar isVerified isPrivate followers following"
        )
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .skip(skip)
        .limit(fetchLimit)
        .lean();

    const visiblePosts =
      posts.filter((post) =>
        isPostVisible(
          post,
          req
        )
      );

    const resultPosts =
      visiblePosts
        .slice(0, limit)
        .map((post, index) =>
          serializePost(
            post,
            index
          )
        )
        .filter(Boolean);

    /*
     * HASHTAGS
     */
    const hashtags = [];

    const normalizedQuery =
      query
        .replace(/^#/, "")
        .toLowerCase();

    for (const post of visiblePosts) {
      if (
        !Array.isArray(
          post.hashtags
        )
      ) {
        continue;
      }

      for (const tag of post.hashtags) {
        if (!tag) {
          continue;
        }

        const cleanTag =
          String(tag)
            .replace(/^#/, "")
            .trim();

        if (!cleanTag) {
          continue;
        }

        if (
          !cleanTag
            .toLowerCase()
            .includes(
              normalizedQuery
            )
        ) {
          continue;
        }

        const exists =
          hashtags.some(
            (existing) =>
              existing.toLowerCase() ===
              cleanTag.toLowerCase()
          );

        if (!exists) {
          hashtags.push(
            cleanTag
          );
        }

        if (
          hashtags.length >= 20
        ) {
          break;
        }
      }

      if (
        hashtags.length >= 20
      ) {
        break;
      }
    }

    /*
     * REELS
     */
    const reelFilter = {
      user: {
        $nin: blockedIds,
      },

      postType: "reel",

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

    const reels =
      await Post.find(reelFilter)
        .populate(
          "user",
          "username name fullName avatar isVerified isPrivate followers following"
        )
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .limit(20)
        .lean();

    const visibleReels =
      reels
        .filter((reel) =>
          isPostVisible(
            reel,
            req
          )
        )
        .map((reel, index) =>
          serializePost(
            reel,
            index
          )
        )
        .filter(Boolean);

    const hasMore =
      visiblePosts.length > limit ||
      posts.length >= fetchLimit;

    return res.json({
      users:
        visibleUsers.slice(
          0,
          20
        ),

      posts:
        resultPosts,

      reels:
        visibleReels.slice(
          0,
          20
        ),

      hashtags:
        hashtags.slice(
          0,
          20
        ),

      pagination: {
        page,
        limit,
        returned:
          resultPosts.length,
        hasMore,
      },
    });
  } catch (error) {
    console.error(
      "EXPLORE SEARCH ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Search failed.",
    });
  }
}

module.exports = {
  search,
  getExplorePosts,
};
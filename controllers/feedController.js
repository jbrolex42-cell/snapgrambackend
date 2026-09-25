const mongoose = require("mongoose");

const Post = require("../models/Post");
const User = require("../models/User");
const Follow = require("../models/Follow");

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 30;
const CANDIDATE_LIMIT = 300;

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function toObjectId(id) {
  return new mongoose.Types.ObjectId(id);
}

function getIdString(value) {
  if (!value) {
    return null;
  }

  if (
    typeof value === "object" &&
    value._id
  ) {
    return String(value._id);
  }

  return String(value);
}

function clamp(value, min, max) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function encodeCursor(offset) {
  const payload = JSON.stringify({
    offset: Number(offset) || 0,
  });

  return Buffer.from(
    payload,
    "utf8"
  ).toString("base64url");
}

function decodeCursor(cursor) {
  if (!cursor) {
    return {
      offset: 0,
    };
  }

  try {
    const decoded =
      Buffer.from(
        String(cursor),
        "base64url"
      ).toString("utf8");

    const parsed =
      JSON.parse(decoded);

    const offset = Number(
      parsed?.offset
    );

    if (
      !Number.isInteger(offset) ||
      offset < 0
    ) {
      return null;
    }

    return {
      offset,
    };
  } catch {
    return null;
  }
}

function calculateFeedScore(
  post,
  followedIds,
  currentUserId
) {
  const postUserId =
    getIdString(
      post.user?._id ||
        post.user
    );

  if (!postUserId) {
    return -Infinity;
  }

  const now = Date.now();

  const createdAt =
    post.createdAt
      ? new Date(
          post.createdAt
        ).getTime()
      : now;

  const ageHours = Math.max(
    0,
    (now - createdAt) /
      (1000 * 60 * 60)
  );

  const freshnessScore =
    40 *
    Math.exp(
      -ageHours / 36
    );

  const isFollowing =
    followedIds.has(
      postUserId
    );

  const isOwnPost =
    postUserId ===
    String(currentUserId);

  let relationshipScore = 0;

  if (isOwnPost) {
    relationshipScore += 32;
  } else if (isFollowing) {
    relationshipScore += 24;
  } else {

    relationshipScore += 4;
  }

  const likesCount =
    Array.isArray(post.likes)
      ? post.likes.length
      : Number(
          post.likesCount || 0
        );

  const commentsCount =
    Number(
      post.commentsCount || 0
    );

  const sharesCount =
    Number(
      post.sharesCount || 0
    );

  const repostsCount =
    Number(
      post.repostsCount || 0
    );

  const engagementScore =
    Math.log1p(
      likesCount
    ) * 3.2 +
    Math.log1p(
      commentsCount
    ) * 5 +
    Math.log1p(
      sharesCount
    ) * 6 +
    Math.log1p(
      repostsCount
    ) * 4;

  const creatorFollowers =
    Number(
      post.user?.followersCount ||
        0
    );

  const creatorScore =
    Math.log1p(
      creatorFollowers
    ) * 1.5;

  const verifiedScore =
    post.user?.isVerified
      ? 2
      : 0;

  const contentTypeScore =
    post.postType === "reel"
      ? 2
      : 0;

  return (
    freshnessScore +
    relationshipScore +
    engagementScore +
    creatorScore +
    verifiedScore +
    contentTypeScore
  );
}

function diversifyPosts(
  posts,
  limit
) {
  if (
    !Array.isArray(posts) ||
    posts.length === 0 ||
    limit <= 0
  ) {
    return [];
  }

  if (posts.length <= 1) {
    return posts.slice(
      0,
      limit
    );
  }

  const remaining = [
    ...posts,
  ];

  const result = [];

  const authorCounts =
    new Map();

  while (
    remaining.length > 0 &&
    result.length < limit
  ) {
    let selectedIndex =
      -1;

    for (
      let i = 0;
      i < remaining.length;
      i += 1
    ) {
      const post =
        remaining[i];

      const authorId =
        getIdString(
          post.user?._id ||
            post.user
        );

      const count =
        authorCounts.get(
          authorId
        ) || 0;

      if (count < 2) {
        selectedIndex = i;
        break;
      }
    }

    if (
      selectedIndex === -1
    ) {
      selectedIndex = 0;
    }

    const [
      selected,
    ] = remaining.splice(
      selectedIndex,
      1
    );

    const authorId =
      getIdString(
        selected.user?._id ||
          selected.user
      );

    authorCounts.set(
      authorId,
      (authorCounts.get(
        authorId
      ) || 0) + 1
    );

    result.push(
      selected
    );
  }

  return result;
}

function formatPost(
  post,
  currentUserId
) {
  const likes =
    Array.isArray(
      post.likes
    )
      ? post.likes
      : [];

  const savedBy =
    Array.isArray(
      post.savedBy
    )
      ? post.savedBy
      : [];

  const currentId =
    String(currentUserId);

  const liked =
    likes.some(
      (id) =>
        id &&
        String(id) ===
          currentId
    );

  const saved =
    savedBy.some(
      (id) =>
        id &&
        String(id) ===
          currentId
    );

  const postId =
    post._id
      ? String(post._id)
      : null;

  const authorId =
    post.user?._id
      ? String(
          post.user._id
        )
      : null;

  return {
    ...post,

    _id: postId,
    id: postId,

    user: post.user
      ? {
          ...post.user,

          _id: authorId,
          id: authorId,

          isVerified:
            Boolean(
              post.user
                .isVerified
            ),
        }
      : null,

    postType:
      post.postType ||
      "post",

    media:
      Array.isArray(
        post.media
      )
        ? post.media
        : [],

    likesCount:
      likes.length,

    liked,
    isLiked: liked,

    saved,
    isSaved: saved,

    commentsCount:
      Number(
        post.commentsCount ||
          0
      ),

    sharesCount:
      Number(
        post.sharesCount ||
          0
      ),

    repostsCount:
      Number(
        post.repostsCount ||
          0
      ),
  };
}

async function getHomeFeed(
  req,
  res
) {
  try {
    const userId =
      req.user?._id ||
      req.user?.id;

    if (
      !userId ||
      !isValidObjectId(
        userId
      )
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid authenticated user.",
      });
    }

    const currentUserId =
      String(userId);

    const limit = clamp(
      parseInt(
        req.query.limit,
        10
      ) || DEFAULT_LIMIT,
      1,
      MAX_LIMIT
    );

    const cursor =
      decodeCursor(
        req.query.cursor
      );

    if (!cursor) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid feed cursor.",
      });
    }

    const start =
      cursor.offset;

    const currentUser =
      await User.findById(
        userId
      )
        .select(
          "_id isDeactivated blockedUsers mutedUsers"
        )
        .lean();

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message:
          "User not found.",
      });
    }

    if (
      currentUser.isDeactivated
    ) {
      return res.status(403).json({
        success: false,
        message:
          "This account is deactivated.",
      });
    }

    const followingDocs =
      await Follow.find({
        follower: userId,
      })
        .select(
          "following"
        )
        .lean();

    const followingIds =
      followingDocs
        .map(
          (item) =>
            item.following
        )
        .filter(
          (id) =>
            id &&
            isValidObjectId(
              id
            )
        );

    const followingIdStrings =
      new Set(
        followingIds.map(
          (id) =>
            String(id)
        )
      );

    const blockedIds =
      Array.isArray(
        currentUser.blockedUsers
      )
        ? currentUser.blockedUsers
        : [];

    const mutedIds =
      Array.isArray(
        currentUser.mutedUsers
      )
        ? currentUser.mutedUsers
        : [];

    const excludedUserIds =
      [
        ...blockedIds,
        ...mutedIds,
      ]
        .filter(
          isValidObjectId
        )
        .map(
          toObjectId
        );

    const relationshipUserIds =
      [
        toObjectId(
          userId
        ),
        ...followingIds.map(
          toObjectId
        ),
      ];

    const uniqueRelationshipIds =
      [
        ...new Map(
          relationshipUserIds.map(
            (id) => [
              String(id),
              id,
            ]
          )
        ).values(),
      ];

    const visibilityQuery = {
      $or: [
        {
          visibility:
            "public",
        },

        {
          visibility: {
            $in: [
              "followers",
              "private",
            ],
          },

          user: {
            $in:
              uniqueRelationshipIds,
          },
        },
      ],
    };

    const postQuery = {
      user: {
        $nin:
          excludedUserIds,
      },

      postType: {
        $in: [
          "post",
          "reel",
        ],
      },

      $or: [
        {
          isArchived: {
            $exists: false,
          },
        },

        {
          isArchived:
            false,
        },
      ],

      ...visibilityQuery,
    };

    const candidates =
      await Post.find(
        postQuery
      )
        .populate(
          "user",
          [
            "username",
            "fullName",
            "avatar",
            "isVerified",
            "followersCount",
            "followingCount",
            "isPrivate",
            "isDeactivated",
          ].join(" ")
        )
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .limit(
          CANDIDATE_LIMIT
        )
        .lean();

    const eligibleCandidates =
      candidates.filter(
        (post) => {
          if (!post.user) {
            return false;
          }

          if (
            post.user
              .isDeactivated
          ) {
            return false;
          }

          return true;
        }
      );

    const scoredPosts =
      eligibleCandidates.map(
        (post) => ({
          post,

          score:
            calculateFeedScore(
              post,
              followingIdStrings,
              currentUserId
            ),
        })
      );

    scoredPosts.sort(
      (a, b) => {
        if (
          b.score !==
          a.score
        ) {
          return (
            b.score -
            a.score
          );
        }

        const aDate =
          a.post.createdAt
            ? new Date(
                a.post.createdAt
              ).getTime()
            : 0;

        const bDate =
          b.post.createdAt
            ? new Date(
                b.post.createdAt
              ).getTime()
            : 0;

        if (
          bDate !==
          aDate
        ) {
          return (
            bDate -
            aDate
          );
        }

        return String(
          b.post._id
        ).localeCompare(
          String(
            a.post._id
          )
        );
      }
    );

    const rankedPosts =
      scoredPosts.map(
        (item) =>
          item.post
      );

    const diversified =
      diversifyPosts(
        rankedPosts,
        rankedPosts.length
      );

    const pagePosts =
      diversified.slice(
        start,
        start + limit
      );

    const end =
      start +
      pagePosts.length;

    const hasMore =
      end <
      diversified.length;

    const nextCursor =
      hasMore
        ? encodeCursor(end)
        : null;

    const formattedPosts =
      pagePosts.map(
        (post) =>
          formatPost(
            post,
            currentUserId
          )
      );

    console.log(
      "[FEED] HOME FEED",
      {
        userId:
          currentUserId,

        cursor:
          req.query.cursor
            ? "provided"
            : "initial",

        start,
        limit,

        followingCount:
          followingIds.length,

        candidateCount:
          candidates.length,

        eligibleCount:
          eligibleCandidates.length,

        diversifiedCount:
          diversified.length,

        returnedCount:
          formattedPosts.length,

        hasMore,
      }
    );

    return res.status(200).json({
      success: true,

      posts:
        formattedPosts,

      pagination: {
        limit,

        returned:
          formattedPosts.length,

        hasMore,

        nextCursor,

        candidateCount:
          eligibleCandidates.length,
      },

      count:
        formattedPosts.length,
    });
  } catch (error) {
    console.error(
      "[FEED] HOME FEED ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load home feed.",
    });
  }
}

module.exports = {
  getHomeFeed,
};
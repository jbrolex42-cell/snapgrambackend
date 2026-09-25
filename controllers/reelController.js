const mongoose = require("mongoose");

const Post = require("../models/Post");
const User = require("../models/User");

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

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

function getUserId(req) {
  const id =
    req.user?._id ||
    req.user?.id ||
    req.userId ||
    null;

  return id ? String(id) : null;
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

function getPagination(req) {
  const pageValue = Number.parseInt(
    req.query?.page,
    10
  );

  const limitValue = Number.parseInt(
    req.query?.limit,
    10
  );

  const page =
    Number.isFinite(pageValue) &&
    pageValue > 0
      ? pageValue
      : DEFAULT_PAGE;

  const limit =
    Number.isFinite(limitValue) &&
    limitValue > 0
      ? Math.min(limitValue, MAX_LIMIT)
      : DEFAULT_LIMIT;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

function addReelState(reel, userId) {
  if (!reel) {
    return null;
  }

  const data =
    typeof reel.toObject === "function"
      ? reel.toObject()
      : reel;

  const likes = Array.isArray(data.likes)
    ? data.likes
    : [];

  const savedBy = Array.isArray(
    data.savedBy
  )
    ? data.savedBy
    : [];

  const liked = hasId(
    likes,
    userId
  );

  const saved = hasId(
    savedBy,
    userId
  );

  return {
    ...data,

    id:
      data._id?.toString() ||
      data.id ||
      null,

    postType: "reel",

    media: Array.isArray(data.media)
      ? data.media
      : [],

    liked,
    isLiked: liked,

    saved,
    isSaved: saved,

    likesCount: likes.length,

    savesCount: savedBy.length,

    commentsCount:
      Number(data.commentsCount) || 0,

    sharesCount:
      Number(data.sharesCount) || 0,

    repostsCount:
      Number(data.repostsCount) || 0,

    views:
      Number(data.views) || 0,
  };
}

function populateReel(query) {
  return query.populate({
    path: "user",
    select: USER_FIELDS,
  });
}

/* -------------------------------------------------------
   GET ALL REELS
   GET /api/reels
------------------------------------------------------- */

async function getReels(req, res) {
  try {
    const userId = getUserId(req);

    const {
      page,
      limit,
      skip,
    } = getPagination(req);

    /*
      IMPORTANT:

      Reels are Post documents where:

        postType === "reel"

      Do NOT use Reel.find().
    */

    const filter = {
      postType: "reel",

      isArchived: {
        $ne: true,
      },
    };

    const [
      reels,
      total,
    ] = await Promise.all([
      populateReel(
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

    const result = reels
      .map((reel) =>
        addReelState(
          reel,
          userId
        )
      )
      .filter(Boolean);

    console.log(
      "[GET REELS]",
      {
        userId,
        page,
        limit,
        skip,
        found: result.length,
        total,
        ids: result.map(
          (reel) => reel.id
        ),
      }
    );

    return res.json({
      success: true,

      reels: result,

      page,
      limit,
      total,

      hasMore:
        skip + result.length < total,
    });
  } catch (error) {
    console.error(
      "[GET REELS] ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to load reels.",
    });
  }
}

/* -------------------------------------------------------
   GET SINGLE REEL
   GET /api/reels/:id
------------------------------------------------------- */

async function getReel(req, res) {
  try {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid reel ID.",
      });
    }

    const reel =
      await populateReel(
        Post.findOne({
          _id: id,
          postType: "reel",
          isArchived: {
            $ne: true,
          },
        }).lean()
      );

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found.",
      });
    }

    return res.json({
      success: true,

      reel: addReelState(
        reel,
        getUserId(req)
      ),
    });
  } catch (error) {
    console.error(
      "[GET REEL] ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to load reel.",
    });
  }
}

/* -------------------------------------------------------
   LIKE REEL
   POST /api/reels/:id/like
------------------------------------------------------- */

async function likeReel(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    const reel =
      await Post.findOne({
        _id: req.params.id,
        postType: "reel",
        isArchived: {
          $ne: true,
        },
      });

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found.",
      });
    }

    if (
      !hasId(
        reel.likes,
        userId
      )
    ) {
      reel.likes.push(userId);

      await reel.save();
    }

    return res.json({
      success: true,

      liked: true,
      isLiked: true,

      likesCount:
        reel.likes?.length || 0,

      reelId:
        String(reel._id),
    });
  } catch (error) {
    console.error(
      "[LIKE REEL] ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to like reel.",
    });
  }
}

/* -------------------------------------------------------
   UNLIKE REEL
   DELETE /api/reels/:id/like
------------------------------------------------------- */

async function unlikeReel(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    const reel =
      await Post.findOne({
        _id: req.params.id,
        postType: "reel",
        isArchived: {
          $ne: true,
        },
      });

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found.",
      });
    }

    reel.likes =
      Array.isArray(reel.likes)
        ? reel.likes.filter(
            (id) =>
              String(id) !==
              String(userId)
          )
        : [];

    await reel.save();

    return res.json({
      success: true,

      liked: false,
      isLiked: false,

      likesCount:
        reel.likes.length,

      reelId:
        String(reel._id),
    });
  } catch (error) {
    console.error(
      "[UNLIKE REEL] ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to unlike reel.",
    });
  }
}

/* -------------------------------------------------------
   TOGGLE LIKE
   POST /api/reels/:id/toggle-like
------------------------------------------------------- */

async function toggleReelLike(
  req,
  res
) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    const reel =
      await Post.findOne({
        _id: req.params.id,
        postType: "reel",
        isArchived: {
          $ne: true,
        },
      });

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found.",
      });
    }

    const alreadyLiked =
      hasId(
        reel.likes,
        userId
      );

    if (alreadyLiked) {
      reel.likes =
        reel.likes.filter(
          (id) =>
            String(id) !==
            String(userId)
        );
    } else {
      reel.likes.push(userId);
    }

    await reel.save();

    const liked =
      !alreadyLiked;

    return res.json({
      success: true,

      liked,
      isLiked: liked,

      likesCount:
        reel.likes.length,

      reelId:
        String(reel._id),
    });
  } catch (error) {
    console.error(
      "[TOGGLE REEL LIKE] ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to update reel like.",
    });
  }
}

/* -------------------------------------------------------
   SAVE / UNSAVE REEL
   POST /api/reels/:id/save
------------------------------------------------------- */

async function saveReel(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    const reel =
      await Post.findOne({
        _id: req.params.id,
        postType: "reel",
        isArchived: {
          $ne: true,
        },
      });

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found.",
      });
    }

    if (
      !Array.isArray(
        reel.savedBy
      )
    ) {
      reel.savedBy = [];
    }

    const index =
      reel.savedBy.findIndex(
        (id) =>
          String(id) ===
          String(userId)
      );

    let saved;

    if (index === -1) {
      reel.savedBy.push(userId);
      saved = true;
    } else {
      reel.savedBy.splice(
        index,
        1
      );
      saved = false;
    }

    await reel.save();

    return res.json({
      success: true,

      saved,
      isSaved: saved,

      savesCount:
        reel.savedBy.length,

      reelId:
        String(reel._id),
    });
  } catch (error) {
    console.error(
      "[SAVE REEL] ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to update saved reel.",
    });
  }
}

/* -------------------------------------------------------
   VIEW REEL
   POST /api/reels/:id/view
------------------------------------------------------- */

async function incrementViews(
  req,
  res
) {
  try {
    const reel =
      await Post.findOneAndUpdate(
        {
          _id: req.params.id,
          postType: "reel",
          isArchived: {
            $ne: true,
          },
        },
        {
          $inc: {
            views: 1,
          },
        },
        {
          new: true,
        }
      ).lean();

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found.",
      });
    }

    return res.json({
      success: true,

      views:
        Number(reel.views) || 0,

      reelId:
        String(reel._id),
    });
  } catch (error) {
    console.error(
      "[VIEW REEL] ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to update reel views.",
    });
  }
}

module.exports = {
  getReels,
  getReel,
  likeReel,
  unlikeReel,
  toggleReelLike,
  saveReel,
  incrementViews,
};
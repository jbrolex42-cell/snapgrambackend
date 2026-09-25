const Post = require("../models/Post");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

function extractHashtags(text = "") {
  const matches =
    text.match(/#[a-zA-Z0-9_]+/g) || [];

  return [
    ...new Set(
      matches.map((tag) =>
        tag.toLowerCase()
      )
    ),
  ];
}

function uploadVideoToCloudinary(file) {
  return new Promise((resolve, reject) => {
    const stream =
      cloudinary.uploader.upload_stream(
        {
          folder: "snapgram/reels",
          resource_type: "video",
        },
        (error, result) => {
          if (error) {
            reject(error);
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

function getUserId(req) {
  return req.user?._id
    ? String(req.user._id)
    : null;
}

function formatReel(reel, userId) {
  const likes =
    Array.isArray(reel.likes)
      ? reel.likes
      : [];

  const saves =
    Array.isArray(reel.saves)
      ? reel.saves
      : [];

  const isLiked = userId
    ? likes.some(
        (id) =>
          String(id) ===
          String(userId)
      )
    : false;

  const isSaved = userId
    ? saves.some(
        (id) =>
          String(id) ===
          String(userId)
      )
    : false;

  return {
    ...reel,

    isLiked,
    liked: isLiked,

    isSaved,

    likesCount:
      likes.length,

    savesCount:
      saves.length,
  };
}

async function createReel(
  req,
  res
) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message:
          "Reel video is required.",
      });
    }

    if (
      !req.file.mimetype.startsWith(
        "video/"
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only video files are allowed.",
      });
    }

    const result =
      await uploadVideoToCloudinary(
        req.file
      );

    const caption =
      req.body.caption || "";

    const location =
      req.body.location || "";

    let tags = [];
    let hashtags = [];

    try {
      if (req.body.tags) {
        tags =
          typeof req.body.tags ===
          "string"
            ? JSON.parse(
                req.body.tags
              )
            : req.body.tags;
      }
    } catch (error) {
      tags = [];
    }

    try {
      if (req.body.hashtags) {
        hashtags =
          typeof req.body.hashtags ===
          "string"
            ? JSON.parse(
                req.body.hashtags
              )
            : req.body.hashtags;
      }
    } catch (error) {
      hashtags = [];
    }

    if (
      !Array.isArray(hashtags) ||
      hashtags.length === 0
    ) {
      hashtags =
        extractHashtags(caption);
    }

    const trimStart =
      Number(req.body.trimStart) || 0;

    const trimEnd =
      Number(req.body.trimEnd) || 0;

    const reel =
      await Reel.create({
        user:
          req.user._id,

        video: {
          url:
            result.secure_url,

          publicId:
            result.public_id,

          duration:
            Number(
              req.body.duration
            ) || 0,
        },

        caption,

        location,

        tags:
          Array.isArray(tags)
            ? tags
            : [],

        hashtags:
          Array.isArray(
            hashtags
          )
            ? hashtags
            : [],

        trim: {
          start: trimStart,
          end: trimEnd,
        },
      });

    const populated =
      await Reel.findById(
        reel._id
      ).populate(
        "user",
        "username avatar fullName isVerified"
      );

    return res.status(201).json({
      success: true,
      message:
        "Reel created successfully.",
      reel:
        formatReel(
          populated.toObject(),
          getUserId(req)
        ),
    });
  } catch (error) {
    console.error(
      "CREATE REEL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create reel.",
    });
  }
}

async function getReels(
  req,
  res
) {
  try {
    const page =
      Math.max(
        Number(
          req.query.page
        ) || 1,
        1
      );

    const limit =
      Math.min(
        Number(
          req.query.limit
        ) || 10,
        20
      );

    const skip =
      (page - 1) * limit;

    const reels =
      await Reel.find({})
        .populate(
          "user",
          "username avatar fullName isVerified"
        )
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean();

    const userId =
      getUserId(req);

    const formatted =
      reels.map(
        (reel) =>
          formatReel(
            reel,
            userId
          )
      );

    return res.json({
      success: true,

      reels:
        formatted,

      page,

      limit,

      hasMore:
        reels.length === limit,
    });
  } catch (error) {
    console.error(
      "GET REELS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load reels.",
    });
  }
}

async function getReel(
  req,
  res
) {
  try {
    const reel =
      await Reel.findById(
        req.params.id
      )
        .populate(
          "user",
          "username avatar fullName isVerified"
        )
        .lean();

    if (!reel) {
      return res.status(404).json({
        success: false,
        message:
          "Reel not found.",
      });
    }

    return res.json({
      success: true,

      reel:
        formatReel(
          reel,
          getUserId(req)
        ),
    });
  } catch (error) {
    console.error(
      "GET REEL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load reel.",
    });
  }
}

async function likeReel(
  req,
  res
) {
  try {
    const reel =
      await Reel.findById(
        req.params.id
      );

    if (!reel) {
      return res.status(404).json({
        success: false,
        message:
          "Reel not found.",
      });
    }

    if (
      !Array.isArray(
        reel.likes
      )
    ) {
      reel.likes = [];
    }

    const userId =
      getUserId(req);

    const alreadyLiked =
      reel.likes.some(
        (id) =>
          String(id) ===
          String(userId)
      );

    if (!alreadyLiked) {
      reel.likes.push(
        req.user._id
      );

      await reel.save();
    }

    return res.status(200).json({
      success: true,
      liked: true,
      isLiked: true,

      likesCount:
        reel.likes.length,

      reelId:
        String(reel._id),
    });
  } catch (error) {
    console.error(
      "LIKE REEL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to like reel.",
    });
  }
}

async function unlikeReel(
  req,
  res
) {
  try {
    const reel =
      await Reel.findById(
        req.params.id
      );

    if (!reel) {
      return res.status(404).json({
        success: false,
        message:
          "Reel not found.",
      });
    }

    if (
      !Array.isArray(
        reel.likes
      )
    ) {
      reel.likes = [];
    }

    const userId =
      getUserId(req);

    reel.likes =
      reel.likes.filter(
        (id) =>
          String(id) !==
          String(userId)
      );

    await reel.save();

    return res.status(200).json({
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
      "UNLIKE REEL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to unlike reel.",
    });
  }
}

async function toggleReelLike(
  req,
  res
) {
  try {
    const reel =
      await Reel.findById(
        req.params.id
      );

    if (!reel) {
      return res.status(404).json({
        success: false,
        message:
          "Reel not found.",
      });
    }

    if (
      !Array.isArray(
        reel.likes
      )
    ) {
      reel.likes = [];
    }

    const userId =
      getUserId(req);

    const alreadyLiked =
      reel.likes.some(
        (id) =>
          String(id) ===
          String(userId)
      );

    if (alreadyLiked) {
      reel.likes =
        reel.likes.filter(
          (id) =>
            String(id) !==
            String(userId)
        );
    } else {
      reel.likes.push(
        req.user._id
      );
    }

    await reel.save();

    const liked =
      !alreadyLiked;

    return res.status(200).json({
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
      "TOGGLE REEL LIKE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update reel like.",
    });
  }
}

async function saveReel(
  req,
  res
) {
  try {
    const reel =
      await Reel.findById(
        req.params.id
      );

    if (!reel) {
      return res.status(404).json({
        success: false,
        message:
          "Reel not found.",
      });
    }

    const userId =
      getUserId(req);

    if (
      !Array.isArray(
        reel.saves
      )
    ) {
      reel.saves = [];
    }

    const index =
      reel.saves.findIndex(
        (id) =>
          String(id) ===
          String(userId)
      );

    let saved;

    if (index === -1) {
      reel.saves.push(
        req.user._id
      );

      saved = true;
    } else {
      reel.saves.splice(
        index,
        1
      );

      saved = false;
    }

    await reel.save();

    return res.json({
      success: true,
      saved,

      savesCount:
        reel.saves.length,

      reelId:
        String(reel._id),
    });
  } catch (error) {
    console.error(
      "SAVE REEL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update saved reel.",
    });
  }
}

async function incrementViews(
  req,
  res
) {
  try {
    const reel =
      await Reel.findByIdAndUpdate(
        req.params.id,

        {
          $inc: {
            views: 1,
          },
        },

        {
          new: true,
        }
      );

    if (!reel) {
      return res.status(404).json({
        success: false,
        message:
          "Reel not found.",
      });
    }

    return res.json({
      success: true,
      views:
        reel.views,
    });
  } catch (error) {
    console.error(
      "INCREMENT REEL VIEWS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update views.",
    });
  }
}

module.exports = {
  createReel,
  getReels,
  getReel,
  likeReel,
  unlikeReel,
  toggleReelLike,
  saveReel,
  incrementViews,
};

Post.find({
  postType: "reel",
  isArchived: {
    $ne: true,
  },
});
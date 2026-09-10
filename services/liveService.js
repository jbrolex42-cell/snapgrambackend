const crypto = require("crypto");

const Live = require("../models/Live");
const Follow = require("../models/Follow");

function generateRoomId() {
  return `live_${crypto.randomBytes(16).toString("hex")}`;
}

function serializeLive(live) {
  if (!live) return null;

  const data = live.toObject ? live.toObject() : live;

  return {
    ...data,

    _id: data._id,
    host: data.host,

    title: data.title || "",
    description: data.description || "",

    status: data.status,
    visibility: data.visibility,

    thumbnail: data.thumbnail || "",

    viewerCount: data.viewerCount || 0,
    peakViewerCount: data.peakViewerCount || 0,
    likesCount: data.likesCount || 0,
    commentsCount: data.commentsCount || 0,

    startedAt: data.startedAt || null,
    endedAt: data.endedAt || null,

    isActive: Boolean(data.isActive),
  };
}

async function getActiveLiveForHost(hostId) {
  return Live.findOne({
    host: hostId,
    isActive: true,
    status: "live",
  });
}

async function startLive({
  hostId,
  title = "",
  description = "",
  visibility = "public",
  thumbnail = "",
}) {
  if (!hostId) {
    throw new Error("Host is required");
  }

  const existingLive = await getActiveLiveForHost(hostId);

  if (existingLive) {
    const error = new Error("You are already live");
    error.code = "ALREADY_LIVE";
    throw error;
  }

  const roomId = generateRoomId();

  const live = await Live.create({
    host: hostId,
    title: String(title || "").trim().slice(0, 100),
    description: String(description || "").trim().slice(0, 500),

    visibility:
      visibility === "followers"
        ? "followers"
        : "public",

    thumbnail: thumbnail || "",

    status: "live",
    isActive: true,

    roomId,

    viewerCount: 0,
    peakViewerCount: 0,
    likesCount: 0,
    commentsCount: 0,

    startedAt: new Date(),
  });

  return Live.findById(live._id).populate(
    "host",
    "username fullName avatar isVerified"
  );
}

async function getLiveById(liveId) {
  return Live.findById(liveId).populate(
    "host",
    "username fullName avatar isVerified"
  );
}

async function getActiveLives({
  page = 1,
  limit = 20,
} = {}) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(
    Math.max(Number(limit) || 20, 1),
    50
  );

  const skip = (safePage - 1) * safeLimit;

  const filter = {
    status: "live",
    isActive: true,
    visibility: "public",
  };

  const [lives, total] = await Promise.all([
    Live.find(filter)
      .populate(
        "host",
        "username fullName avatar isVerified"
      )
      .sort({
        viewerCount: -1,
        startedAt: -1,
      })
      .skip(skip)
      .limit(safeLimit),

    Live.countDocuments(filter),
  ]);

  return {
    lives,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      hasMore: skip + lives.length < total,
    },
  };
}

async function getFollowingLives({
  userId,
  page = 1,
  limit = 20,
}) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(
    Math.max(Number(limit) || 20, 1),
    50
  );

  const skip = (safePage - 1) * safeLimit;

  const following = await Follow.find({
    follower: userId,
  }).select("following");

  const followingIds = following.map(
    (relationship) => relationship.following
  );

  if (!followingIds.length) {
    return {
      lives: [],
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: 0,
        hasMore: false,
      },
    };
  }

  const filter = {
    host: { $in: followingIds },
    status: "live",
    isActive: true,
  };

  const [lives, total] = await Promise.all([
    Live.find(filter)
      .populate(
        "host",
        "username fullName avatar isVerified"
      )
      .sort({
        startedAt: -1,
      })
      .skip(skip)
      .limit(safeLimit),

    Live.countDocuments(filter),
  ]);

  return {
    lives,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      hasMore: skip + lives.length < total,
    },
  };
}

async function joinLive({
  liveId,
}) {
  const live = await Live.findOneAndUpdate(
    {
      _id: liveId,
      status: "live",
      isActive: true,
    },
    {
      $inc: {
        viewerCount: 1,
      },
    },
    {
      new: true,
    }
  ).populate(
    "host",
    "username fullName avatar isVerified"
  );

  if (!live) {
    const error = new Error("Live session is no longer available");
    error.code = "LIVE_NOT_FOUND";
    throw error;
  }

  if (live.viewerCount > live.peakViewerCount) {
    live.peakViewerCount = live.viewerCount;
    await live.save();
  }

  return live;
}

async function leaveLive({
  liveId,
}) {
  const live = await Live.findOneAndUpdate(
    {
      _id: liveId,
      status: "live",
      isActive: true,
      viewerCount: {
        $gt: 0,
      },
    },
    {
      $inc: {
        viewerCount: -1,
      },
    },
    {
      new: true,
    }
  ).populate(
    "host",
    "username fullName avatar isVerified"
  );

  if (!live) {
    return Live.findById(liveId).populate(
      "host",
      "username fullName avatar isVerified"
    );
  }

  return live;
}

async function endLive({
  liveId,
  hostId,
}) {
  const live = await Live.findOne({
    _id: liveId,
    host: hostId,
    isActive: true,
  });

  if (!live) {
    const error = new Error(
      "Live session not found or you are not the host"
    );

    error.code = "LIVE_NOT_FOUND";

    throw error;
  }

  live.status = "ended";
  live.isActive = false;
  live.endedAt = new Date();
  live.viewerCount = 0;

  await live.save();

  return Live.findById(live._id).populate(
    "host",
    "username fullName avatar isVerified"
  );
}

async function incrementLikes(liveId) {
  return Live.findOneAndUpdate(
    {
      _id: liveId,
      status: "live",
      isActive: true,
    },
    {
      $inc: {
        likesCount: 1,
      },
    },
    {
      new: true,
    }
  );
}

async function incrementComments(liveId) {
  return Live.findOneAndUpdate(
    {
      _id: liveId,
      status: "live",
      isActive: true,
    },
    {
      $inc: {
        commentsCount: 1,
      },
    },
    {
      new: true,
    }
  );
}

async function getLiveFollowers(hostId) {
  const follows = await Follow.find({
    following: hostId,
  }).select("follower");

  return follows.map(
    (follow) => follow.follower
  );
}

module.exports = {
  generateRoomId,
  serializeLive,

  getActiveLiveForHost,

  startLive,
  getLiveById,

  getActiveLives,
  getFollowingLives,

  joinLive,
  leaveLive,

  endLive,

  incrementLikes,
  incrementComments,

  getLiveFollowers,
};
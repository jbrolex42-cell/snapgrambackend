const liveService = require("../services/liveService");

async function startLive(req, res) {
  try {
    const hostId = req.user?._id;

    if (!hostId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const {
      title,
      description,
      visibility,
      thumbnail,
    } = req.body;

    const live = await liveService.startLive({
      hostId,
      title,
      description,
      visibility,
      thumbnail,
    });

    return res.status(201).json({
      success: true,
      message: "You are now live",
      live,
    });
  } catch (error) {
    console.error("START LIVE ERROR:", error);

    if (error.code === "ALREADY_LIVE") {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to start live",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
}

async function getLive(req, res) {
  try {
    const { id } = req.params;

    const live = await liveService.getLiveById(id);

    if (!live) {
      return res.status(404).json({
        success: false,
        message: "Live session not found",
      });
    }

    return res.json({
      success: true,
      live,
    });
  } catch (error) {
    console.error("GET LIVE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get live session",
    });
  }
}

async function getActiveLives(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
    } = req.query;

    const result =
      await liveService.getActiveLives({
        page,
        limit,
      });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "GET ACTIVE LIVES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load live sessions",
    });
  }
}

async function getFollowingLives(req, res) {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const {
      page = 1,
      limit = 20,
    } = req.query;

    const result =
      await liveService.getFollowingLives({
        userId,
        page,
        limit,
      });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "GET FOLLOWING LIVES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load following lives",
    });
  }
}

async function joinLive(req, res) {
  try {
    const { id } = req.params;

    const live = await liveService.joinLive({
      liveId: id,
    });

    return res.json({
      success: true,
      message: "Joined live",
      live,
    });
  } catch (error) {
    console.error("JOIN LIVE ERROR:", error);

    if (error.code === "LIVE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to join live",
    });
  }
}

async function leaveLive(req, res) {
  try {
    const { id } = req.params;

    const live = await liveService.leaveLive({
      liveId: id,
    });

    if (!live) {
      return res.status(404).json({
        success: false,
        message: "Live session not found",
      });
    }

    return res.json({
      success: true,
      message: "Left live",
      live,
    });
  } catch (error) {
    console.error("LEAVE LIVE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to leave live",
    });
  }
}

async function endLive(req, res) {
  try {
    const hostId = req.user?._id;
    const { id } = req.params;

    if (!hostId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const live = await liveService.endLive({
      liveId: id,
      hostId,
    });

    return res.json({
      success: true,
      message: "Live ended",
      live,
    });
  } catch (error) {
    console.error("END LIVE ERROR:", error);

    if (error.code === "LIVE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to end live",
    });
  }
}

async function likeLive(req, res) {
  try {
    const { id } = req.params;

    const live =
      await liveService.incrementLikes(id);

    if (!live) {
      return res.status(404).json({
        success: false,
        message: "Live session is no longer active",
      });
    }

    return res.json({
      success: true,
      likesCount: live.likesCount,
      live,
    });
  } catch (error) {
    console.error("LIKE LIVE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to like live",
    });
  }
}

async function commentLive(req, res) {
  try {
    const { id } = req.params;

    const live =
      await liveService.incrementComments(id);

    if (!live) {
      return res.status(404).json({
        success: false,
        message: "Live session is no longer active",
      });
    }

    return res.json({
      success: true,
      commentsCount: live.commentsCount,
      live,
    });
  } catch (error) {
    console.error(
      "COMMENT LIVE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to comment on live",
    });
  }
}

module.exports = {
  startLive,
  getLive,

  getActiveLives,
  getFollowingLives,

  joinLive,
  leaveLive,

  endLive,

  likeLive,
  commentLive,
};
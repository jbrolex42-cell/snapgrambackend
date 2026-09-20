const {
  searchTracks,
  getFeaturedTracks,
  getPopularTracks,
  getTrackById,
  getTrackPreview,
  getTrackDownload,
  createTrackVersion,
  getTrackVersion,
  incrementPlayCount,
  incrementUseCount,
} = require("../services/music/musicProvider");

function getUserId(req) {
  return (
    req.user?._id?.toString() ||
    req.user?.id?.toString() ||
    req.userId?.toString() ||
    null
  );
}

async function searchMusic(req, res) {
  try {
    const result =
      await searchTracks({
        query: req.query.q || "",
        page: req.query.page || 1,
        limit: req.query.limit || 20,
      });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "[MUSIC] SEARCH ERROR:",
      error
    );

    return res.status(
      error.status || 500
    ).json({
      success: false,
      message:
        "Unable to search music.",
    });
  }
}

async function getFeaturedMusic(
  req,
  res
) {
  try {
    const tracks =
      await getFeaturedTracks(
        req.query.limit || 20
      );

    return res.json({
      success: true,
      tracks,
    });
  } catch (error) {
    console.error(
      "[MUSIC] FEATURED ERROR:",
      error
    );

    return res.status(
      error.status || 500
    ).json({
      success: false,
      message:
        "Unable to load featured music.",
    });
  }
}

async function getPopularMusic(
  req,
  res
) {
  try {
    const tracks =
      await getPopularTracks(
        req.query.limit || 20
      );

    return res.json({
      success: true,
      tracks,
    });
  } catch (error) {
    console.error(
      "[MUSIC] POPULAR ERROR:",
      error
    );

    return res.status(
      error.status || 500
    ).json({
      success: false,
      message:
        "Unable to load popular music.",
    });
  }
}

async function getMusicTrack(
  req,
  res
) {
  try {
    const track =
      await getTrackById(
        req.params.id
      );

    if (!track) {
      return res.status(404).json({
        success: false,
        message:
          "Music track not found.",
      });
    }

    return res.json({
      success: true,
      track,
    });
  } catch (error) {
    console.error(
      "[MUSIC] GET TRACK ERROR:",
      error
    );

    return res.status(
      error.status || 500
    ).json({
      success: false,
      message:
        "Unable to load music track.",
    });
  }
}

async function previewMusic(
  req,
  res
) {
  try {
    const preview =
      await getTrackPreview(
        req.params.id
      );

    return res.json({
      success: true,
      trackId: req.params.id,
      ...preview,
    });
  } catch (error) {
    console.error(
      "[MUSIC] PREVIEW ERROR:",
      error
    );

    return res.status(
      error.status || 500
    ).json({
      success: false,
      message:
        "Unable to preview music.",
    });
  }
}

async function downloadMusic(
  req,
  res
) {
  try {
    const quality =
      req.query.quality === "high"
        ? "high"
        : "normal";

    const result =
      await getTrackDownload(
        req.params.id,
        quality
      );

    return res.json({
      success: true,
      trackId: req.params.id,
      ...result,
    });
  } catch (error) {
    console.error(
      "[MUSIC] DOWNLOAD ERROR:",
      error
    );

    return res.status(
      error.status || 500
    ).json({
      success: false,
      message:
        "Unable to prepare music.",
    });
  }
}

async function createMusicVersion(
  req,
  res
) {
  try {
    const {
      trackId,
      durationMs,
    } = req.body;

    const duration =
      Number(durationMs);

    if (!trackId) {
      return res.status(400).json({
        success: false,
        message:
          "Track ID is required.",
      });
    }

    if (
      !Number.isFinite(duration) ||
      duration < 1000 ||
      duration > 300000
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Duration must be between 1 second and 5 minutes.",
      });
    }

    const result =
      await createTrackVersion(
        trackId,
        duration
      );

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "[MUSIC] VERSION ERROR:",
      error
    );

    return res.status(
      error.status || 500
    ).json({
      success: false,
      message:
        "Unable to create music version.",
    });
  }
}

async function getMusicVersion(
  req,
  res
) {
  try {
    const result =
      await getTrackVersion(
        req.params.jobId
      );

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "[MUSIC] VERSION STATUS ERROR:",
      error
    );

    return res.status(
      error.status || 500
    ).json({
      success: false,
      message:
        "Unable to check music version.",
    });
  }
}

async function playMusic(
  req,
  res
) {
  try {
    await incrementPlayCount(
      req.params.id
    );

    return res.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "[MUSIC] PLAY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to record music play.",
    });
  }
}

async function useMusic(
  req,
  res
) {
  try {
    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    await incrementUseCount(
      req.params.id
    );

    return res.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "[MUSIC] USE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to record music usage.",
    });
  }
}

module.exports = {
  searchMusic,
  getFeaturedMusic,
  getPopularMusic,
  getMusicTrack,
  previewMusic,
  downloadMusic,
  createMusicVersion,
  getMusicVersion,
  playMusic,
  useMusic,
};
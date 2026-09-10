const mongoose = require("mongoose");
const Highlight = require("../models/Highlight");
const Story = require("../models/Story");

function getUserId(req) {
  return req.user?._id || req.user?.id || req.user?.userId;
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function normalizeHighlight(highlight) {
  if (!highlight) return null;

  const item =
    typeof highlight.toObject === "function"
      ? highlight.toObject()
      : highlight;

  return {
    ...item,
    storyIds: Array.isArray(item.storyIds)
      ? item.storyIds
      : [],
    coverUrl: item.coverUrl || "",
  };
}

const getUserHighlights = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const highlights = await Highlight.find({
      user: userId,
    })
      .sort({ createdAt: -1 })
      .populate({
        path: "user",
        select: "_id username name profilePicture avatar",
      })
      .populate({
        path: "storyIds",
        select: "_id mediaUrl mediaType caption user createdAt expiresAt",
      })
      .lean();

    return res.status(200).json({
      success: true,
      highlights,
    });
  } catch (error) {
    console.error("GET USER HIGHLIGHTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load highlights",
      error: error.message,
    });
  }
};

const getHighlightById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid highlight ID",
      });
    }

    const highlight = await Highlight.findById(id)
      .populate({
        path: "user",
        select: "_id username name profilePicture avatar",
      })
      .populate({
        path: "storyIds",
        select:
          "_id user mediaUrl mediaType caption createdAt expiresAt viewers likes replies",
      })
      .lean();

    if (!highlight) {
      return res.status(404).json({
        success: false,
        message: "Highlight not found",
      });
    }

    return res.status(200).json({
      success: true,
      highlight,
    });
  } catch (error) {
    console.error("GET HIGHLIGHT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load highlight",
      error: error.message,
    });
  }
};

const getMyHighlights = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const highlights = await Highlight.find({
      user: userId,
    })
      .sort({ createdAt: -1 })
      .populate({
        path: "storyIds",
        select: "_id mediaUrl mediaType caption user createdAt expiresAt",
      })
      .lean();

    return res.status(200).json({
      success: true,
      highlights,
    });
  } catch (error) {
    console.error("GET MY HIGHLIGHTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load your highlights",
      error: error.message,
    });
  }
};

const createHighlight = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    let { title, storyIds, coverUrl } = req.body;

    if (!title || !String(title).trim()) {
      title = "Highlight";
    }

    title = String(title).trim().slice(0, 30);

    if (typeof storyIds === "string") {
      try {
        storyIds = JSON.parse(storyIds);
      } catch {
        storyIds = storyIds
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);
      }
    }

    if (!Array.isArray(storyIds)) {
      storyIds = [];
    }

    storyIds = [
      ...new Set(
        storyIds
          .map((id) => String(id).trim())
          .filter((id) => isValidObjectId(id))
      ),
    ];

    if (storyIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Select at least one story",
      });
    }

    const stories = await Story.find({
      _id: { $in: storyIds },
      user: userId,
    }).select("_id mediaUrl mediaType");

    if (!stories.length) {
      return res.status(400).json({
        success: false,
        message: "No valid stories were found",
      });
    }

    const validStoryIds = stories.map((story) => story._id);

    let finalCoverUrl = "";

    if (coverUrl && typeof coverUrl === "string") {
      finalCoverUrl = coverUrl.trim();
    }

    if (!finalCoverUrl) {
      const firstStory = stories.find(
        (story) =>
          story.mediaUrl &&
          typeof story.mediaUrl === "string" &&
          story.mediaUrl.length > 0
      );

      finalCoverUrl = firstStory?.mediaUrl || "";
    }

    const highlight = await Highlight.create({
      user: userId,
      title,
      storyIds: validStoryIds,
      coverUrl: finalCoverUrl,
    });

    const populatedHighlight = await Highlight.findById(highlight._id)
      .populate({
        path: "user",
        select: "_id username name profilePicture avatar",
      })
      .populate({
        path: "storyIds",
        select: "_id mediaUrl mediaType caption user createdAt expiresAt",
      })
      .lean();

    return res.status(201).json({
      success: true,
      message: "Highlight created successfully",
      highlight: populatedHighlight,
    });
  } catch (error) {
    console.error("CREATE HIGHLIGHT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create highlight",
      error: error.message,
    });
  }
};

const updateHighlight = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid highlight ID",
      });
    }

    const highlight = await Highlight.findOne({
      _id: id,
      user: userId,
    });

    if (!highlight) {
      return res.status(404).json({
        success: false,
        message: "Highlight not found",
      });
    }

    const { title, coverUrl, storyIds } = req.body;

    if (title !== undefined) {
      highlight.title =
        String(title || "Highlight")
          .trim()
          .slice(0, 30) || "Highlight";
    }

    if (coverUrl !== undefined) {
      highlight.coverUrl = String(coverUrl || "").trim();
    }

    if (storyIds !== undefined) {
      let ids = storyIds;

      if (typeof ids === "string") {
        try {
          ids = JSON.parse(ids);
        } catch {
          ids = ids
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
        }
      }

      if (!Array.isArray(ids)) {
        ids = [];
      }

      ids = [
        ...new Set(
          ids
            .map((item) => String(item).trim())
            .filter((item) => isValidObjectId(item))
        ),
      ];

      const stories = await Story.find({
        _id: { $in: ids },
        user: userId,
      }).select("_id");

      highlight.storyIds = stories.map((story) => story._id);
    }

    await highlight.save();

    const updatedHighlight = await Highlight.findById(highlight._id)
      .populate({
        path: "user",
        select: "_id username name profilePicture avatar",
      })
      .populate({
        path: "storyIds",
        select: "_id mediaUrl mediaType caption user createdAt expiresAt",
      })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Highlight updated successfully",
      highlight: updatedHighlight,
    });
  } catch (error) {
    console.error("UPDATE HIGHLIGHT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update highlight",
      error: error.message,
    });
  }
};

const deleteHighlight = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid highlight ID",
      });
    }

    const highlight = await Highlight.findOneAndDelete({
      _id: id,
      user: userId,
    });

    if (!highlight) {
      return res.status(404).json({
        success: false,
        message: "Highlight not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Highlight deleted successfully",
    });
  } catch (error) {
    console.error("DELETE HIGHLIGHT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete highlight",
      error: error.message,
    });
  }
};

const addStoriesToHighlight = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid highlight ID",
      });
    }

    let { storyIds } = req.body;

    if (typeof storyIds === "string") {
      try {
        storyIds = JSON.parse(storyIds);
      } catch {
        storyIds = storyIds
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }

    if (!Array.isArray(storyIds)) {
      return res.status(400).json({
        success: false,
        message: "storyIds must be an array",
      });
    }

    const validIds = storyIds.filter((item) => isValidObjectId(item));

    const stories = await Story.find({
      _id: { $in: validIds },
      user: userId,
    }).select("_id mediaUrl mediaType");

    if (!stories.length) {
      return res.status(400).json({
        success: false,
        message: "No valid stories found",
      });
    }

    const highlight = await Highlight.findOne({
      _id: id,
      user: userId,
    });

    if (!highlight) {
      return res.status(404).json({
        success: false,
        message: "Highlight not found",
      });
    }

    const existing = highlight.storyIds.map((storyId) =>
      storyId.toString()
    );

    const additions = stories
      .map((story) => story._id)
      .filter((storyId) => !existing.includes(storyId.toString()));

    highlight.storyIds.push(...additions);

    if (!highlight.coverUrl && stories[0]?.mediaUrl) {
      highlight.coverUrl = stories[0].mediaUrl;
    }

    await highlight.save();

    const updated = await Highlight.findById(highlight._id)
      .populate({
        path: "storyIds",
        select: "_id mediaUrl mediaType caption user createdAt expiresAt",
      })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Stories added to highlight",
      highlight: updated,
    });
  } catch (error) {
    console.error("ADD STORIES TO HIGHLIGHT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add stories",
      error: error.message,
    });
  }
};

const removeStoryFromHighlight = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id, storyId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!isValidObjectId(id) || !isValidObjectId(storyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid highlight or story ID",
      });
    }

    const highlight = await Highlight.findOne({
      _id: id,
      user: userId,
    });

    if (!highlight) {
      return res.status(404).json({
        success: false,
        message: "Highlight not found",
      });
    }

    highlight.storyIds = highlight.storyIds.filter(
      (item) => item.toString() !== storyId
    );

    await highlight.save();

    return res.status(200).json({
      success: true,
      message: "Story removed from highlight",
      highlight,
    });
  } catch (error) {
    console.error("REMOVE STORY FROM HIGHLIGHT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove story",
      error: error.message,
    });
  }
};

module.exports = {
  getUserHighlights,
  getHighlightById,
  getMyHighlights,
  createHighlight,
  updateHighlight,
  deleteHighlight,
  addStoriesToHighlight,
  removeStoryFromHighlight,
};
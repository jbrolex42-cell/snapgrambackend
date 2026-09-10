const uploadToCloudinary =
  require("../utils/uploadToCloudinary");

const Story =
  require("../models/Story");

function getCurrentUserId(req) {
  return req.user?._id
    ? String(req.user._id)
    : null;
}

function formatStory(story, userId) {
  const likes = Array.isArray(story.likes)
    ? story.likes
    : [];

  const isLiked = userId
    ? likes.some(
        (id) =>
          String(id) === String(userId)
      )
    : false;

  return {
    ...story.toObject(),

    isLiked,
    liked: isLiked,
    likesCount: likes.length,
  };
}

async function getStories(req, res) {
  try {
    const stories =
      await Story.find({
        expiresAt: {
          $gt: new Date(),
        },
      })
        .populate(
          "user",
          "username fullName avatar isVerified"
        )
        .sort({
          createdAt: 1,
        });

    const userId =
      getCurrentUserId(req);

    const formattedStories =
      stories.map((story) =>
        formatStory(
          story,
          userId
        )
      );

    return res.json({
      success: true,
      stories:
        formattedStories,
    });
  } catch (error) {
    console.error(
      "GET STORIES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load stories",
    });
  }
}

async function getStoryGroups(
  req,
  res
) {
  try {
    const stories =
      await Story.find({
        expiresAt: {
          $gt: new Date(),
        },
      })
        .populate(
          "user",
          "username fullName avatar isVerified"
        )
        .sort({
          createdAt: 1,
        });

    const userId =
      getCurrentUserId(req);

    const groups = {};

    stories.forEach((story) => {
      if (!story.user) {
        return;
      }

      const storyUserId =
        story.user._id.toString();

      if (!groups[storyUserId]) {
        groups[storyUserId] = {
          user: story.user,
          stories: [],
        };
      }

      groups[storyUserId].stories.push(
        formatStory(
          story,
          userId
        )
      );
    });

    return res.json({
      success: true,
      groups:
        Object.values(groups),
    });
  } catch (error) {
    console.error(
      "GET STORY GROUPS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load story groups",
    });
  }
}

async function getUserStories(
  req,
  res
) {
  try {
    const stories =
      await Story.find({
        user:
          req.params.userId,

        expiresAt: {
          $gt: new Date(),
        },
      })
        .populate(
          "user",
          "username fullName avatar isVerified"
        )
        .sort({
          createdAt: 1,
        });

    const userId =
      getCurrentUserId(req);

    const formattedStories =
      stories.map((story) =>
        formatStory(
          story,
          userId
        )
      );

    return res.json({
      success: true,
      stories:
        formattedStories,
    });
  } catch (error) {
    console.error(
      "GET USER STORIES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load user stories",
    });
  }
}

async function createStory(
  req,
  res
) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message:
          "Story media is required",
      });
    }

    const isVideo =
      req.file.mimetype.startsWith(
        "video/"
      );

    const resourceType =
      isVideo
        ? "video"
        : "image";

    const result =
      await uploadToCloudinary(
        req.file.buffer,
        "snapgram/stories",
        resourceType
      );

    if (!result?.secure_url) {
      return res.status(500).json({
        success: false,
        message:
          "Story upload failed",
      });
    }

    const expiresAt =
      new Date(
        Date.now() +
          24 *
            60 *
            60 *
            1000
      );

    const story =
      await Story.create({
        user:
          req.user._id,

        mediaUrl:
          result.secure_url,

        mediaType:
          isVideo
            ? "video"
            : "image",

        caption:
          typeof req.body.caption ===
          "string"
            ? req.body.caption.trim()
            : "",

        expiresAt,
      });

    const populatedStory =
      await Story.findById(
        story._id
      ).populate(
        "user",
        "username fullName avatar isVerified"
      );

    return res.status(201).json({
      success: true,
      story:
        formatStory(
          populatedStory,
          getCurrentUserId(req)
        ),
    });
  } catch (error) {
    console.error(
      "CREATE STORY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to upload story",
    });
  }
}

async function viewStory(
  req,
  res
) {
  try {
    const story =
      await Story.findOne({
        _id:
          req.params.id,

        expiresAt: {
          $gt: new Date(),
        },
      });

    if (!story) {
      return res.status(404).json({
        success: false,
        message:
          "Story not found or expired",
      });
    }

    if (
      !Array.isArray(
        story.viewers
      )
    ) {
      story.viewers = [];
    }

    const currentUserId =
      getCurrentUserId(req);

    const alreadyViewed =
      story.viewers.some(
        (id) =>
          String(id) ===
          String(currentUserId)
      );

    if (!alreadyViewed) {
      story.viewers.push(
        req.user._id
      );

      await story.save();
    }

    return res.json({
      success: true,
      viewed: true,
      viewersCount:
        story.viewers.length,
    });
  } catch (error) {
    console.error(
      "VIEW STORY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to view story",
    });
  }
}

async function deleteStory(
  req,
  res
) {
  try {
    const story =
      await Story.findOneAndDelete({
        _id:
          req.params.id,

        user:
          req.user._id,
      });

    if (!story) {
      return res.status(404).json({
        success: false,
        message:
          "Story not found",
      });
    }

    return res.json({
      success: true,
      message:
        "Story deleted",
    });
  } catch (error) {
    console.error(
      "DELETE STORY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to delete story",
    });
  }
}

async function likeStory(
  req,
  res
) {
  try {
    const story =
      await Story.findOne({
        _id:
          req.params.id,

        expiresAt: {
          $gt: new Date(),
        },
      });

    if (!story) {
      return res.status(404).json({
        success: false,
        message:
          "Story not found or expired",
      });
    }

    if (
      !Array.isArray(
        story.likes
      )
    ) {
      story.likes = [];
    }

    const userId =
      getCurrentUserId(req);

    const alreadyLiked =
      story.likes.some(
        (id) =>
          String(id) ===
          String(userId)
      );

    if (!alreadyLiked) {
      story.likes.push(
        req.user._id
      );

      await story.save();
    }

    return res.json({
      success: true,
      liked: true,
      isLiked: true,
      likesCount:
        story.likes.length,
      storyId:
        String(story._id),
    });
  } catch (error) {
    console.error(
      "LIKE STORY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to like story",
    });
  }
}

async function unlikeStory(
  req,
  res
) {
  try {
    const story =
      await Story.findOne({
        _id:
          req.params.id,

        expiresAt: {
          $gt: new Date(),
        },
      });

    if (!story) {
      return res.status(404).json({
        success: false,
        message:
          "Story not found or expired",
      });
    }

    if (
      !Array.isArray(
        story.likes
      )
    ) {
      story.likes = [];
    }

    const userId =
      getCurrentUserId(req);

    story.likes =
      story.likes.filter(
        (id) =>
          String(id) !==
          String(userId)
      );

    await story.save();

    return res.json({
      success: true,
      liked: false,
      isLiked: false,
      likesCount:
        story.likes.length,
      storyId:
        String(story._id),
    });
  } catch (error) {
    console.error(
      "UNLIKE STORY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to unlike story",
    });
  }
}

async function toggleStoryLike(
  req,
  res
) {
  try {
    const story =
      await Story.findOne({
        _id:
          req.params.id,

        expiresAt: {
          $gt: new Date(),
        },
      });

    if (!story) {
      return res.status(404).json({
        success: false,
        message:
          "Story not found or expired",
      });
    }

    if (
      !Array.isArray(
        story.likes
      )
    ) {
      story.likes = [];
    }

    const userId =
      getCurrentUserId(req);

    const existingIndex =
      story.likes.findIndex(
        (id) =>
          String(id) ===
          String(userId)
      );

    let liked;

    if (existingIndex !== -1) {
      story.likes.splice(
        existingIndex,
        1
      );

      liked = false;
    } else {
      story.likes.push(
        req.user._id
      );

      liked = true;
    }

    await story.save();

    return res.json({
      success: true,
      liked,
      isLiked: liked,
      likesCount:
        story.likes.length,
      storyId:
        String(story._id),
    });
  } catch (error) {
    console.error(
      "TOGGLE STORY LIKE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update story like",
    });
  }
}

async function replyToStory(
  req,
  res
) {
  try {
    const text =
      typeof req.body.text ===
      "string"
        ? req.body.text.trim()
        : "";

    if (!text) {
      return res.status(400).json({
        success: false,
        message:
          "Reply cannot be empty",
      });
    }

    if (text.length > 500) {
      return res.status(400).json({
        success: false,
        message:
          "Reply cannot exceed 500 characters",
      });
    }

    const story =
      await Story.findOne({
        _id:
          req.params.id,

        expiresAt: {
          $gt: new Date(),
        },
      });

    if (!story) {
      return res.status(404).json({
        success: false,
        message:
          "Story not found or expired",
      });
    }

    if (
      !Array.isArray(
        story.replies
      )
    ) {
      story.replies = [];
    }

    story.replies.push({
      user:
        req.user._id,

      text,
    });

    await story.save();

    const updatedStory =
      await Story.findById(
        story._id
      ).populate(
        "replies.user",
        "username fullName avatar isVerified"
      );

    const reply =
      updatedStory?.replies?.[
        updatedStory.replies.length - 1
      ];

    return res.status(201).json({
      success: true,
      reply,
    });
  } catch (error) {
    console.error(
      "REPLY TO STORY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to reply to story",
    });
  }
}

async function getStoryReplies(
  req,
  res
) {
  try {
    const story =
      await Story.findOne({
        _id:
          req.params.id,

        expiresAt: {
          $gt: new Date(),
        },
      }).populate(
        "replies.user",
        "username fullName avatar isVerified"
      );

    if (!story) {
      return res.status(404).json({
        success: false,
        message:
          "Story not found or expired",
      });
    }

    return res.json({
      success: true,
      replies:
        story.replies || [],
    });
  } catch (error) {
    console.error(
      "GET STORY REPLIES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load replies",
    });
  }
}

async function getStoryViewers(
  req,
  res
) {
  try {
    const story =
      await Story.findOne({
        _id:
          req.params.id,

        user:
          req.user._id,
      }).populate(
        "viewers",
        "username fullName avatar isVerified"
      );

    if (!story) {
      return res.status(404).json({
        success: false,
        message:
          "Story not found",
      });
    }

    return res.json({
      success: true,
      viewers:
        story.viewers || [],
      count:
        story.viewers?.length ||
        0,
    });
  } catch (error) {
    console.error(
      "GET STORY VIEWERS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get story viewers",
    });
  }
}

module.exports = {
  getStories,
  getStoryGroups,
  getUserStories,

  createStory,
  viewStory,
  deleteStory,

  likeStory,
  unlikeStory,
  toggleStoryLike,

  replyToStory,
  getStoryReplies,
  getStoryViewers,
};
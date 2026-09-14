const mongoose = require("mongoose");

const uploadToCloudinary =
  require("../utils/uploadToCloudinary");

const Story =
  require("../models/Story");

function getCurrentUserId(req) {
  return req.user?._id
    ? String(req.user._id)
    : null;
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function formatStory(story, userId) {
  if (!story) {
    return null;
  }

  const plainStory =
    typeof story.toObject === "function"
      ? story.toObject()
      : story;

  const likes = Array.isArray(
    plainStory.likes
  )
    ? plainStory.likes
    : [];

  const isLiked = userId
    ? likes.some(
        (id) =>
          String(id) ===
          String(userId)
      )
    : false;

  return {
    ...plainStory,

    isLiked,
    liked: isLiked,

    likesCount:
      likes.length,

    viewerCount:
      Array.isArray(
        plainStory.viewers
      )
        ? plainStory.viewers.length
        : 0,
  };
}

function activeStoryFilter() {
  return {
    expiresAt: {
      $gt: new Date(),
    },
  };
}

async function getStories(req, res) {
  try {
    const stories =
      await Story.find(
        activeStoryFilter()
      )
        .populate(
          "user",
          "username fullName avatar isVerified"
        )
        .sort({
          createdAt: 1,
        });

    const userId =
      getCurrentUserId(req);

    return res.json({
      success: true,

      stories: stories.map(
        (story) =>
          formatStory(
            story,
            userId
          )
      ),
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
      await Story.find(
        activeStoryFilter()
      )
        .populate(
          "user",
          "username fullName avatar isVerified"
        )
        .sort({
          createdAt: 1,
        });

    const userId =
      getCurrentUserId(req);

    const groups = new Map();

    for (const story of stories) {
      if (!story.user) {
        continue;
      }

      const storyUserId =
        String(story.user._id);

      if (!groups.has(storyUserId)) {
        groups.set(
          storyUserId,
          {
            user: story.user,
            stories: [],
          }
        );
      }

      groups
        .get(storyUserId)
        .stories.push(
          formatStory(
            story,
            userId
          )
        );
    }

    return res.json({
      success: true,
      groups:
        Array.from(
          groups.values()
        ),
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
    const { userId } =
      req.params;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid user ID",
      });
    }

    const stories =
      await Story.find({
        user: userId,
        ...activeStoryFilter(),
      })
        .populate(
          "user",
          "username fullName avatar isVerified"
        )
        .sort({
          createdAt: 1,
        });

    const currentUserId =
      getCurrentUserId(req);

    return res.json({
      success: true,

      stories: stories.map(
        (story) =>
          formatStory(
            story,
            currentUserId
          )
      ),
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
   
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    if (!req.file) {
      console.error(
        "CREATE STORY: NO FILE RECEIVED"
      );

      console.error(
        "BODY:",
        req.body
      );

      return res.status(400).json({
        success: false,
        message:
          "Story media is required",
      });
    }

    console.log(
      "CREATE STORY FILE:",
      {
        fieldname:
          req.file.fieldname,

        originalname:
          req.file.originalname,

        mimetype:
          req.file.mimetype,

        size:
          req.file.size,

        hasBuffer:
          Buffer.isBuffer(
            req.file.buffer
          ),
      }
    );

    if (
      !req.file.buffer ||
      !Buffer.isBuffer(
        req.file.buffer
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Uploaded story file is invalid",
      });
    }

    const isVideo =
      req.file.mimetype?.startsWith(
        "video/"
      );

    const mediaType =
      isVideo
        ? "video"
        : "image";

    const resourceType =
      isVideo
        ? "video"
        : "image";

    let caption = "";

    if (
      typeof req.body?.caption ===
      "string"
    ) {
      caption =
        req.body.caption.trim();
    }

    if (caption.length > 500) {
      return res.status(400).json({
        success: false,
        message:
          "Caption cannot exceed 500 characters",
      });
    }

    let uploadResult;

    try {
      uploadResult =
        await uploadToCloudinary(
          req.file.buffer,
          "snapgram/stories",
          resourceType
        );
    } catch (uploadError) {
      console.error(
        "CLOUDINARY STORY UPLOAD ERROR:",
        uploadError
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to upload story media",
      });
    }

    if (
      !uploadResult?.secure_url
    ) {
      console.error(
        "CLOUDINARY RESULT INVALID:",
        uploadResult
      );

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
          uploadResult.secure_url,

        mediaType,

        caption,

        expiresAt,
      });

    const populatedStory =
      await Story.findById(
        story._id
      ).populate(
        "user",
        "username fullName avatar isVerified"
      );

    console.log(
      "CREATE STORY SUCCESS:",
      {
        storyId:
          String(story._id),

        userId:
          String(req.user._id),

        mediaType,

        mediaUrl:
          uploadResult.secure_url,
      }
    );

    return res.status(201).json({
      success: true,

      story: formatStory(
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
    const { id } =
      req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid story ID",
      });
    }

    const story =
      await Story.findOne({
        _id: id,
        ...activeStoryFilter(),
      });

    if (!story) {
      return res.status(404).json({
        success: false,
        message:
          "Story not found or expired",
      });
    }

    const userId =
      getCurrentUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    if (
      !Array.isArray(
        story.viewers
      )
    ) {
      story.viewers = [];
    }

    const alreadyViewed =
      story.viewers.some(
        (viewerId) =>
          String(viewerId) ===
          String(userId)
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
    const { id } =
      req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid story ID",
      });
    }

    const story =
      await Story.findOneAndDelete({
        _id: id,
        user: req.user._id,
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
      storyId: String(
        story._id
      ),
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
        _id: req.params.id,
        ...activeStoryFilter(),
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
        _id: req.params.id,
        ...activeStoryFilter(),
      });

    if (!story) {
      return res.status(404).json({
        success: false,
        message:
          "Story not found or expired",
      });
    }

    const userId =
      getCurrentUserId(req);

    story.likes =
      Array.isArray(
        story.likes
      )
        ? story.likes.filter(
            (id) =>
              String(id) !==
              String(userId)
          )
        : [];

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
        _id: req.params.id,
        ...activeStoryFilter(),
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

    if (existingIndex >= 0) {
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
      typeof req.body?.text ===
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
        _id: req.params.id,
        ...activeStoryFilter(),
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
        _id: req.params.id,
        ...activeStoryFilter(),
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
        _id: req.params.id,
        user: req.user._id,
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
        Array.isArray(
          story.viewers
        )
          ? story.viewers.length
          : 0,
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
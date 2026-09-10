const express = require("express");

const router = express.Router();

const protect =
  require("../middleware/auth");

const upload =
  require("../middleware/uploadMiddleware");

const {
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
} = require("../controllers/storyController");

router.get(
  "/",
  protect,
  getStories
);

router.get(
  "/groups",
  protect,
  getStoryGroups
);

router.get(
  "/user/:userId",
  protect,
  getUserStories
);

router.post(
  "/",
  protect,
  upload.single("media"),
  createStory
);

router.post(
  "/:id/view",
  protect,
  viewStory
);

router.delete(
  "/:id",
  protect,
  deleteStory
);

router.post(
  "/:id/like",
  protect,
  likeStory
);

router.delete(
  "/:id/like",
  protect,
  unlikeStory
);

router.post(
  "/:id/toggle-like",
  protect,
  toggleStoryLike
);

router.post(
  "/:id/reply",
  protect,
  replyToStory
);

router.get(
  "/:id/replies",
  protect,
  getStoryReplies
);

router.get(
  "/:id/viewers",
  protect,
  getStoryViewers
);

module.exports = router;
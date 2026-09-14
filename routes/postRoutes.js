const express = require("express");

const {
  createPost,
  getFeed,
  getMyPosts,
  getMyReels,
  getSavedPosts,
  getTaggedPosts,
  getMyReposts,
  repostPost,
  unrepostPost,
  getPost,
  deletePost,
  savePost,
  unsavePost,
  toggleSave,
  createComment,
  getComments,
} = require("../controllers/postController");

const {
  likePost,
  unlikePost,
  togglePostLike,
} = require("../controllers/likeController");

const protect = require("../middleware/auth");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

router.get(
  "/feed",
  protect,
  getFeed
);

router.get(
  "/mine",
  protect,
  getMyPosts
);

router.get(
  "/reels",
  protect,
  getMyReels
);

router.get(
  "/saved",
  protect,
  getSavedPosts
);

router.get(
  "/tagged",
  protect,
  getTaggedPosts
);

router.get(
  "/reposts",
  protect,
  getMyReposts
);

router.post(
  "/",
  protect,
  upload.array("media", 10),
  createPost
);

router.post(
  "/:id/repost",
  protect,
  repostPost
);

router.delete(
  "/:id/repost",
  protect,
  unrepostPost
);

router.post(
  "/:id/like",
  protect,
  likePost
);

router.delete(
  "/:id/like",
  protect,
  unlikePost
);

router.post(
  "/:id/toggle-like",
  protect,
  togglePostLike
);

router.post(
  "/:id/save",
  protect,
  savePost
);

router.delete(
  "/:id/save",
  protect,
  unsavePost
);

router.post(
  "/:id/toggle-save",
  protect,
  toggleSave
);

router.post(
  "/:id/comments",
  protect,
  createComment
);

router.get(
  "/:id/comments",
  protect,
  getComments
);

router.delete(
  "/:id",
  protect,
  deletePost
);

router.get(
  "/:id",
  protect,
  getPost
);

module.exports = router;
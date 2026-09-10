const express = require("express");

const {
  createPost,
  getFeed,
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

router.post(
  "/",
  protect,
  upload.array("media", 10),
  createPost
);

router.get(
  "/:id",
  protect,
  getPost
);

router.delete(
  "/:id",
  protect,
  deletePost
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

module.exports = router;
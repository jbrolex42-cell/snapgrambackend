const express = require("express");

const router = express.Router();

const {
  likePost,
  unlikePost,
  togglePostLike,
} = require("../controllers/likeController");

const auth = require("../middleware/auth");

// Like
router.post(
  "/posts/:id/like",
  auth,
  likePost
);

// Unlike
router.delete(
  "/posts/:id/like",
  auth,
  unlikePost
);

// Optional toggle endpoint
router.post(
  "/posts/:id/toggle-like",
  auth,
  togglePostLike
);

module.exports = router;
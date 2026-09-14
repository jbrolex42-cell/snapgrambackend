const express = require("express");

const router = express.Router();

const {
  likePost,
  unlikePost,
  togglePostLike,
} = require("../controllers/likeController");

const auth = require("../middleware/auth");

router.post(
  "/posts/:id/like",
  auth,
  likePost
);

router.delete(
  "/posts/:id/like",
  auth,
  unlikePost
);

router.post(
  "/posts/:id/toggle-like",
  auth,
  togglePostLike
);

module.exports = router;
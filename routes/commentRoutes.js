const express = require("express");

const protect = require("../middleware/auth");

const {
  createComment,
  getComments,
  deleteComment,
  likeComment,
  unlikeComment,
} = require("../controllers/commentController");

const router = express.Router();

router.get(
  "/post/:postId",
  protect,
  getComments
);

router.post(
  "/post/:postId",
  protect,
  createComment
);

router.delete(
  "/:id",
  protect,
  deleteComment
);

router.post(
  "/:id/like",
  protect,
  likeComment
);

router.delete(
  "/:id/like",
  protect,
  unlikeComment
);

module.exports = router;
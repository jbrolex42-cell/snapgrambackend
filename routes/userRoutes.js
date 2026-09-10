const express = require("express");

const protect = require("../middleware/auth");
const upload = require("../middleware/uploadMiddleware");

const {
  getUserProfile,
  updateProfile,
  searchUsers,
  getSavedPosts,
  getUserPosts,
} = require("../controllers/userController");

const router = express.Router();

router.get(
  "/search",
  protect,
  searchUsers
);

router.get(
  "/profile/:username",
  protect,
  getUserProfile
);

router.patch(
  "/profile",
  protect,
  upload.single("avatar"),
  updateProfile
);

router.get(
  "/saved",
  protect,
  getSavedPosts
);

router.get(
  "/:username/posts",
  protect,
  getUserPosts
);

module.exports = router;
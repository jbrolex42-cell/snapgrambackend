const express = require("express");

const router = express.Router();

const protect =
  require("../middleware/auth");

const {
  searchUsers,
  searchPosts,
  search,
} = require(
  "../controllers/searchController"
);

router.get(
  "/",
  protect,
  search
);

router.get(
  "/users",
  protect,
  searchUsers
);

router.get(
  "/posts",
  protect,
  searchPosts
);

module.exports = router;
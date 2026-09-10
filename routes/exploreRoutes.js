const express = require("express");

const router = express.Router();

const protect = require("../middleware/auth");

const {
  search,
  getExplorePosts,
} = require("../controllers/exploreController");

router.get(
  "/",
  protect,
  getExplorePosts
);

router.get(
  "/search",
  protect,
  search
);

module.exports = router;
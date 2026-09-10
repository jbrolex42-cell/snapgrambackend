const express = require("express");

const router = express.Router();

const protect = require("../middleware/auth");

const {
  getHomeFeed,
} = require("../controllers/feedController");

router.get(
  "/",
  protect,
  getHomeFeed
);

module.exports = router;
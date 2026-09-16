const express = require("express");

const protect = require("../middleware/auth");

const {
  getGiftSettings,
  updateGiftSettings,
  getGiftSummary,
  getGiftActivity,
  sendGift,
} = require("../controllers/giftsController");

const router = express.Router();

router.get(
  "/summary",
  protect,
  getGiftSummary
);

router.get(
  "/activity",
  protect,
  getGiftActivity
);

router.get(
  "/settings",
  protect,
  getGiftSettings
);

router.patch(
  "/settings",
  protect,
  updateGiftSettings
);

router.post(
  "/send",
  protect,
  sendGift
);

module.exports = router;
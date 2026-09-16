const express = require("express");

const protect = require("../middleware/auth");

const {
  getEarningsSummary,
  getEarningsHistory,
  getEarningsActivity,
} = require(
  "../controllers/earningsController"
);

const router = express.Router();

router.get(
  "/summary",
  protect,
  getEarningsSummary
);

router.get(
  "/history",
  protect,
  getEarningsHistory
);

router.get(
  "/activity",
  protect,
  getEarningsActivity
);

module.exports = router;
const express = require("express");

const protect = require("../middleware/auth");

const {
  getMonetizationEligibility,
  getMonetizationProfile,
  updateMonetizationProfile,
  getMonetizationDashboard,
  updateMonetizationDashboard,
} = require("../controllers/monetizationController");


const router = express.Router();

router.get(
  "/",
  protect,
  getMonetizationDashboard
);

router.patch(
  "/",
  protect,
  updateMonetizationDashboard
);

router.get(
  "/eligibility",
  protect,
  getMonetizationEligibility
);

router.get(
  "/profile",
  protect,
  getMonetizationProfile
);

router.patch(
  "/profile",
  protect,
  updateMonetizationProfile
);

module.exports = router;
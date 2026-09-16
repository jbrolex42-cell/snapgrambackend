const express = require("express");

const protect = require("../middleware/auth");

const {
  getMonetizationSetup,
  updateMonetizationSetup,
  completeMonetizationSetup,
} = require("../controllers/monetizationSetupController");

const router = express.Router();

router.get(
  "/",
  protect,
  getMonetizationSetup
);

router.patch(
  "/",
  protect,
  updateMonetizationSetup
);

router.post(
  "/complete",
  protect,
  completeMonetizationSetup
);

module.exports = router;
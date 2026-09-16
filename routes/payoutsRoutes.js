const express = require("express");

const protect = require("../middleware/auth");

const {
  getPayoutSummary,
  getPayoutMethod,
  createPayoutMethod,
  updatePayoutMethod,
  deletePayoutMethod,
  getPayoutHistory,
  getPayoutStatus,
  requestPayout,
} = require("../controllers/payoutsController");

const router = express.Router();

router.get(
  "/summary",
  protect,
  getPayoutSummary
);

router.get(
  "/method",
  protect,
  getPayoutMethod
);

router.post(
  "/method",
  protect,
  createPayoutMethod
);

router.patch(
  "/method",
  protect,
  updatePayoutMethod
);

router.delete(
  "/method",
  protect,
  deletePayoutMethod
);

router.get(
  "/history",
  protect,
  getPayoutHistory
);

router.get(
  "/status",
  protect,
  getPayoutStatus
);

router.post(
  "/request",
  protect,
  requestPayout
);

module.exports = router;
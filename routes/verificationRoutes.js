const express =
  require("express");

const protect =
  require("../middleware/auth");

const {
  applyForVerification,
  getVerificationStatus,
  getPendingVerifications,
  approveVerification,
  rejectVerification,
} =
  require("../controllers/verificationController");

const router =
  express.Router();

router.post(
  "/apply",
  protect,
  applyForVerification
);

router.get(
  "/status",
  protect,
  getVerificationStatus
);

router.get(
  "/admin/pending",
  protect,
  getPendingVerifications
);

router.post(
  "/admin/:requestId/approve",
  protect,
  approveVerification
);

router.post(
  "/admin/:requestId/reject",
  protect,
  rejectVerification
);

module.exports =
  router;
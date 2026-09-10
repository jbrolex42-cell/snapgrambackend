const express = require("express");

const {
  getPlans,
  getStatus,
  createCheckout,
  getPaymentStatus,
  getHistory,
  cancelSubscription,
  mpesaCallback,
} = require("../controllers/subscriptionController");

const protect = require("../middleware/auth");

const router =
  express.Router();

router.post(
  "/mpesa/callback",
  mpesaCallback
);

router.get(
  "/plans",
  getPlans
);

router.get(
  "/status",
  protect,
  getStatus
);

router.post(
  "/checkout",
  protect,
  createCheckout
);

router.get(
  "/payments/:paymentId",
  protect,
  getPaymentStatus
);

router.get(
  "/history",
  protect,
  getHistory
);

router.post(
  "/cancel",
  protect,
  cancelSubscription
);

module.exports = router;
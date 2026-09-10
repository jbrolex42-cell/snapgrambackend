const express = require("express");

const router =
  express.Router();

const auth =
  require("../middleware/auth");

const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} =
  require(
    "../controllers/notificationController"
  );

router.get(
  "/",
  auth,
  getNotifications
);

router.get(
  "/unread-count",
  auth,
  getUnreadCount
);

router.patch(
  "/read-all",
  auth,
  markAllAsRead
);

router.patch(
  "/:id/read",
  auth,
  markAsRead
);

module.exports = router;
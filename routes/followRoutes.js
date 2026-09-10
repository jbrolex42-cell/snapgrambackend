const express = require("express");

const router = express.Router();

const protect = require("../middleware/auth");

const {
  followUser,
  unfollowUser,
  toggleFollow,
  getFollowers,
  getFollowing,
  getFollowStatus,
  getPendingRequests,
  acceptRequest,
  rejectRequest,
} = require("../controllers/followController");

router.post(
  "/:userId",
  protect,
  followUser
);

router.delete(
  "/:userId",
  protect,
  unfollowUser
);

router.post(
  "/:userId/toggle",
  protect,
  toggleFollow
);

router.get(
  "/:userId/followers",
  protect,
  getFollowers
);

router.get(
  "/:userId/following",
  protect,
  getFollowing
);

router.get(
  "/:userId/status",
  protect,
  getFollowStatus
);

router.get(
  "/requests",
  protect,
  getPendingRequests
);

router.post(
  "/requests/:requestId/accept",
  protect,
  acceptRequest
);

router.delete(
  "/requests/:requestId",
  protect,
  rejectRequest
);

module.exports = router;
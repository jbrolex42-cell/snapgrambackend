const express = require("express");

const auth = require("../middleware/auth");

const {
  startLive,
  getLive,

  getActiveLives,
  getFollowingLives,

  joinLive,
  leaveLive,

  endLive,

  likeLive,
  commentLive,
} = require("../controllers/liveController");

const router = express.Router();

router.get("/", auth, getActiveLives);

router.get(
  "/following",
  auth,
  getFollowingLives
);

router.post(
  "/start",
  auth,
  startLive
);

router.get(
  "/:id",
  auth,
  getLive
);

router.post(
  "/:id/join",
  auth,
  joinLive
);

router.post(
  "/:id/leave",
  auth,
  leaveLive
);

router.post(
  "/:id/end",
  auth,
  endLive
);

router.post(
  "/:id/like",
  auth,
  likeLive
);

router.post(
  "/:id/comment",
  auth,
  commentLive
);

module.exports = router;
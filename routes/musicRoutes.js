const express = require("express");

const protect = require("../middleware/auth");

const {
  searchMusic,
  getFeaturedMusic,
  getPopularMusic,
  getMusicTrack,
  previewMusic,
  downloadMusic,
  createMusicVersion,
  getMusicVersion,
  playMusic,
  useMusic,
} = require("../controllers/musicController");

const router = express.Router();

router.get(
  "/search",
  protect,
  searchMusic
);

router.get(
  "/featured",
  protect,
  getFeaturedMusic
);

router.get(
  "/popular",
  protect,
  getPopularMusic
);

router.post(
  "/version",
  protect,
  createMusicVersion
);

router.get(
  "/version/:jobId",
  protect,
  getMusicVersion
);

router.get(
  "/:id/preview",
  protect,
  previewMusic
);

router.get(
  "/:id/download",
  protect,
  downloadMusic
);

router.get(
  "/:id",
  protect,
  getMusicTrack
);

router.post(
  "/:id/play",
  protect,
  playMusic
);

router.post(
  "/:id/use",
  protect,
  useMusic
);

module.exports = router;
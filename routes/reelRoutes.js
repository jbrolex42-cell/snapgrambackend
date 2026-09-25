const express = require("express");

const router = express.Router();

const protect = require("../middleware/auth");

const {
  getReels,
  getReel,
  likeReel,
  unlikeReel,
  toggleReelLike,
  saveReel,
  incrementViews,
} = require("../controllers/reelController");

router.get(
  "/",
  protect,
  getReels
);

router.get(
  "/:id",
  protect,
  getReel
);

router.post(
  "/:id/like",
  protect,
  likeReel
);

router.delete(
  "/:id/like",
  protect,
  unlikeReel
);

router.post(
  "/:id/toggle-like",
  protect,
  toggleReelLike
);

router.post(
  "/:id/save",
  protect,
  saveReel
);

router.post(
  "/:id/view",
  protect,
  incrementViews
);

module.exports = router;
const express = require("express");

const protect =
  require("../middleware/auth");

const {
  getSettings,
  updateSettings,
  addRelationship,
  removeRelationship,
} =
  require("../controllers/settingsController");

const router =
  express.Router();

router.get(
  "/",
  protect,
  getSettings
);

router.patch(
  "/",
  protect,
  updateSettings
);

router.post(
  "/relationships/:userId",
  protect,
  addRelationship
);

router.delete(
  "/relationships/:userId",
  protect,
  removeRelationship
);

module.exports = router;
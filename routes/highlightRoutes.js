const express = require("express");

const router = express.Router();

const protect = require("../middleware/auth");

const {
  getUserHighlights,
  getHighlightById,
  getMyHighlights,
  createHighlight,
  updateHighlight,
  deleteHighlight,
  addStoriesToHighlight,
  removeStoryFromHighlight,
} = require("../controllers/highlightController");

router.get("/", protect, getMyHighlights);

router.get("/user/:userId", protect, getUserHighlights);

router.get("/:id", protect, getHighlightById);

router.post("/", protect, createHighlight);

router.put("/:id", protect, updateHighlight);

router.delete("/:id", protect, deleteHighlight);

router.post("/:id/stories", protect, addStoriesToHighlight);

router.delete(
  "/:id/stories/:storyId",
  protect,
  removeStoryFromHighlight
);

module.exports = router;
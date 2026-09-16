const express = require("express");

const protect = require("../middleware/auth");

const {
  translateContent,
} = require("../controllers/translationController");

const router = express.Router();

router.post(
  "/",
  protect,
  translateContent
);

module.exports = router;
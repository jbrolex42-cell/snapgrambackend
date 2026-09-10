const express = require("express");

const router = express.Router();

const protect =
  require("../middleware/auth");

const upload =
  require("../middleware/uploadMiddleware");

const {
  uploadFile,
} = require(
  "../controllers/uploadController"
);

router.post(
  "/",
  protect,
  upload.single("file"),
  uploadFile
);

module.exports = router;
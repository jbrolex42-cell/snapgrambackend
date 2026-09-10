const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (
    file.fieldname === "video" &&
    file.mimetype.startsWith("video/")
  ) {
    return cb(null, true);
  }

  if (
    file.fieldname === "cover" &&
    file.mimetype.startsWith("image/")
  ) {
    return cb(null, true);
  }

  cb(
    new Error(
      "Only video files and image covers are allowed."
    )
  );
};

const uploadReel = multer({
  storage,

  limits: {
    fileSize: 200 * 1024 * 1024,
  },

  fileFilter,
});

module.exports = uploadReel;
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(
  process.cwd(),
  "uploads",
  "voice"
);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const extension =
      path.extname(file.originalname) || ".m4a";

    const filename =
      `${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}${extension}`;

    cb(null, filename);
  },
});

const allowedMimeTypes = new Set([
  "audio/m4a",
  "audio/mp4",
  "audio/aac",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/x-m4a",
  "audio/webm",
  "audio/ogg",
  "application/octet-stream",
]);

const fileFilter = (req, file, cb) => {
  console.log(
    "VOICE UPLOAD MIME:",
    file.mimetype
  );

  console.log(
    "VOICE UPLOAD NAME:",
    file.originalname
  );

  if (
    allowedMimeTypes.has(
      file.mimetype
    )
  ) {
    return cb(null, true);
  }

  const extension =
    path
      .extname(file.originalname)
      .toLowerCase();

  const allowedExtensions = [
    ".m4a",
    ".mp4",
    ".aac",
    ".mp3",
    ".wav",
    ".webm",
    ".ogg",
  ];

  if (
    allowedExtensions.includes(
      extension
    )
  ) {
    return cb(null, true);
  }

  return cb(
    new Error(
      `Unsupported audio type: ${file.mimetype}`
    ),
    false
  );
};

module.exports = multer({
  storage,

  fileFilter,

  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});
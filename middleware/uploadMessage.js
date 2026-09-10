const multer =
  require("multer");

const path =
  require("path");

const fs =
  require("fs");

const uploadDir =
  path.join(
    process.cwd(),
    "uploads",
    "messages"
  );

if (
  !fs.existsSync(uploadDir)
) {
  fs.mkdirSync(
    uploadDir,
    {
      recursive: true,
    }
  );
}

const storage =
  multer.diskStorage({
    destination: (
      req,
      file,
      cb
    ) => {
      cb(
        null,
        uploadDir
      );
    },

    filename: (
      req,
      file,
      cb
    ) => {
      const extension =
        path.extname(
          file.originalname
        );

      const filename =
        `${Date.now()}-${Math.round(
          Math.random() * 1e9
        )}${extension}`;

      cb(
        null,
        filename
      );
    },
  });

const fileFilter =
  (
    req,
    file,
    cb
  ) => {
    const allowed =
      [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "video/mp4",
        "video/quicktime",
        "video/webm",
      ];

    if (
      allowed.includes(
        file.mimetype
      )
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Unsupported media type"
        ),
        false
      );
    }
  };

module.exports =
  multer({
    storage,
    fileFilter,

    limits: {
      fileSize:
        100 * 1024 * 1024,
    },
  });
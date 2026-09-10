const cloudinary =
  require("cloudinary").v2;

async function uploadFile(
  req,
  res
) {
  try {
    if (!req.file) {
      return res.status(400).json({
        message:
          "No file provided",
      });
    }

    const isVideo =
      req.file.mimetype.startsWith(
        "video/"
      );

    const resourceType =
      isVideo
        ? "video"
        : "image";

    const result =
      await new Promise(
        (resolve, reject) => {
          const stream =
            cloudinary.uploader.upload_stream(
              {
                resource_type:
                  resourceType,

                folder:
                  "snapgram",
              },

              (error, result) => {
                if (error) {
                  reject(error);
                } else {
                  resolve(result);
                }
              }
            );

          stream.end(
            req.file.buffer
          );
        }
      );

    res.status(201).json({
      url: result.secure_url,
      secure_url:
        result.secure_url,
      publicId:
        result.public_id,
      public_id:
        result.public_id,
      resourceType:
        result.resource_type,
    });
  } catch (error) {
    console.error(
      "Cloudinary upload error:",
      error
    );

    res.status(500).json({
      message:
        "Upload failed",
    });
  }
}

module.exports = {
  uploadFile,
};
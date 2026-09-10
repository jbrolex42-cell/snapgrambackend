const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function uploadVideo(buffer, trimStart = 0, trimEnd = 0) {
  return new Promise((resolve, reject) => {
    const options = {
      resource_type: "video",

      folder: "snapgram/reels",

      transformation: [
        {
          width: 1080,
          height: 1920,
          crop: "fill",
          gravity: "auto",
          quality: "auto",
        },
      ],

      eager: [
        {
          width: 720,
          height: 1280,
          crop: "fill",
          gravity: "auto",
          quality: "auto",
          format: "mp4",
        },
      ],

      eager_async: true,
    };

    if (
      trimStart > 0 ||
      trimEnd > 0
    ) {
      options.transformation.unshift({
        start_offset: trimStart,
        end_offset:
          trimEnd > trimStart
            ? trimEnd
            : undefined,
      });
    }

    const stream =
      cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(result);
        }
      );

    stream.end(buffer);
  });
}

function uploadImage(buffer) {
  return new Promise((resolve, reject) => {
    const stream =
      cloudinary.uploader.upload_stream(
        {
          resource_type: "image",

          folder:
            "snapgram/reel-covers",

          transformation: [
            {
              width: 1080,
              height: 1920,
              crop: "fill",
              gravity: "auto",
              quality: "auto",
            },
          ],
        },

        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(result);
        }
      );

    stream.end(buffer);
  });
}

module.exports = {
  uploadVideo,
  uploadImage,
};
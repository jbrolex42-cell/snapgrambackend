const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
  timeout: 120000,
});

const uploadAudioToCloudinary = async (
  filePath,
  folder = "snapgram/messages/voice"
) => {
  if (!filePath) {
    throw new Error(
      "Cloudinary upload requires a file path"
    );
  }

  try {
    console.log(
      "CLOUDINARY AUDIO UPLOAD START:",
      filePath
    );

    const result =
      await cloudinary.uploader.upload(
        filePath,
        {
          resource_type: "video",
          type: "upload",
          folder,

          use_filename: true,
          unique_filename: true,
          overwrite: false,
        }
      );

    console.log(
      "CLOUDINARY AUDIO UPLOAD COMPLETE:",
      {
        public_id: result.public_id,
        secure_url: result.secure_url,
        resource_type: result.resource_type,
        format: result.format,
        duration: result.duration,
        bytes: result.bytes,
      }
    );

    if (!result.secure_url) {
      throw new Error(
        "Cloudinary upload succeeded but returned no secure URL"
      );
    }

    return result;
  } catch (error) {
    console.error(
      "CLOUDINARY AUDIO UPLOAD ERROR:",
      {
        message: error?.message,
        name: error?.name,
        http_code: error?.http_code,
        stack: error?.stack,
      }
    );

    throw error;
  }
};

module.exports = cloudinary;

module.exports.uploadAudioToCloudinary =
  uploadAudioToCloudinary;
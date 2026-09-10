const cloudinary =
  require("../config/cloudinary");

function uploadToCloudinary(
  buffer,
  folder,
  resourceType = "image"
) {
  return new Promise(
    (resolve, reject) => {
      if (!buffer) {
        reject(
          new Error(
            "No file buffer provided"
          )
        );

        return;
      }

      const uploadStream =
        cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type:
              resourceType,
          },

          (error, result) => {
            if (error) {
              reject(error);
              return;
            }

            resolve(result);
          }
        );

      uploadStream.end(buffer);
    }
  );
}

module.exports =
  uploadToCloudinary;
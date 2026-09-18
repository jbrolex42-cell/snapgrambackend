const fs = require("fs");

const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const cloudinary = require("../config/cloudinary");

const sendVoiceMessage = async (req, res) => {
  let localFilePath = null;

  try {
    const {
      conversationId,
      receiverId,
      duration,
      replyTo,
      mediaEncryptionNonce,
      mediaEncryptionVersion,
    } = req.body;

    console.log(
      "========== VOICE MESSAGE =========="
    );

    console.log("User:", req.user?._id);
    console.log("Conversation:", conversationId);
    console.log("Receiver:", receiverId);
    console.log("Duration:", duration);

    console.log("File:", {
      fieldname: req.file?.fieldname,
      originalname: req.file?.originalname,
      mimetype: req.file?.mimetype,
      size: req.file?.size,
      path: req.file?.path,
    });

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Voice recording is required",
      });
    }

    localFilePath = req.file.path;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "Conversation is required",
      });
    }

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: "Receiver is required",
      });
    }

    const conversation =
      await Conversation.findOne({
        _id: conversationId,
        participants: req.user._id,
      });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    const receiverIsParticipant =
      conversation.participants.some(
        (participant) =>
          String(participant) ===
          String(receiverId)
      );

    if (!receiverIsParticipant) {
      return res.status(400).json({
        success: false,
        message:
          "Receiver is not a participant in this conversation",
      });
    }

    if (!fs.existsSync(localFilePath)) {
      console.error(
        "VOICE FILE DOES NOT EXIST:",
        localFilePath
      );

      return res.status(500).json({
        success: false,
        message:
          "Uploaded voice file could not be found",
      });
    }

    const stats =
      fs.statSync(localFilePath);

    console.log(
      "VOICE FILE:",
      {
        path: localFilePath,
        size: stats.size,
        mimetype: req.file.mimetype,
      }
    );

    if (stats.size <= 0) {
      return res.status(400).json({
        success: false,
        message: "Voice recording is empty",
      });
    }

    console.log(
      "UPLOADING VOICE TO CLOUDINARY..."
    );

    const upload =
      await cloudinary.uploadAudioToCloudinary(
        localFilePath,
        "snapgram/messages/voice"
      );

    if (!upload?.secure_url) {
      throw new Error(
        "Cloudinary did not return an audio URL"
      );
    }

    console.log(
      "CLOUDINARY VOICE SUCCESS:",
      {
        public_id: upload.public_id,
        secure_url: upload.secure_url,
        resource_type: upload.resource_type,
        format: upload.format,
        duration: upload.duration,
        bytes: upload.bytes,
      }
    );

   const message =
  await Message.create({
    conversation: conversationId,

    sender: req.user._id,

    receiver: receiverId,

    type: "voice",

    text: "",

    mediaUrl:
      uploadResult.secure_url,

    mediaPublicId:
      uploadResult.public_id,

    mediaDuration:
      Number(duration) || 0,

    mediaEncryptionNonce:
      mediaEncryptionNonce || null,

    mediaEncryptionVersion:
      mediaEncryptionVersion || null,

    replyTo:
      replyTo || null,

    readBy: [
      req.user._id,
    ],
  });
    conversation.lastMessage =
      message._id;

    conversation.lastMessageAt =
      message.createdAt;

    await conversation.save();

   

    await message.populate(
      "sender",
      "username fullName avatar isVerified"
    );

    try {
      if (
        localFilePath &&
        fs.existsSync(localFilePath)
      ) {
        fs.unlinkSync(localFilePath);

        console.log(
          "LOCAL VOICE FILE DELETED"
        );
      }
    } catch (cleanupError) {
      console.warn(
        "VOICE FILE CLEANUP WARNING:",
        cleanupError
      );
    }

    console.log(
      "VOICE MESSAGE CREATED:",
      message._id
    );

    console.log(
      "VOICE URL:",
      message.mediaUrl
    );

    console.log(
      "========== VOICE MESSAGE COMPLETE =========="
    );

    return res.status(201).json({
      success: true,
      message,
    });
  } catch (error) {
    console.error(
      "========== VOICE MESSAGE ERROR =========="
    );

    console.error("NAME:", error?.name);
    console.error(
      "MESSAGE:",
      error?.message
    );
    console.error(
      "STACK:",
      error?.stack
    );

    try {
      if (
        localFilePath &&
        fs.existsSync(localFilePath)
      ) {
        fs.unlinkSync(localFilePath);

        console.log(
          "FAILED VOICE FILE CLEANED UP"
        );
      }
    } catch (cleanupError) {
      console.warn(
        "FAILED VOICE CLEANUP ERROR:",
        cleanupError
      );
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to send voice message",

      error:
        process.env.NODE_ENV ===
        "production"
          ? undefined
          : error?.message,
    });
  }
};

module.exports = {
  sendVoiceMessage,
};
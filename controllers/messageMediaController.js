const fs = require("fs");

const mongoose = require("mongoose");

const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

const createNotification = require("../utils/createNotification");
const uploadToCloudinary = require("../config/cloudinary");

const USER_FIELDS =
  "username fullName avatar isVerified";

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(
    String(value || "")
  );
}

async function sendMediaMessage(req, res) {
  let localFilePath = null;

  try {
    const {
      conversationId,
      receiverId,
      type,
      replyTo,
      mediaEncryptionNonce,
      mediaEncryptionVersion,
    } = req.body;

    localFilePath = req.file?.path || null;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Media file is required",
      });
    }

    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID",
      });
    }

    if (!isValidObjectId(receiverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid receiver ID",
      });
    }

    if (!["image", "video"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid media type",
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

    let replyMessage = null;

    if (replyTo) {
      if (!isValidObjectId(replyTo)) {
        return res.status(400).json({
          success: false,
          message: "Invalid reply message ID",
        });
      }

      replyMessage =
        await Message.findOne({
          _id: replyTo,
          conversation: conversationId,
        }).select("_id");

      if (!replyMessage) {
        return res.status(400).json({
          success: false,
          message:
            "Reply message not found",
        });
      }
    }

    if (!localFilePath || !fs.existsSync(localFilePath)) {
      return res.status(400).json({
        success: false,
        message: "Uploaded media file could not be found",
      });
    }

    const uploadResult =
      await uploadToCloudinary(
        localFilePath,
        "snapgram/messages"
      );

    if (!uploadResult?.secure_url) {
      throw new Error(
        "Cloudinary did not return a media URL"
      );
    }

    mediaEncryptionNonce,
  mediaEncryptionVersion,

    conversation.lastMessage =
      message._id;

    conversation.lastMessageAt =
      message.createdAt;

    await conversation.save();

    await message.populate(
      "sender",
      USER_FIELDS
    );

    await message.populate(
      "receiver",
      USER_FIELDS
    );

    if (replyMessage) {
      await message.populate(
        "replyTo",
        "text type sender receiver createdAt deleted"
      );
    }

    try {
      await createNotification({
        recipient: receiverId,
        sender: req.user._id,
        type: "message",
        message: message._id,
      });
    } catch (notificationError) {
      console.error(
        "MEDIA MESSAGE NOTIFICATION ERROR:",
        notificationError
      );
    }

    return res.status(201).json({
      success: true,
      message,
    });
  } catch (error) {
    console.error(
      "SEND MEDIA MESSAGE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to send media message",
    });
  } finally {
    if (
      localFilePath &&
      fs.existsSync(localFilePath)
    ) {
      try {
        fs.unlinkSync(localFilePath);
      } catch (cleanupError) {
        console.warn(
          "MEDIA FILE CLEANUP WARNING:",
          cleanupError
        );
      }
    }
  }
}

module.exports = {
  sendMediaMessage,
};
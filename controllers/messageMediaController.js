const Conversation =
  require("../models/Conversation");

const Message =
  require("../models/Message");

const createNotification =
  require("../utils/createNotification");

const uploadToCloudinary =
  require("../config/cloudinary");

const sendMediaMessage =
  async (req, res) => {
    try {
      const {
        conversationId,
        receiverId,
        type,
        text,
        replyTo,
      } = req.body;

      if (!req.file) {
        return res.status(400).json({
          message:
            "Media file is required",
        });
      }

      if (
        !["image", "video"].includes(
          type
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid media type",
        });
      }

      const conversation =
        await Conversation.findOne({
          _id: conversationId,
          participants:
            req.user._id,
        });

      if (!conversation) {
        return res.status(404).json({
          message:
            "Conversation not found",
        });
      }

      const uploadResult =
        await uploadToCloudinary(
          req.file.path,
          "snapgram/messages"
        );

      const message =
        await Message.create({
          conversation:
            conversationId,

          sender:
            req.user._id,

          receiver:
            receiverId,

          type,

          text:
            text?.trim() || "",

          mediaUrl:
            uploadResult.secure_url,

          mediaPublicId:
            uploadResult.public_id,

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

      await createNotification({
        recipient: receiverId,
        sender: req.user._id,
        type: "message",
        message: message._id,
      });

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
        message:
          "Failed to send media message",
      });
    }
  };

module.exports = {
  sendMediaMessage,
};
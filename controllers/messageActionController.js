const Message = require("../models/Message");
const Conversation = require("../models/Conversation");

const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({
        message: "Emoji is required",
      });
    }

    const message = await Message.findById(
      messageId
    );

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    const conversation =
      await Conversation.findOne({
        _id: message.conversation,
        participants: req.user._id,
      });

    if (!conversation) {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    const existingReaction =
      message.reactions.find(
        (reaction) =>
          String(reaction.user) ===
          String(req.user._id)
      );

    if (existingReaction) {
      if (
        existingReaction.emoji === emoji
      ) {
        message.reactions =
          message.reactions.filter(
            (reaction) =>
              String(reaction.user) !==
              String(req.user._id)
          );
      } else {
        existingReaction.emoji = emoji;
      }
    } else {
      message.reactions.push({
        user: req.user._id,
        emoji,
      });
    }

    await message.save();

    await message.populate(
      "reactions.user",
      "username avatar isVerified"
    );

    return res.json({
      success: true,
      reactions: message.reactions,
    });
  } catch (error) {
    console.error(
      "REACTION ERROR:",
      error
    );

    return res.status(500).json({
      message: "Failed to react",
    });
  }
};

const unsendMessage = async (
  req,
  res
) => {
  try {
    const { messageId } = req.params;

    const message =
      await Message.findById(
        messageId
      );

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    if (
      String(message.sender) !==
      String(req.user._id)
    ) {
      return res.status(403).json({
        message:
          "You can only unsend your own messages",
      });
    }

    message.deleted = true;

    message.deletedAt =
      new Date();

    message.text = "";

    message.mediaUrl = null;

    message.mediaPublicId = null;

    await message.save();

    return res.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error(
      "UNSEND ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to unsend message",
    });
  }
};

const deleteMessage = async (
  req,
  res
) => {
  try {
    const { messageId } = req.params;

    const message =
      await Message.findById(
        messageId
      );

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    const conversation =
      await Conversation.findOne({
        _id: message.conversation,
        participants: req.user._id,
      });

    if (!conversation) {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    await Message.findByIdAndDelete(
      messageId
    );

    return res.json({
      success: true,
      messageId,
    });
  } catch (error) {
    console.error(
      "DELETE MESSAGE ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to delete message",
    });
  }
};

module.exports = {
  reactToMessage,
  unsendMessage,
  deleteMessage,
};
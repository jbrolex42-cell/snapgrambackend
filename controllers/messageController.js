const mongoose = require("mongoose");

const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const Notification = require("../models/Notification");

const USER_FIELDS =
  "username fullName avatar isVerified";

const MESSAGE_SENDER_FIELDS =
  "username fullName avatar isVerified";



function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(
    String(value || "")
  );
}

function normalizeText(value) {
  return String(value || "").trim();
}

async function getConversationForUser(
  conversationId,
  userId
) {
  if (!isValidObjectId(conversationId)) {
    return null;
  }

  return Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });
}

async function getConversations(req, res) {
  try {
    const conversations =
      await Conversation.find({
        participants: req.user._id,
      })
        .populate(
          "participants",
          USER_FIELDS
        )
        .populate(
          "lastMessage",
          "text sender receiver createdAt type deleted"
        )
        .sort({
          lastMessageAt: -1,
          updatedAt: -1,
        });

    return res.json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error(
      "GET CONVERSATIONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load conversations",
    });
  }
}

async function getOrCreateConversation(
  req,
  res
) {
  try {
    const { userId } = req.params;
    const currentUserId =
      req.user._id;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (
      String(userId) ===
      String(currentUserId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot message yourself",
      });
    }

    const targetUser =
      await User.findById(userId).select(
        USER_FIELDS
      );

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let conversation =
      await Conversation.findOne({
        participants: {
          $all: [
            currentUserId,
            userId,
          ],
        },
        $expr: {
          $eq: [
            {
              $size:
                "$participants",
            },
            2,
          ],
        },
      });

    if (!conversation) {
      try {
        conversation =
          await Conversation.create({
            participants: [
              currentUserId,
              userId,
            ],
          });
      } catch (createError) {
        conversation =
          await Conversation.findOne({
            participants: {
              $all: [
                currentUserId,
                userId,
              ],
            },
            $expr: {
              $eq: [
                {
                  $size:
                    "$participants",
                },
                2,
              ],
            },
          });

        if (!conversation) {
          throw createError;
        }
      }
    }

    await conversation.populate(
      "participants",
      USER_FIELDS
    );

    return res.json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error(
      "GET/CREATE CONVERSATION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create conversation",
    });
  }
}

async function getMessages(req, res) {
  try {
    const {
      conversationId,
    } = req.params;

    if (
      !isValidObjectId(
        conversationId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid conversation ID",
      });
    }

    const conversation =
      await getConversationForUser(
        conversationId,
        req.user._id
      );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message:
          "Conversation not found",
      });
    }

    const messages =
      await Message.find({
        conversation:
          conversationId,
      })
        .populate(
          "sender",
          MESSAGE_SENDER_FIELDS
        )
        .populate(
          "receiver",
          MESSAGE_SENDER_FIELDS
        )
        .populate(
          "replyTo",
          "text type sender receiver createdAt deleted"
        )
        .sort({
          createdAt: 1,
        })
        .limit(200);

    await conversation.populate(
      "participants",
      USER_FIELDS
    );

    return res.json({
      success: true,
      conversation,
      messages,
    });
  } catch (error) {
    console.error(
      "GET MESSAGES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load messages",
    });
  }
}

async function sendMessage(req, res) {
  try {
    const {
      conversationId,
      receiverId,
      replyTo,
    } = req.body;

    const text =
      normalizeText(req.body.text);

    if (!text) {
      return res.status(400).json({
        success: false,
        message:
          "Message cannot be empty",
      });
    }

    if (
      !isValidObjectId(
        conversationId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid conversation ID",
      });
    }

    if (
      !isValidObjectId(receiverId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid receiver ID",
      });
    }

    const conversation =
      await getConversationForUser(
        conversationId,
        req.user._id
      );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message:
          "Conversation not found",
      });
    }

    const receiver =
      await User.findById(
        receiverId
      ).select("_id");

    if (!receiver) {
      return res.status(404).json({
        success: false,
        message:
          "Receiver not found",
      });
    }

    const receiverInConversation =
      conversation.participants.some(
        (participantId) =>
          String(participantId) ===
          String(receiverId)
      );

    if (!receiverInConversation) {
      return res.status(400).json({
        success: false,
        message:
          "Receiver is not part of this conversation",
      });
    }

    let replyMessage = null;

    if (replyTo) {
      if (!isValidObjectId(replyTo)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid reply message ID",
        });
      }

      replyMessage =
        await Message.findOne({
          _id: replyTo,
          conversation:
            conversationId,
        }).select("_id");

      if (!replyMessage) {
        return res.status(400).json({
          success: false,
          message:
            "Reply message not found",
        });
      }
    }

    const message =
      await Message.create({
        conversation:
          conversationId,

        sender:
          req.user._id,

        receiver:
          receiverId,

        type: "text",

        text,

        replyTo:
          replyMessage?._id || null,

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
      MESSAGE_SENDER_FIELDS
    );

    await message.populate(
      "receiver",
      MESSAGE_SENDER_FIELDS
    );

    if (replyMessage) {
      await message.populate(
        "replyTo",
        "text type sender receiver createdAt deleted"
      );
    }

    try {
      if (
        String(receiverId) !==
        String(req.user._id)
      ) {
        await Notification.create({
          recipient:
            receiverId,

          sender:
            req.user._id,

          type:
            "message",

          message:
            message._id,
        });
      }
    } catch (notificationError) {
      console.error(
        "MESSAGE NOTIFICATION ERROR:",
        notificationError
      );
    }

    return res.status(201).json({
      success: true,
      message,
    });
  } catch (error) {
    console.error(
      "SEND MESSAGE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to send message",
    });
  }
}

async function markMessagesRead(
  req,
  res
) {
  try {
    const {
      conversationId,
    } = req.params;

    if (
      !isValidObjectId(
        conversationId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid conversation ID",
      });
    }

    const conversation =
      await getConversationForUser(
        conversationId,
        req.user._id
      );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message:
          "Conversation not found",
      });
    }

    const result =
      await Message.updateMany(
        {
          conversation:
            conversationId,

          sender: {
            $ne: req.user._id,
          },

          readBy: {
            $ne: req.user._id,
          },
        },
        {
          $addToSet: {
            readBy:
              req.user._id,
          },
        }
      );

    return res.json({
      success: true,
      modifiedCount:
        result.modifiedCount || 0,
    });
  } catch (error) {
    console.error(
      "MARK MESSAGES READ ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to mark messages read",
    });
  }
}

async function searchMessages(
  req,
  res
) {
  try {
    const {
      conversationId,
    } = req.params;

    const query =
      normalizeText(
        req.query.q
      );

    if (
      !isValidObjectId(
        conversationId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid conversation ID",
      });
    }

    if (!query) {
      return res.json({
        success: true,
        messages: [],
      });
    }

    const conversation =
      await getConversationForUser(
        conversationId,
        req.user._id
      );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message:
          "Conversation not found",
      });
    }

    const messages =
      await Message.find({
        conversation:
          conversationId,

        text: {
          $regex: query,
          $options: "i",
        },

        deleted: {
          $ne: true,
        },
      })
        .populate(
          "sender",
          MESSAGE_SENDER_FIELDS
        )
        .sort({
          createdAt: -1,
        })
        .limit(50);

    return res.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error(
      "MESSAGE SEARCH ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to search messages",
    });
  }
}

module.exports = {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  markMessagesRead,
  searchMessages,
};
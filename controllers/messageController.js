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

const sendMessage = async (
  req,
  res
) => {
  try {
    const senderId =
      req.user?._id ||
      req.user?.id;

    const {
      receiverDeviceId,
      senderDeviceId,
      ciphertext,
      envelopeType,
      encryptionVersion,
      replyTo,
    } = req.body;

    if (!senderId) {
      return res.status(401).json({
        message:
          "Authentication required",
      });
    }

    if (!conversationId) {
      return res.status(400).json({
        message:
          "Conversation ID is required",
      });
    }

    if (!receiverId) {
      return res.status(400).json({
        message:
          "Receiver ID is required",
      });
    }

    const conversation =
      await Conversation.findOne({
        _id: conversationId,
        participants: senderId,
      });

    if (!conversation) {
      return res.status(404).json({
        message:
          "Conversation not found",
      });
    }

    if (!conversationId) {
      return res.status(400).json({
        message: "conversationId is required",
      });
    }

    if (!ciphertext) {
      return res.status(400).json({
        message:
          "Encrypted ciphertext is required",
      });
    }

    if (
      !["preKeySignal", "signal"].includes(
        envelopeType
      )
    ) {
      return res.status(400).json({
        message:
          "Invalid encryption envelope",
      });
    }

    if (!encryptionVersion) {
      return res.status(400).json({
        message:
          "Encryption version is required",
      });
    }

    const conversation =
      await Conversation.findById(
        conversationId
      );

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    const isParticipant =
      conversation.participants.some(
        (participant) =>
          String(participant) ===
          String(userId)
      );

    if (!isParticipant) {
      return res.status(403).json({
        message:
          "You are not a conversation participant",
      });
    }

    const message =
      await Message.create({
        conversation:
          conversationId,

        sender:
          userId,

        senderDeviceId:
          Number(senderDeviceId) || 1,

        type: "text",

        ciphertext,

        envelopeType,

        encryptionVersion,

        replyTo:
          replyTo || null,

        readBy: [userId],
      });

    conversation.lastMessage =
      message._id;

    conversation.lastMessageAt =
      message.createdAt;

    conversation.encryptionEnabled =
      true;

    conversation.encryptionVersion =
      encryptionVersion;

    await conversation.save();

    /*
     * Do not populate plaintext.
     */
    return res.status(201).json({
      success: true,

      message: {
        id: message._id,

        conversation:
          message.conversation,

        sender:
          message.sender,

        senderDeviceId:
          message.senderDeviceId,

        ciphertext:
          message.ciphertext,

        envelopeType:
          message.envelopeType,

        encryptionVersion:
          message.encryptionVersion,

        replyTo:
          message.replyTo,

        createdAt:
          message.createdAt,
      },
    });
  } catch (error) {
    console.error(
      "SEND E2EE MESSAGE ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to send encrypted message",
    });
  }
}
    const receiverIsMember =
      conversation.participants.some(
        (participant) =>
          String(participant) ===
          String(receiverId)
      );

    if (!receiverIsMember) {
      return res.status(403).json({
        message:
          "Receiver is not a conversation participant",
      });
    }

    const isEncrypted =
      Boolean(ciphertext);

    if (
      !isEncrypted &&
      (!text || !text.trim())
    ) {
      return res.status(400).json({
        message:
          "Encrypted message or text is required",
      });
    }

    if (
      isEncrypted &&
      !encryptionVersion
    ) {
      return res.status(400).json({
        message:
          "Encryption version is required",
      });
    }

    if (replyTo) {
      const replyMessage =
        await Message.findOne({
          _id: replyTo,
          conversation: conversationId,
        }).select("_id");

      if (!replyMessage) {
        return res.status(400).json({
          message:
            "Invalid reply message",
        });
      }
    }

    const message =
      await Message.create({
        conversation:
          conversationId,

        sender: senderId,

        receiver: receiverId,

        type: "text",

        /*
         * Existing plaintext compatibility.
         * New E2EE messages should leave this empty.
         */
        text:
          isEncrypted
            ? ""
            : text.trim(),

        ciphertext:
          isEncrypted
            ? ciphertext
            : null,

        encryptionVersion:
          isEncrypted
            ? encryptionVersion
            : null,

        senderDeviceId:
          isEncrypted
            ? senderDeviceId ||
              null
            : null,

        replyTo:
          replyTo || null,

        readBy: [senderId],
      });

    conversation.lastMessage =
      message._id;

    conversation.lastMessageAt =
      message.createdAt;

    if (isEncrypted) {
      conversation.encryptionEnabled =
        true;

      conversation.encryptionVersion =
        encryptionVersion;
    }

    await conversation.save();

    await message.populate(
      "sender",
      "username fullName avatar isVerified"
    );

    await message.populate(
      "receiver",
      "username fullName avatar isVerified"
    );

    /*
     * Do NOT return plaintext for encrypted
     * messages.
     */
    if (isEncrypted) {
      message.text = "";
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
      message:
        "Failed to send message",
    });
  }
};

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
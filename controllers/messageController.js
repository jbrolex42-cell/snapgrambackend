const mongoose = require("mongoose");

const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");

const USER_FIELDS =
"username fullName avatar isVerified";

const MESSAGE_SENDER_FIELDS =
"username fullName avatar isVerified";

const ALLOWED_ENVELOPE_TYPES = [
"preKeySignal",
"signal",
"group",
];

function isValidObjectId(value) {
return mongoose.Types.ObjectId.isValid(
String(value || "")
);
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
"sender senderDeviceId ciphertext envelopeType encryptionVersion type createdAt deleted"
)
.sort({
lastMessageAt: -1,
updatedAt: -1,
})
.lean();

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
  message: "Failed to load conversations",
});


}
}

async function getOrCreateConversation(
req,
res
) {
try {
const { userId } = req.params;
const currentUserId = req.user._id;

console.log("[MESSAGE DEBUG] currentUserId:", String(currentUserId));
console.log("[MESSAGE DEBUG] requested userId:", String(userId));
console.log(
  "[MESSAGE DEBUG] equal:",
  String(userId) === String(currentUserId)
);

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
  await User.findById(userId)
    .select(USER_FIELDS)
    .lean();

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
  conversation =
    await Conversation.create({
      participants: [
        currentUserId,
        userId,
      ],
    });
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
      "replyTo",
      "sender senderDeviceId ciphertext envelopeType encryptionVersion type createdAt deleted"
    )
    .sort({
      createdAt: 1,
    })
    .limit(200)
    .lean();

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
const senderId =
req.user?._id ||
req.user?.id;

const {
  conversationId,
  receiverId,
  senderDeviceId,
  ciphertext,
  envelopeType,
  encryptionVersion,
  replyTo,
} = req.body;

if (!senderId) {
  return res.status(401).json({
    success: false,
    message:
      "Authentication required",
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
  !isValidObjectId(
    receiverId
  )
) {
  return res.status(400).json({
    success: false,
    message:
      "Invalid receiver ID",
  });
}

if (
  !ciphertext ||
  typeof ciphertext !== "string"
) {
  return res.status(400).json({
    success: false,
    message:
      "Encrypted ciphertext is required",
  });
}

if (
  !ALLOWED_ENVELOPE_TYPES.includes(
    envelopeType
  )
) {
  return res.status(400).json({
    success: false,
    message:
      "Invalid encryption envelope",
  });
}

if (
  !encryptionVersion ||
  typeof encryptionVersion !== "string"
) {
  return res.status(400).json({
    success: false,
    message:
      "Encryption version is required",
  });
}

const conversation =
  await Conversation.findOne({
    _id: conversationId,
    participants: senderId,
  });

if (!conversation) {
  return res.status(404).json({
    success: false,
    message:
      "Conversation not found",
  });
}

const receiverIsParticipant =
  conversation.participants.some(
    (participant) =>
      String(participant) ===
      String(receiverId)
  );

if (!receiverIsParticipant) {
  return res.status(403).json({
    success: false,
    message:
      "Receiver is not a conversation participant",
  });
}

if (replyTo) {
  if (!isValidObjectId(replyTo)) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid reply message ID",
    });
  }

  const replyMessage =
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

const message =
  await Message.create({
    conversation:
      conversationId,

    sender:
      senderId,

    senderDeviceId:
      Number(senderDeviceId),

    type: "text",

    ciphertext,

    encryptionVersion,

    envelopeType,

    replyTo:
      replyTo || null,

    readBy: [
      senderId,
    ],
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

return res.status(201).json({
  success: true,

  message: {
    id: message._id,
    _id: message._id,
    conversation:
      message.conversation,
    sender:
      message.sender,
    senderDeviceId:
      message.senderDeviceId,
    type:
      message.type,
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
    deleted:
      message.deleted,
  },
});

} catch (error) {
console.error(
"SEND E2EE MESSAGE ERROR:",
error
);

return res.status(500).json({
  success: false,
  message:
    "Unable to send encrypted message",
});

}
}

async function markMessagesRead(req, res) {
try {
const {
conversationId,
} = req.params;

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


  async function searchMessages(req, res) {
  try {
  const {
  conversationId,
  } = req.params;

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

  return res.json({
  success: true,
  messages: [],
  localOnly: true,
  message:
  "Encrypted messages must be searched locally on the device.",
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
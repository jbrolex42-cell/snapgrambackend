const Message = require("../models/Message");
const Conversation = require("../models/Conversation");

async function getAuthorizedMessage(
messageId,
userId
) {
const message =
await Message.findById(messageId);

if (!message) {
return {
message: null,
conversation: null,
};
}

const conversation =
await Conversation.findOne({
_id: message.conversation,
participants: userId,
});

return {
message,
conversation,
};
}

const reactToMessage = async (
req,
res
) => {
try {
const { messageId } =
req.params;

const emoji =
  typeof req.body?.emoji === "string"
    ? req.body.emoji.trim()
    : "";

if (!emoji) {
  return res.status(400).json({
    success: false,
    message:
      "Emoji is required",
  });
}

if (emoji.length > 32) {
  return res.status(400).json({
    success: false,
    message:
      "Emoji is too long",
  });
}

const {
  message,
  conversation,
} =
  await getAuthorizedMessage(
    messageId,
    req.user._id
  );

if (!message) {
  return res.status(404).json({
    success: false,
    message:
      "Message not found",
  });
}

if (!conversation) {
  return res.status(403).json({
    success: false,
    message:
      "Not authorized",
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
    existingReaction.emoji ===
    emoji
  ) {
    message.reactions =
      message.reactions.filter(
        (reaction) =>
          String(
            reaction.user
          ) !==
          String(req.user._id)
      );
  } else {
    existingReaction.emoji =
      emoji;
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
  "username fullName avatar isVerified"
);

return res.json({
  success: true,
  reactions:
    message.reactions,
});

} catch (error) {
console.error(
"REACTION ERROR:",
error
);

return res.status(500).json({
  success: false,
  message:
    "Failed to react",
});


}
};

const unsendMessage = async (
req,
res
) => {
try {
const { messageId } =
req.params;

const message =
  await Message.findById(
    messageId
  );

if (!message) {
  return res.status(404).json({
    success: false,
    message:
      "Message not found",
  });
}

if (
  String(message.sender) !==
  String(req.user._id)
) {
  return res.status(403).json({
    success: false,
    message:
      "You can only unsend your own messages",
  });
}

message.deleted = true;
message.deletedAt = new Date();

await message.save();

return res.json({
  success: true,
  message: {
    _id: message._id,
    deleted: true,
    deletedAt:
      message.deletedAt,
  },
});


} catch (error) {
console.error(
"UNSEND ERROR:",
error
);

return res.status(500).json({
  success: false,
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
const { messageId } =
req.params;

const {
  message,
  conversation,
} =
  await getAuthorizedMessage(
    messageId,
    req.user._id
  );

if (!message) {
  return res.status(404).json({
    success: false,
    message:
      "Message not found",
  });
}

if (!conversation) {
  return res.status(403).json({
    success: false,
    message:
      "Not authorized",
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
  success: false,
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
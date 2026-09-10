const express = require("express");

const auth = require("../middleware/auth");

const {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  markMessagesRead,
  searchMessages,
} = require("../controllers/messageController");

const {
  reactToMessage,
  unsendMessage,
  deleteMessage,
} = require("../controllers/messageActionController");

const {
  sendMediaMessage,
} = require("../controllers/messageMediaController");

const {
  sendVoiceMessage,
} = require("../controllers/voiceController");

const uploadMessage = require("../middleware/uploadMessage");
const uploadVoice = require("../middleware/uploadVoice");

const router = express.Router();

router.get(
  "/conversations",
  auth,
  getConversations
);

router.post(
  "/conversations/:userId",
  auth,
  getOrCreateConversation
);

router.get(
  "/:conversationId",
  auth,
  getMessages
);

router.post(
  "/",
  auth,
  sendMessage
);

router.patch(
  "/:conversationId/read",
  auth,
  markMessagesRead
);

router.get(
  "/:conversationId/search",
  auth,
  searchMessages
);

router.post(
  "/media",
  auth,
  uploadMessage.single("media"),
  sendMediaMessage
);

router.post(
  "/voice",
  auth,
  uploadVoice.single("voice"),
  sendVoiceMessage
);

router.post(
  "/:messageId/reaction",
  auth,
  reactToMessage
);

router.patch(
  "/:messageId/unsend",
  auth,
  unsendMessage
);

router.delete(
  "/:messageId",
  auth,
  deleteMessage
);

module.exports = router;
const express = require("express");
const auth = require("../middleware/auth");

const {
getConversationPreferences,
updateMute,
updateRestriction,
updateTheme,
updateNickname,
updateDisappearingMessages,
resetConversationPreferences,
} = require("../controllers/conversationPreferenceController");

const router = express.Router();

router.use(auth);

router.get(
"/:conversationId",
getConversationPreferences
);

router.patch(
"/:conversationId/mute",
updateMute
);

router.patch(
"/:conversationId/restrict",
updateRestriction
);

router.patch(
"/:conversationId/theme",
updateTheme
);

router.patch(
"/:conversationId/nickname",
updateNickname
);

router.patch(
"/:conversationId/disappearing",
updateDisappearingMessages
);

router.delete(
"/:conversationId",
resetConversationPreferences
);

module.exports = router;
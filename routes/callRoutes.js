const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const {
  startCall,
  updateCall,
  getCallHistory,
  updateCallStatus,
  getTurnCredentials,
  createGroupCall,
} = require("../controllers/callController");

router.post(
  "/",
  auth,
  startCall
);

router.patch(
  "/:callId",
  auth,
  updateCall
);

router.post(
  "/group",
  auth,
  createGroupCall
);

router.get(
  "/history",
  auth,
  getCallHistory
);

router.patch(
  "/:callId/status",
  auth,
  updateCallStatus
);

router.get(
  "/turn-credentials",
  auth,
  getTurnCredentials
);

module.exports = router;
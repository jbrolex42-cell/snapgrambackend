const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const {
  startCall,
  updateCall,
  getCall,
  getCallHistory,
  updateCallStatus,
  getTurnCredentials,
  createGroupCall,
} = require("../controllers/callController");

router.use(auth);

router.post("/", startCall);

router.get("/history", getCallHistory);

router.get(
  "/turn-credentials",
  getTurnCredentials
);

router.post(
  "/group",
  createGroupCall
);

router.get(
  "/:callId",
  getCall
);

router.patch(
  "/:callId",
  updateCall
);

router.patch(
  "/:callId/status",
  updateCallStatus
);

module.exports = router;
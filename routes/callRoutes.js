const express = require("express");

const auth = require("../middleware/auth");

const {
  startCall,
  getCall,
  getCallHistory,
  getTurnCredentials,
  createGroupCall,
} = require("../controllers/callController");

const router = express.Router();

router.use(auth);

router.post("/", startCall);

router.get(
  "/history",
  getCallHistory
);

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

module.exports = router;
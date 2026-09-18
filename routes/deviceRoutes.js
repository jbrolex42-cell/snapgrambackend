const express = require("express");

const auth = require("../middleware/auth");

const {
  registerDevice,
  getUserDevices,
  getDevicePreKeyBundle,
  replenishPreKeys,
} = require("../controllers/deviceController");

const router = express.Router();

router.use(auth);

router.post(
  "/",
  registerDevice
);

router.post(
  "/prekeys",
  replenishPreKeys
);

router.get(
  "/user/:userId",
  getUserDevices
);

router.get(
  "/user/:userId/bundle",
  getDevicePreKeyBundle
);

module.exports = router;
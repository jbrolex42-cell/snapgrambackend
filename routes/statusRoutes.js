const express =
  require("express");

const router =
  express.Router();

const auth =
  require("../middleware/auth");

const {
  getUserStatus,
} =
  require(
    "../controllers/statusController"
  );

router.get(
  "/:userId",
  auth,
  getUserStatus
);

module.exports = router;
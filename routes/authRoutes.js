const express = require("express");

const {
  register,
  login,
  googleLogin,
  facebookLogin,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
  getSessions,
  revokeSession,
  deactivateAccount,
  deleteAccount,
  verifyTwoFactor,
} =
  require("../controllers/authController");

const protect =
  require("../middleware/auth");

const router =
  express.Router();

router.post(
  "/register",
  register
);

router.post(
  "/login",
  login
);

router.post(
  "/google",
  googleLogin
);

router.post(
  "/facebook",
  facebookLogin
);

router.get(
  "/me",
  protect,
  getMe
);

router.post(
  "/forgot-password",
  forgotPassword
);

router.post(
  "/reset-password",
  resetPassword
);

router.patch(
  "/change-password",
  protect,
  changePassword
);

router.get(
  "/sessions",
  protect,
  getSessions
);

router.delete(
  "/sessions/:sessionId",
  protect,
  revokeSession
);

router.post(
  "/verify-2fa",
  verifyTwoFactor
);

router.patch(
  "/deactivate",
  protect,
  deactivateAccount
);

router.delete(
  "/delete-account",
  protect,
  deleteAccount
);

module.exports = router;
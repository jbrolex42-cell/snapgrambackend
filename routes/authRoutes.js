const express = require("express");

const {
  register,
  login,
  googleLogin,
  facebookLogin,
  getMe,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");

const protect = require("../middleware/auth");

const router = express.Router();

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

module.exports = router;
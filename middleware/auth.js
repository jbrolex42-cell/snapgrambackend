const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const User = require("../models/User");
const UserSession = require("../models/UserSession");

async function protect(req, res, next) {
  try {
    const authorization =
      req.headers.authorization;

    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        message: "Not authorized",
      });
    }

    const token = authorization
      .slice(7)
      .trim();

    if (!token) {
      return res.status(401).json({
        message: "Not authorized",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error(
        "AUTH MIDDLEWARE ERROR: JWT_SECRET is not configured"
      );

      return res.status(500).json({
        message:
          "Authentication configuration error",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const userId = decoded?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Invalid token",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return res.status(401).json({
        message:
          "Invalid user identity in token",
      });
    }

    const user = await User.findById(
      userId
    );

    if (!user) {
      return res.status(401).json({
        message:
          "User no longer exists",
      });
    }

    if (user.isDeactivated) {
      return res.status(403).json({
        message:
          "This account is deactivated",
      });
    }

    if (decoded.sessionId) {
      const session =
        await UserSession.findOne({
          sessionId: decoded.sessionId,
          user: user._id,
          revokedAt: null,
        });

      if (!session) {
        return res.status(401).json({
          message:
            "This login session has expired or been revoked.",
        });
      }

      session.lastSeen = new Date();

      await session.save();

      req.session = session;
    }

    req.user = user;
    req.userId = user._id;

    return next();
  } catch (error) {
    console.error(
      "AUTH MIDDLEWARE ERROR:",
      error.message
    );

    if (
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        message: "Token expired",
      });
    }

    if (
      error.name === "JsonWebTokenError"
    ) {
      return res.status(401).json({
        message: "Invalid token",
      });
    }

    if (
      error.name === "CastError"
    ) {
      return res.status(401).json({
        message:
          "Invalid user identity",
      });
    }

    return res.status(401).json({
      message:
        "Invalid or expired token",
    });
  }
}

module.exports = protect;
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");

const User = require("../models/User");
const {
  sendPasswordResetEmail,
} = require("../services/emailService");

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

function publicUser(user) {
  if (!user) {
    return null;
  }

  const data = user.toObject
    ? user.toObject()
    : { ...user };

  delete data.password;
  delete data.__v;
  delete data.passwordResetToken;
  delete data.passwordResetExpires;

  return data;
}

function createToken(user) {
  return jwt.sign(
    {
      id: user._id,
    },
    process.env.JWT_SECRET,
    {
      expiresIn:
        process.env.JWT_EXPIRES_IN || "7d",
    }
  );
}

function sanitizeUsername(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 25);
}

async function generateUniqueUsername(base) {
  let username = sanitizeUsername(base);

  if (!username || username.length < 3) {
    username = "snapgramuser";
  }

  let candidate = username;
  let counter = 1;

  while (
    await User.exists({
      username: candidate,
    })
  ) {
    candidate = `${username}${counter}`;

    counter += 1;

    if (counter > 99999) {
      candidate = `user${Date.now()}`;
      break;
    }
  }

  return candidate;
}

async function register(req, res) {
  try {
    const {
      username,
      email,
      password,
      name,
      fullName,
      phone,
    } = req.body;

    const cleanUsername = username
      ?.trim()
      .toLowerCase();

    const cleanEmail = email
      ?.trim()
      .toLowerCase();

    const cleanName = (
      fullName ||
      name ||
      ""
    ).trim();

    const cleanPhone = phone?.trim() || "";

    if (
      !cleanUsername ||
      !cleanEmail ||
      !password
    ) {
      return res.status(400).json({
        message:
          "Username, email and password are required",
      });
    }

    if (cleanUsername.length < 3) {
      return res.status(400).json({
        message:
          "Username must contain at least 3 characters",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message:
          "Password must contain at least 6 characters",
      });
    }

    const existingUser = await User.findOne({
      $or: [
        {
          email: cleanEmail,
        },
        {
          username: cleanUsername,
        },
      ],
    });

    if (existingUser) {
      return res.status(409).json({
        message:
          "Username or email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      12
    );

    const user = await User.create({
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
      fullName:
        cleanName || cleanUsername,
      phone: cleanPhone,
      authProvider: "local",
    });

    return res.status(201).json({
      message:
        "Account created successfully",
      user: publicUser(user),
    });
  } catch (error) {
    console.error(
      "REGISTRATION ERROR:",
      error
    );

    return res.status(500).json({
      message: "Registration failed",
    });
  }
}

async function login(req, res) {
  try {
    const {
      email,
      phone,
      password,
    } = req.body;

    const cleanEmail = email
      ?.trim()
      .toLowerCase();

    const cleanPhone = phone?.trim();

    if (!password) {
      return res.status(400).json({
        message: "Password is required",
      });
    }

    if (!cleanEmail && !cleanPhone) {
      return res.status(400).json({
        message:
          "Email or phone number is required",
      });
    }

    const conditions = [];

    if (cleanEmail) {
      conditions.push({
        email: cleanEmail,
      });
    }

    if (cleanPhone) {
      conditions.push({
        phone: cleanPhone,
      });
    }

    const user = await User.findOne({
      $or: conditions,
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        message:
          "Invalid email, phone number or password",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        message:
          "This account uses social login. Continue with Google or Facebook.",
      });
    }

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!passwordMatches) {
      return res.status(401).json({
        message:
          "Invalid email, phone number or password",
      });
    }

    const token = createToken(user);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error
    );

    return res.status(500).json({
      message: "Login failed",
    });
  }
}

async function googleLogin(req, res) {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        message:
          "Google ID token is required",
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error(
        "GOOGLE_CLIENT_ID is missing"
      );

      return res.status(500).json({
        message:
          "Google login is not configured on the server",
      });
    }

    const ticket =
      await googleClient.verifyIdToken({
        idToken,
        audience:
          process.env.GOOGLE_CLIENT_ID,
      });

    const payload =
      ticket.getPayload();

    if (!payload) {
      return res.status(401).json({
        message:
          "Invalid Google token",
      });
    }

    const googleId = payload.sub;

    const email = payload.email
      ?.trim()
      .toLowerCase();

    const emailVerified =
      payload.email_verified;

    const fullName =
      payload.name ||
      payload.given_name ||
      "";

    const avatar =
      payload.picture || "";

    if (!googleId || !email) {
      return res.status(400).json({
        message:
          "Google account information is incomplete",
      });
    }

    if (!emailVerified) {
      return res.status(401).json({
        message:
          "Your Google email address must be verified",
      });
    }

    let user = await User.findOne({
      googleId,
    });

    if (!user) {
      user = await User.findOne({
        email,
      });
    }

    if (user) {
      user.googleId = googleId;

      if (!user.fullName && fullName) {
        user.fullName = fullName;
      }

      if (!user.avatar && avatar) {
        user.avatar = avatar;
      }

      await user.save();
    } else {
      const username =
        await generateUniqueUsername(
          payload.given_name ||
            email.split("@")[0]
        );

      user = await User.create({
        username,
        email,
        password: null,
        fullName,
        avatar,
        googleId,
        authProvider: "google",
      });
    }

    const token = createToken(user);

    return res.status(200).json({
      message:
        "Google login successful",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error(
      "GOOGLE LOGIN ERROR:",
      error
    );

    return res.status(401).json({
      message:
        "Google authentication failed",
    });
  }
}

async function facebookLogin(req, res) {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        message:
          "Facebook access token is required",
      });
    }

    const appId =
      process.env.FACEBOOK_APP_ID;

    const appSecret =
      process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      console.error(
        "Facebook environment variables are missing"
      );

      return res.status(500).json({
        message:
          "Facebook login is not configured on the server",
      });
    }

    const appAccessToken =
      `${appId}|${appSecret}`;

    const debugResponse =
      await axios.get(
        "https://graph.facebook.com/debug_token",
        {
          params: {
            input_token: accessToken,
            access_token:
              appAccessToken,
          },
        }
      );

    const tokenData =
      debugResponse.data?.data;

    if (
      !tokenData ||
      !tokenData.is_valid
    ) {
      return res.status(401).json({
        message:
          "Invalid Facebook access token",
      });
    }

    if (
      String(tokenData.app_id) !==
      String(appId)
    ) {
      return res.status(401).json({
        message:
          "Facebook token belongs to another application",
      });
    }

    const profileResponse =
      await axios.get(
        "https://graph.facebook.com/me",
        {
          params: {
            fields:
              "id,name,email,picture",
            access_token:
              accessToken,
          },
        }
      );

    const profile =
      profileResponse.data;

    const facebookId =
      profile?.id;

    const email =
      profile?.email
        ?.trim()
        .toLowerCase();

    const fullName =
      profile?.name || "";

    const avatar =
      profile?.picture?.data?.url ||
      "";

    if (!facebookId) {
      return res.status(401).json({
        message:
          "Facebook account ID was not returned",
      });
    }

    if (!email) {
      return res.status(400).json({
        message:
          "Facebook did not provide an email address. Please allow email permission or use another login method.",
      });
    }

    let user =
      await User.findOne({
        facebookId,
      });

    if (!user) {
      user =
        await User.findOne({
          email,
        });
    }

    if (user) {
      user.facebookId =
        facebookId;

      if (
        !user.fullName &&
        fullName
      ) {
        user.fullName =
          fullName;
      }

      if (
        !user.avatar &&
        avatar
      ) {
        user.avatar =
          avatar;
      }

      await user.save();
    } else {
      const username =
        await generateUniqueUsername(
          fullName ||
            email.split("@")[0]
        );

      user =
        await User.create({
          username,
          email,
          password: null,
          fullName,
          avatar,
          facebookId,
          authProvider:
            "facebook",
        });
    }

    const token =
      createToken(user);

    return res.status(200).json({
      message:
        "Facebook login successful",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error(
      "FACEBOOK LOGIN ERROR:",
      error.response?.data ||
        error
    );

    return res.status(401).json({
      message:
        "Facebook authentication failed",
    });
  }
}

async function getMe(req, res) {
  try {
    const userId =
      req.user?.id ||
      req.user?._id ||
      req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const user =
      await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      user: publicUser(user),
    });
  } catch (error) {
    console.error(
      "GET CURRENT USER ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to get current user",
    });
  }
}

async function forgotPassword(req, res) {
  try {
    const email = String(
      req.body?.email || ""
    )
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({
        message:
          "Email address is required.",
      });
    }

    const genericResponse = {
      message:
        "If an account exists for this email, password reset instructions have been sent.",
    };

    const user =
      await User.findOne({
        email,
      });

    if (!user) {
      return res.status(200).json(
        genericResponse
      );
    }

    const resetToken =
      crypto.randomBytes(32).toString(
        "hex"
      );

    const resetTokenHash =
      crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

    const resetTokenExpires =
      new Date(
        Date.now() +
          60 * 60 * 1000
      );

    user.passwordResetToken =
      resetTokenHash;

    user.passwordResetExpires =
      resetTokenExpires;

    await user.save();

    await sendPasswordResetEmail({
      email: user.email,

      username:
        user.username ||
        user.fullName ||
        "there",

      resetToken,
    });

    return res.status(200).json(
      genericResponse
    );
  } catch (error) {
    console.error(
      "FORGOT PASSWORD ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to process your password reset request.",
    });
  }
}

async function resetPassword(req, res) {
  try {
    const token = String(
      req.body?.token || ""
    ).trim();

    const password = String(
      req.body?.password || ""
    );

    if (!token) {
      return res.status(400).json({
        message:
          "Password reset token is required.",
      });
    }

    if (!password) {
      return res.status(400).json({
        message:
          "New password is required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message:
          "Password must contain at least 8 characters.",
      });
    }

    const tokenHash =
      crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    const user =
      await User.findOne({
        passwordResetToken:
          tokenHash,

        passwordResetExpires: {
          $gt: new Date(),
        },
      });

    if (!user) {
      return res.status(400).json({
        message:
          "This password reset link is invalid or has expired.",
      });
    }

    const hashedPassword =
      await bcrypt.hash(
        password,
        12
      );

    user.password =
      hashedPassword;

    user.passwordResetToken =
      undefined;

    user.passwordResetExpires =
      undefined;

    if (!user.authProvider) {
      user.authProvider = "local";
    }

    await user.save();

    return res.status(200).json({
      message:
        "Your password has been reset successfully.",
    });
  } catch (error) {
    console.error(
      "RESET PASSWORD ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to reset your password.",
    });
  }
}

module.exports = {
  register,
  login,
  googleLogin,
  facebookLogin,
  getMe,
  forgotPassword,
  resetPassword,
};
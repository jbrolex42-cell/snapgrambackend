const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");

const User = require("../models/User");
const UserSession = require("../models/UserSession");
const UserSettings = require("../models/UserSettings");
const TwoFactorChallenge = require("../models/TwoFactorChallenge");
const VerificationRequest = require("../models/VerificationRequest");

const {
  sendPasswordResetEmail,
  sendTwoFactorCode,
} = require("../services/emailService");

/* =========================================================
   GOOGLE CONFIGURATION
========================================================= */

const GOOGLE_CLIENT_ID = String(
  process.env.GOOGLE_CLIENT_ID || ""
).trim();

const googleClient = GOOGLE_CLIENT_ID
  ? new OAuth2Client(GOOGLE_CLIENT_ID)
  : null;

/* =========================================================
   SECURITY HELPERS
========================================================= */

function generateTwoFactorCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashValue(value) {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex");
}

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token))
    .digest("hex");
}

/* =========================================================
   PUBLIC USER
========================================================= */

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

/* =========================================================
   DEVICE / SESSION HELPERS
========================================================= */

function getDeviceName(req) {
  const userAgent = String(
    req?.headers?.["user-agent"] || ""
  );

  if (!userAgent) {
    return "Unknown device";
  }

  if (/Android/i.test(userAgent)) {
    return "Android device";
  }

  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return "iPhone / iPad";
  }

  if (/Windows/i.test(userAgent)) {
    return "Windows";
  }

  if (/Macintosh|Mac OS/i.test(userAgent)) {
    return "Mac";
  }

  if (/Linux/i.test(userAgent)) {
    return "Linux";
  }

  return "Unknown device";
}

function getPlatform(req) {
  const userAgent = String(
    req?.headers?.["user-agent"] || ""
  );

  if (/Android/i.test(userAgent)) {
    return "Android";
  }

  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return "iOS";
  }

  if (/Windows/i.test(userAgent)) {
    return "Windows";
  }

  if (/Macintosh|Mac OS/i.test(userAgent)) {
    return "macOS";
  }

  if (/Linux/i.test(userAgent)) {
    return "Linux";
  }

  return "Unknown";
}

/* =========================================================
   CREATE AUTH TOKEN + SESSION
========================================================= */

async function createToken(user, req) {
  if (!user?._id) {
    throw new Error("Cannot create token without a user.");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }

  const sessionId = crypto.randomUUID();
  const tokenId = crypto.randomUUID();

  const token = jwt.sign(
    {
      id: user._id,
      sessionId,
      jti: tokenId,
    },
    process.env.JWT_SECRET,
    {
      expiresIn:
        process.env.JWT_EXPIRES_IN || "7d",
    }
  );

  await UserSession.create({
    user: user._id,
    sessionId,
    tokenId,
    tokenHash: hashToken(token),
    deviceName: getDeviceName(req),
    platform: getPlatform(req),
    userAgent: String(
      req?.headers?.["user-agent"] || ""
    ),
    ipAddress: req?.ip || "",
    location: "Unknown location",
    lastSeen: new Date(),
    revokedAt: null,
  });

  return token;
}

/* =========================================================
   USERNAME HELPERS
========================================================= */

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

/* =========================================================
   GOOGLE TOKEN DIAGNOSTICS
========================================================= */

function decodeGoogleTokenForDiagnostics(idToken) {
  try {
    const parts = String(idToken || "").split(".");

    if (parts.length !== 3) {
      return null;
    }

    const encodedPayload = parts[1];

    const normalizedPayload =
      encodedPayload
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const paddedPayload =
      normalizedPayload +
      "=".repeat(
        (4 -
          (normalizedPayload.length % 4)) %
          4
      );

    return JSON.parse(
      Buffer.from(
        paddedPayload,
        "base64"
      ).toString("utf8")
    );
  } catch (error) {
    console.error(
      "[GOOGLE] Diagnostic decode failed:",
      error?.message || error
    );

    return null;
  }
}

/* =========================================================
   CREATE TWO-FACTOR CHALLENGE
========================================================= */

async function createTwoFactorChallenge(user) {
  const code = generateTwoFactorCode();

  const challengeToken =
    crypto.randomBytes(32).toString("hex");

  const codeHash = hashValue(code);

  await TwoFactorChallenge.deleteMany({
    user: user._id,
  });

  await TwoFactorChallenge.create({
    user: user._id,
    challengeToken,
    codeHash,
    attempts: 0,
    expiresAt: new Date(
      Date.now() + 10 * 60 * 1000
    ),
  });

  try {
    await sendTwoFactorCode({
      email: user.email,
      username:
        user.fullName ||
        user.username ||
        "there",
      code,
    });
  } catch (error) {
    await TwoFactorChallenge.deleteMany({
      user: user._id,
    });

    throw error;
  }

  return challengeToken;
}

/* =========================================================
   REGISTER
========================================================= */

async function register(req, res) {
  try {
    const {
      username,
      email,
      password,
      name,
      fullName,
      phone,
    } = req.body || {};

    const cleanUsername =
      String(username || "")
        .trim()
        .toLowerCase();

    const cleanEmail =
      String(email || "")
        .trim()
        .toLowerCase();

    const cleanName = String(
      fullName || name || ""
    ).trim();

    const cleanPhone =
      String(phone || "").trim();

    if (
      !cleanUsername ||
      !cleanEmail ||
      !password
    ) {
      return res.status(400).json({
        message:
          "Username, email and password are required.",
      });
    }

    if (cleanUsername.length < 3) {
      return res.status(400).json({
        message:
          "Username must contain at least 3 characters.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message:
          "Password must contain at least 6 characters.",
      });
    }

    const existingUser =
      await User.findOne({
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
          "Username or email already exists.",
      });
    }

    const hashedPassword =
      await bcrypt.hash(password, 12);

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
        "Account created successfully.",
      user: publicUser(user),
    });
  } catch (error) {
    console.error(
      "REGISTRATION ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Registration failed.",
    });
  }
}

/* =========================================================
   LOGIN
========================================================= */

async function login(req, res) {
  try {
    const {
      email,
      phone,
      username,
      password,
    } = req.body || {};

    const cleanEmail =
      String(email || "")
        .trim()
        .toLowerCase();

    const cleanPhone =
      String(phone || "").trim();

    const cleanUsername =
      String(username || "")
        .trim()
        .toLowerCase();

    if (!password) {
      return res.status(400).json({
        message:
          "Password is required.",
      });
    }

    if (
      !cleanEmail &&
      !cleanPhone &&
      !cleanUsername
    ) {
      return res.status(400).json({
        message:
          "Email, username, or phone number is required.",
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

    if (cleanUsername) {
      conditions.push({
        username: cleanUsername,
      });
    }

    const user =
      await User.findOne({
        $or: conditions,
      }).select("+password");

    if (!user) {
      return res.status(401).json({
        message:
          "Invalid email, username, phone number or password.",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        message:
          "This account uses social login. Continue with Google or Facebook.",
      });
    }

    if (user.isDeactivated) {
      return res.status(403).json({
        message:
          "This account is currently deactivated.",
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
          "Invalid email, username, phone number or password.",
      });
    }

    /* -------------------------------------------------------
       TWO-FACTOR AUTHENTICATION
    ------------------------------------------------------- */

    const userSettings =
      await UserSettings.findOne({
        user: user._id,
      });

    const twoFactorEnabled = Boolean(
      userSettings?.twoFactorEnabled
    );

    if (twoFactorEnabled) {
      try {
        const challengeToken =
          await createTwoFactorChallenge(
            user
          );

        return res.status(200).json({
          message:
            "Two-factor authentication code required.",
          requiresTwoFactor: true,
          challengeToken,
          user: publicUser(user),
        });
      } catch (emailError) {
        console.error(
          "2FA EMAIL ERROR:",
          emailError
        );

        return res.status(500).json({
          message:
            "Unable to send the security code. Please try again.",
        });
      }
    }

    /* -------------------------------------------------------
       NORMAL LOGIN
    ------------------------------------------------------- */

    const token =
      await createToken(user, req);

    return res.status(200).json({
      message:
        "Login successful.",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Login failed.",
    });
  }
}

/* =========================================================
   VERIFY TWO-FACTOR CODE
========================================================= */

async function verifyTwoFactor(req, res) {
  try {
    const {
      challengeToken,
      code,
    } = req.body || {};

    if (!challengeToken) {
      return res.status(400).json({
        message:
          "Two-factor challenge is required.",
      });
    }

    const cleanCode =
      String(code || "").trim();

    if (!cleanCode) {
      return res.status(400).json({
        message:
          "Security code is required.",
      });
    }

    if (!/^\d{6}$/.test(cleanCode)) {
      return res.status(400).json({
        message:
          "Security code must contain 6 digits.",
      });
    }

    const challenge =
      await TwoFactorChallenge.findOne({
        challengeToken,
      });

    if (!challenge) {
      return res.status(401).json({
        message:
          "This security challenge is invalid or has expired.",
      });
    }

    if (
      challenge.expiresAt <=
      new Date()
    ) {
      await challenge.deleteOne();

      return res.status(401).json({
        message:
          "This security code has expired. Please sign in again.",
      });
    }

    if (challenge.attempts >= 5) {
      await challenge.deleteOne();

      return res.status(429).json({
        message:
          "Too many incorrect attempts. Please sign in again.",
      });
    }

    const submittedHash =
      hashValue(cleanCode);

    if (
      submittedHash !==
      challenge.codeHash
    ) {
      challenge.attempts += 1;

      await challenge.save();

      return res.status(401).json({
        message:
          "Incorrect security code.",
        attemptsRemaining:
          Math.max(
            0,
            5 - challenge.attempts
          ),
      });
    }

    const user =
      await User.findById(
        challenge.user
      );

    if (!user) {
      await challenge.deleteOne();

      return res.status(404).json({
        message:
          "User no longer exists.",
      });
    }

    if (user.isDeactivated) {
      await challenge.deleteOne();

      return res.status(403).json({
        message:
          "This account is currently deactivated.",
      });
    }

    const settings =
      await UserSettings.findOne({
        user: user._id,
      });

    if (!settings?.twoFactorEnabled) {
      await challenge.deleteOne();

      return res.status(400).json({
        message:
          "Two-factor authentication is not enabled for this account.",
      });
    }

    challenge.verifiedAt =
      new Date();

    await challenge.save();

    const token =
      await createToken(user, req);

    await challenge.deleteOne();

    return res.status(200).json({
      message:
        "Two-factor authentication successful.",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error(
      "VERIFY TWO FACTOR ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to verify the security code.",
    });
  }
}

/* =========================================================
   GOOGLE LOGIN
========================================================= */

async function googleLogin(req, res) {
  try {
    const { idToken } =
      req.body || {};

    if (!idToken) {
      return res.status(400).json({
        message:
          "Google ID token is required.",
      });
    }

    if (
      !GOOGLE_CLIENT_ID ||
      !googleClient
    ) {
      console.error(
        "[GOOGLE] GOOGLE_CLIENT_ID is missing."
      );

      return res.status(500).json({
        message:
          "Google login is not configured on the server.",
      });
    }

    console.log(
      "[GOOGLE] Verifying Google ID token..."
    );

    console.log(
      "[GOOGLE] Expected audience:",
      GOOGLE_CLIENT_ID
    );

    const diagnosticPayload =
      decodeGoogleTokenForDiagnostics(
        idToken
      );

    console.log(
      "[GOOGLE] ACTUAL TOKEN AUDIENCE:",
      diagnosticPayload?.aud ||
        "NOT FOUND"
    );

    console.log(
      "[GOOGLE] TOKEN ISSUER:",
      diagnosticPayload?.iss ||
        "NOT FOUND"
    );

    console.log(
      "[GOOGLE] TOKEN AUTHORIZED PARTY:",
      diagnosticPayload?.azp ||
        "NOT FOUND"
    );

    console.log(
      "[GOOGLE] AUDIENCE MATCH:",
      String(
        diagnosticPayload?.aud
      ) ===
        String(GOOGLE_CLIENT_ID)
    );

    const ticket =
      await googleClient.verifyIdToken({
        idToken,
        audience:
          GOOGLE_CLIENT_ID,
      });

    const payload =
      ticket.getPayload();

    if (!payload) {
      return res.status(401).json({
        message:
          "Invalid Google token.",
      });
    }

    if (
      String(payload.aud) !==
      String(GOOGLE_CLIENT_ID)
    ) {
      return res.status(401).json({
        message:
          "Google token audience does not match Snapgram's configured Google client.",
      });
    }

    const googleId =
      payload.sub;

    const email =
      payload.email
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
          "Google account information is incomplete.",
      });
    }

    if (!emailVerified) {
      return res.status(401).json({
        message:
          "Your Google email address must be verified.",
      });
    }

    let user =
      await User.findOne({
        googleId,
      });

    if (!user) {
      user =
        await User.findOne({
          email,
        });
    }

    if (user) {
      user.googleId =
        googleId;

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

      if (!user.authProvider) {
        user.authProvider =
          "google";
      }

      await user.save();
    } else {
      const username =
        await generateUniqueUsername(
          payload.given_name ||
            email.split("@")[0]
        );

      user =
        await User.create({
          username,
          email,
          password: null,
          fullName,
          avatar,
          googleId,
          authProvider: "google",
        });
    }

    if (user.isDeactivated) {
      return res.status(403).json({
        message:
          "This account is currently deactivated.",
      });
    }

    const token =
      await createToken(user, req);

    console.log(
      "[GOOGLE] Login successful:",
      user._id.toString()
    );

    return res.status(200).json({
      message:
        "Google login successful.",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error(
      "[GOOGLE] LOGIN ERROR:",
      error?.message ||
        error
    );

    if (
      error?.message?.includes(
        "Wrong recipient"
      )
    ) {
      return res.status(401).json({
        message:
          "Google login configuration mismatch. The Google ID token audience does not match the Google client configured on Snapgram's backend.",
      });
    }

    return res.status(401).json({
      message:
        "Google authentication failed.",
    });
  }
}

/* =========================================================
   FACEBOOK LOGIN
========================================================= */

async function facebookLogin(req, res) {
  try {
    const {
      accessToken,
    } = req.body || {};

    if (!accessToken) {
      return res.status(400).json({
        message:
          "Facebook access token is required.",
      });
    }

    const appId =
      process.env.FACEBOOK_APP_ID;

    const appSecret =
      process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      return res.status(500).json({
        message:
          "Facebook login is not configured on the server.",
      });
    }

    const appAccessToken =
      `${appId}|${appSecret}`;

    const debugResponse =
      await axios.get(
        "https://graph.facebook.com/debug_token",
        {
          params: {
            input_token:
              accessToken,
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
          "Invalid Facebook access token.",
      });
    }

    if (
      String(tokenData.app_id) !==
      String(appId)
    ) {
      return res.status(401).json({
        message:
          "Facebook token belongs to another application.",
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
          "Facebook account ID was not returned.",
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

      if (!user.authProvider) {
        user.authProvider =
          "facebook";
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

    if (user.isDeactivated) {
      return res.status(403).json({
        message:
          "This account is currently deactivated.",
      });
    }

    const token =
      await createToken(user, req);

    return res.status(200).json({
      message:
        "Facebook login successful.",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error(
      "FACEBOOK LOGIN ERROR:",
      error?.response?.data ||
        error?.message ||
        error
    );

    return res.status(401).json({
      message:
        "Facebook authentication failed.",
    });
  }
}

/* =========================================================
   GET CURRENT USER
========================================================= */

async function getMe(req, res) {
  try {
    const userId =
      req.user?._id ||
      req.user?.id ||
      req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        message:
          "Unauthorized.",
      });
    }

    const user =
      await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message:
          "User not found.",
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
        "Unable to get current user.",
    });
  }
}

/* =========================================================
   GET LOGIN SESSIONS
========================================================= */

async function getSessions(req, res) {
  try {
    const sessions =
      await UserSession.find({
        user: req.user._id,
        revokedAt: null,
      })
        .sort({
          lastSeen: -1,
        })
        .lean();

    /*
     * The JWT sessionId is not currently attached
     * to req.session by your auth middleware.
     *
     * We therefore safely return current=false
     * until middleware exposes the JWT session.
     */
    const result =
      sessions.map(
        (session) => ({
          _id:
            session.sessionId,

          sessionId:
            session.sessionId,

          deviceName:
            session.deviceName ||
            "Unknown device",

          platform:
            session.platform ||
            "Unknown",

          location:
            session.location ||
            "Unknown location",

          lastSeen:
            session.lastSeen,

          createdAt:
            session.createdAt,

          current: false,
        })
      );

    return res.status(200).json({
      sessions: result,
    });
  } catch (error) {
    console.error(
      "GET SESSIONS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to load login activity.",
    });
  }
}

/* =========================================================
   REVOKE LOGIN SESSION
========================================================= */

async function revokeSession(req, res) {
  try {
    const session =
      await UserSession.findOne({
        sessionId:
          req.params.sessionId,
        user: req.user._id,
      });

    if (!session) {
      return res.status(404).json({
        message:
          "Login session not found.",
      });
    }

    session.revokedAt =
      new Date();

    await session.save();

    return res.status(200).json({
      message:
        "Login session revoked successfully.",
    });
  } catch (error) {
    console.error(
      "REVOKE SESSION ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to revoke login session.",
    });
  }
}

/* =========================================================
   CHANGE PASSWORD
========================================================= */

async function changePassword(req, res) {
  try {
    const {
      currentPassword,
      newPassword,
    } = req.body || {};

    if (!currentPassword) {
      return res.status(400).json({
        message:
          "Current password is required.",
      });
    }

    if (!newPassword) {
      return res.status(400).json({
        message:
          "New password is required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        message:
          "New password must contain at least 8 characters.",
      });
    }

    if (
      currentPassword ===
      newPassword
    ) {
      return res.status(400).json({
        message:
          "New password must be different from the current password.",
      });
    }

    const user =
      await User.findById(
        req.user._id
      ).select("+password");

    if (!user) {
      return res.status(404).json({
        message:
          "User not found.",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        message:
          "This account does not currently use a password. Please use your social login provider.",
      });
    }

    const matches =
      await bcrypt.compare(
        currentPassword,
        user.password
      );

    if (!matches) {
      return res.status(400).json({
        message:
          "Current password is incorrect.",
      });
    }

    user.password =
      await bcrypt.hash(
        newPassword,
        12
      );

    await user.save();

    /*
     * Revoke every other active session.
     */
    await UserSession.updateMany(
      {
        user: user._id,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt:
            new Date(),
        },
      }
    );

    return res.status(200).json({
      message:
        "Password changed successfully.",
    });
  } catch (error) {
    console.error(
      "CHANGE PASSWORD ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to change password.",
    });
  }
}

/* =========================================================
   DEACTIVATE ACCOUNT
========================================================= */

async function deactivateAccount(req, res) {
  try {
    const user =
      await User.findById(
        req.user._id
      );

    if (!user) {
      return res.status(404).json({
        message:
          "User not found.",
      });
    }

    user.isDeactivated = true;
    user.deactivatedAt =
      new Date();

    user.isOnline = false;
    user.lastSeen =
      new Date();

    await user.save();

    await UserSession.updateMany(
      {
        user: user._id,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt:
            new Date(),
        },
      }
    );

    return res.status(200).json({
      message:
        "Your account has been deactivated.",
    });
  } catch (error) {
    console.error(
      "DEACTIVATE ACCOUNT ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to deactivate account.",
    });
  }
}

/* =========================================================
   DELETE ACCOUNT
========================================================= */

async function deleteAccount(req, res) {
  try {
    const user =
      await User.findById(
        req.user._id
      );

    if (!user) {
      return res.status(404).json({
        message:
          "User not found.",
      });
    }

    await UserSession.deleteMany({
      user: user._id,
    });

    await UserSettings.deleteOne({
      user: user._id,
    });

    await TwoFactorChallenge.deleteMany({
      user: user._id,
    });

    await VerificationRequest.deleteOne({
      user: user._id,
    });

    await User.deleteOne({
      _id: user._id,
    });

    return res.status(200).json({
      message:
        "Your account has been deleted.",
    });
  } catch (error) {
    console.error(
      "DELETE ACCOUNT ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to delete account.",
    });
  }
}

/* =========================================================
   FORGOT PASSWORD
========================================================= */

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
      crypto
        .randomBytes(32)
        .toString("hex");

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

/* =========================================================
   RESET PASSWORD
========================================================= */

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

    user.password =
      await bcrypt.hash(
        password,
        12
      );

    user.passwordResetToken =
      undefined;

    user.passwordResetExpires =
      undefined;

    if (!user.authProvider) {
      user.authProvider =
        "local";
    }

    await user.save();

    /*
     * Password reset should invalidate
     * all existing login sessions.
     */
    await UserSession.updateMany(
      {
        user: user._id,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt:
            new Date(),
        },
      }
    );

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

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
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
};
require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { initializeSocket } = require("./sockets/socket");
const connectDB = require("./config/db");

const compression = require("./middleware/compression");
const statusRoutes = require("./routes/statusRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const storyRoutes = require("./routes/storyRoutes");
const highlightRoutes = require("./routes/highlightRoutes");
const postRoutes = require("./routes/postRoutes");
const commentRoutes = require("./routes/commentRoutes");
const translationRoutes = require("./routes/translationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const followRoutes = require("./routes/followRoutes");
const searchRoutes = require("./routes/searchRoutes");
const exploreRoutes = require("./routes/exploreRoutes");
const feedRoutes = require("./routes/feedRoutes");
const reelRoutes = require("./routes/reelRoutes");
const likeRoutes = require("./routes/likeRoutes");
const messageRoutes = require("./routes/messageRoutes");
const callRoutes = require("./routes/callRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const verificationRoutes = require("./routes/verificationRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const liveRoutes = require("./routes/liveRoutes");
const professionalRoutes = require("./routes/professionalRoutes");

const giftsRoutes = require("./routes/giftsRoutes");
const earningsRoutes = require("./routes/earningsRoutes");
const payoutsRoutes = require("./routes/payoutsRoutes");
const monetizationRoutes = require("./routes/monetizationRoutes");
const monetizationSetupRoutes = require("./routes/monetizationSetupRoutes");
const conversationPreferenceRoutes = require( "./routes/conversationPreferenceRoutes" );

const cloudinary = require("cloudinary").v2;

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({
    name: "Snapgram API",
    status: "running",
    version: "1.0.0",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    database: "connected",
  });
});

app.use(compression);

app.use("/api/auth", authRoutes);

app.use("/api/users", userRoutes);

app.use("/api/follows", followRoutes);

app.use("/api/status", statusRoutes);

app.use("/api/stories", storyRoutes);

app.use("/api/highlights", highlightRoutes);

app.use("/api/posts", postRoutes);

app.use("/api/comments", commentRoutes);

app.use(
  "/api/translation",
  translationRoutes
);

app.use(
  "/api/notifications",
  notificationRoutes
);

app.use("/api/search", searchRoutes);

app.use("/api/explore", exploreRoutes);

app.use("/api/uploads", uploadRoutes);

app.use("/api/feed", feedRoutes);

app.use("/api/reels", reelRoutes);

app.use("/api/likes", likeRoutes);

app.use("/api/messages", messageRoutes);

app.use(
  "/api/devices",
  deviceRoutes
);

app.use("/api/calls", callRoutes);

app.use("/api/settings", settingsRoutes);

app.use(
  "/api/verification",
  verificationRoutes
);

app.use(
  "/api/subscriptions",
  subscriptionRoutes
);

app.use("/api/live", liveRoutes);

app.use(
  "/api/professional",
  professionalRoutes
);

app.use(
  "/api/gifts",
  giftsRoutes
);

app.use(
  "/api/earnings",
  earningsRoutes
);

app.use(
  "/api/payouts",
  payoutsRoutes
);

app.use(
  "/api/monetization",
  monetizationRoutes
);

app.use(
  "/api/monetization/setup",
  monetizationSetupRoutes
);

app.use( "/api/conversation-preferences", conversationPreferenceRoutes );

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "API route not found.",
    path: req.originalUrl,
  });
});

app.use(
  (error, req, res, next) => {
    console.error(
      "[server] Unhandled error:",
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    return res.status(
      error.status || 500
    ).json({
      success: false,
      message:
        error.message ||
        "Internal server error.",
      ...(process.env.NODE_ENV !==
        "production" && {
        stack: error.stack,
      }),
    });
  }
);

async function startServer() {
  try {
    console.log(
      "[startup] Starting Snapgram..."
    );

    console.log(
      "[startup] MONGO_URI exists:",
      Boolean(process.env.MONGO_URI)
    );

    console.log(
      "[startup] MONGO_URI prefix:",
      process.env.MONGO_URI
        ? process.env.MONGO_URI.slice(0, 14)
        : "undefined"
    );

    console.log(
      "[startup] Connecting to MongoDB..."
    );

    await connectDB();

    console.log(
      "[startup] MongoDB connected successfully"
    );

    initializeSocket(server);

    console.log(
      "[startup] Socket.IO initialized successfully"
    );

    server.listen(PORT, () => {
      console.log(
        `Snapgram server running on port ${PORT}`
      );

      console.log(
        "[startup] Monetization routes enabled:"
      );

      console.log(
        "  /api/gifts"
      );

      console.log(
        "  /api/earnings"
      );

      console.log(
        "  /api/payouts"
      );

      console.log(
        "  /api/monetization"
      );
    });
  } catch (error) {
    console.error(
      "[startup] Failed to start Snapgram:",
      error
    );

    process.exit(1);
  }
}

startServer();
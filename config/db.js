const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error(
      "MONGO_URI is not defined. Add your MongoDB Atlas connection string to the environment variables."
    );
  }

  try {
    await mongoose.connect(uri);

    console.log("[db] connected to MongoDB");
  } catch (error) {
    console.error("[db] connection error:", error.message);
    throw error;
  }
}

module.exports = connectDB;
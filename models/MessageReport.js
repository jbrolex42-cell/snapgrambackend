const mongoose = require("mongoose");

const messageReportSchema =
new mongoose.Schema(
{
reporter: {
type: mongoose.Schema.Types.ObjectId,
ref: "User",
required: true,
index: true,
},

  reportedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true,
    index: true,
  },

  message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
    default: null,
  },

  reason: {
    type: String,
    enum: [
      "spam",
      "harassment",
      "scam",
      "inappropriate",
      "hate",
      "other",
    ],
    required: true,
  },

  details: {
    type: String,
    maxlength: 1000,
    default: "",
  },

  status: {
    type: String,
    enum: [
      "pending",
      "reviewed",
      "resolved",
      "dismissed",
    ],
    default: "pending",
    index: true,
  },
},
{
  timestamps: true,
}

);

messageReportSchema.index({
reporter: 1,
createdAt: -1,
});

messageReportSchema.index({
reportedUser: 1,
createdAt: -1,
});

module.exports =
mongoose.models.MessageReport ||
mongoose.model(
"MessageReport",
messageReportSchema
);
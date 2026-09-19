const mongoose = require("mongoose");

const conversationPreferenceSchema =
new mongoose.Schema(
{
conversation: {
type: mongoose.Schema.Types.ObjectId,
ref: "Conversation",
required: true,
index: true,
},

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  mutedUntil: {
    type: Date,
    default: null,
  },

  restricted: {
    type: Boolean,
    default: false,
  },

  theme: {
    type: String,
    default: "default",
    maxlength: 50,
  },

  nickname: {
    type: String,
    default: "",
    trim: true,
    maxlength: 50,
  },

  disappearingDuration: {
    type: Number,
    enum: [
      0,
      86400,
      604800,
      2592000,
    ],
    default: 0,
  },
},
{
  timestamps: true,
}

);

conversationPreferenceSchema.index(
  {
    conversation: 1,
    user: 1,
  },
  {
    unique: true,
  }
);

module.exports =
mongoose.models.ConversationPreference ||
mongoose.model(
"ConversationPreference",
conversationPreferenceSchema
);
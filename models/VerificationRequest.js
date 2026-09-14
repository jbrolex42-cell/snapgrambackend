const mongoose = require("mongoose");

const verificationRequestSchema = new mongoose.Schema(
{
user: {
type: mongoose.Schema.Types.ObjectId,
ref: "User",
required: true,
unique: true,
index: true,
},

fullName: {
  type: String,
  required: true,
  trim: true,
  maxlength: 100,
},

username: {
  type: String,
  required: true,
  trim: true,
  maxlength: 30,
},

category: {
  type: String,
  required: true,
  trim: true,
  maxlength: 100,
},

reason: {
  type: String,
  required: true,
  trim: true,
  maxlength: 2000,
},

website: {
  type: String,
  trim: true,
  maxlength: 300,
  default: "",
},

status: {
  type: String,
  enum: ["pending", "approved", "rejected"],
  default: "pending",
  index: true,
},

reviewedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  default: null,
},

reviewedAt: {
  type: Date,
  default: null,
},

rejectionReason: {
  type: String,
  trim: true,
  maxlength: 1000,
  default: "",
},

},
{
timestamps: true,
}
);

module.exports = mongoose.model(
"VerificationRequest",
verificationRequestSchema
);
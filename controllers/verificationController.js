const User = require("../models/User");
const VerificationRequest = require("../models/VerificationRequest");

async function applyForVerification(req, res) {
try {
const user = await User.findById(req.user._id);

if (!user) {
  return res.status(404).json({
    message: "User not found",
  });
}

if (user.isVerified === true) {
  return res.status(400).json({
    message: "Your account is already verified",
    status: "approved",
    isVerified: true,
  });
}

const existingRequest = await VerificationRequest.findOne({
  user: user._id,
});

if (
  existingRequest &&
  existingRequest.status === "pending"
) {
  if (user.verificationStatus !== "pending") {
    user.verificationStatus = "pending";
    await user.save();
  }

  return res.status(400).json({
    message:
      "You already have a pending verification request. Please wait for an admin to review it.",
    status: "pending",
    isVerified: false,
    request: {
      _id: existingRequest._id,
      status: existingRequest.status,
      category: existingRequest.category,
      createdAt: existingRequest.createdAt,
    },
  });
}

if (
  existingRequest &&
  existingRequest.status === "approved"
) {
  user.isVerified = true;
  user.verificationStatus = "approved";

  await user.save();

  return res.status(400).json({
    message: "Your account is already verified.",
    status: "approved",
    isVerified: true,
  });
}

const category =
  typeof req.body.category === "string"
    ? req.body.category.trim()
    : "";

const reason =
  typeof req.body.reason === "string"
    ? req.body.reason.trim()
    : "";

const website =
  typeof req.body.website === "string"
    ? req.body.website.trim()
    : "";

if (!category) {
  return res.status(400).json({
    message: "Verification category is required",
  });
}

if (!reason) {
  return res.status(400).json({
    message:
      "Please explain why you are requesting verification",
  });
}

let request = existingRequest;

if (
  request &&
  request.status === "rejected"
) {
  request.fullName =
    user.name || user.username;

  request.username = user.username;
  request.category = category;
  request.reason = reason;
  request.website = website;
  request.status = "pending";
  request.reviewedBy = null;
  request.reviewedAt = null;
  request.rejectionReason = "";

  await request.save();
}

if (!request) {
  request = await VerificationRequest.create({
    user: user._id,
    fullName: user.name || user.username,
    username: user.username,
    category,
    reason,
    website,
    status: "pending",
  });
}

user.isVerified = false;
user.verificationStatus = "pending";

await user.save();

return res.status(201).json({
  message:
    "Verification request submitted successfully. Please wait for an admin to review your application.",
  status: "pending",
  isVerified: false,
  request: {
    _id: request._id,
    status: request.status,
    category: request.category,
    createdAt: request.createdAt,
  },
});

} catch (error) {
console.error(
"APPLY VERIFICATION ERROR:",
error
);

if (error.code === 11000) {
  return res.status(400).json({
    message:
      "You already have a verification request. Please wait for the current request to be reviewed.",
    status: "pending",
  });
}

return res.status(500).json({
  message:
    "Unable to submit verification request",
});

}
}


async function getVerificationStatus(req, res) {
try {
const user = await User.findById(
req.user._id
).select(
"name username avatar isVerified verificationStatus"
);


if (!user) {
  return res.status(404).json({
    message: "User not found",
  });
}

const request =
  await VerificationRequest.findOne({
    user: user._id,
  }).lean();

let status =
  user.verificationStatus || "none";

if (request) {
  status = request.status;
}

if (
  request &&
  request.status === "approved" &&
  !user.isVerified
) {
  user.isVerified = true;
  user.verificationStatus = "approved";

  await user.save();
}

if (
  request &&
  request.status === "pending" &&
  user.verificationStatus !== "pending"
) {
  user.isVerified = false;
  user.verificationStatus = "pending";

  await user.save();
}

if (
  request &&
  request.status === "rejected" &&
  user.verificationStatus !== "rejected"
) {
  user.isVerified = false;
  user.verificationStatus = "rejected";

  await user.save();
}

return res.json({
  isVerified: Boolean(user.isVerified),
  status,
  user: {
    name: user.name,
    username: user.username,
    avatar: user.avatar,
  },
  request: request || null,
});

} catch (error) {
console.error(
"GET VERIFICATION STATUS ERROR:",
error
);

return res.status(500).json({
  message:
    "Unable to load verification status",
});

}
}

async function getPendingVerifications(req, res) {
try {
if (!req.user.isAdmin) {
return res.status(403).json({
message: "Admin access required",
});
}

const requests =
  await VerificationRequest.find({
    status: "pending",
  })
    .populate(
      "user",
      "username fullName avatar isVerified verificationStatus"
    )
    .sort({
      createdAt: -1,
    });

return res.json({
  requests,
});

} catch (error) {
console.error(
"GET PENDING VERIFICATIONS ERROR:",
error
);

return res.status(500).json({
  message:
    "Unable to load verification requests",
});

}
}


async function approveVerification(req, res) {
try {
if (!req.user.isAdmin) {
return res.status(403).json({
message: "Admin access required",
});
}

const request =
  await VerificationRequest.findById(
    req.params.requestId
  );

if (!request) {
  return res.status(404).json({
    message:
      "Verification request not found",
  });
}

if (request.status !== "pending") {
  return res.status(400).json({
    message:
      `This verification request has already been ${request.status}.`,
    status: request.status,
  });
}

request.status = "approved";
request.reviewedBy = req.user._id;
request.reviewedAt = new Date();
request.rejectionReason = "";

await request.save();

await User.findByIdAndUpdate(
  request.user,
  {
    isVerified: true,
    verificationStatus: "approved",
  }
);

return res.json({
  message:
    "User verified successfully",
  isVerified: true,
  status: "approved",
});

} catch (error) {
console.error(
"APPROVE VERIFICATION ERROR:",
error
);

return res.status(500).json({
  message:
    "Unable to approve verification",
});

}
}

async function rejectVerification(req, res) {
try {
if (!req.user.isAdmin) {
return res.status(403).json({
message: "Admin access required",
});
}

const request =
  await VerificationRequest.findById(
    req.params.requestId
  );

if (!request) {
  return res.status(404).json({
    message:
      "Verification request not found",
  });
}

if (request.status !== "pending") {
  return res.status(400).json({
    message:
      `This verification request has already been ${request.status}.`,
    status: request.status,
  });
}

const reason =
  typeof req.body.reason === "string"
    ? req.body.reason.trim()
    : "";

request.status = "rejected";
request.reviewedBy = req.user._id;
request.reviewedAt = new Date();
request.rejectionReason = reason;

await request.save();

await User.findByIdAndUpdate(
  request.user,
  {
    isVerified: false,
    verificationStatus: "rejected",
  }
);

return res.json({
  message:
    "Verification request rejected",
  isVerified: false,
  status: "rejected",
});

} catch (error) {
console.error(
"REJECT VERIFICATION ERROR:",
error
);

return res.status(500).json({
  message:
    "Unable to reject verification",
});

}
}

module.exports = {
applyForVerification,
getVerificationStatus,
getPendingVerifications,
approveVerification,
rejectVerification,
};
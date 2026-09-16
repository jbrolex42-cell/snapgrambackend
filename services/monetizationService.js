const User = require("../models/User");
const MonetizationProfile = require(
  "../models/MonetizationProfile"
);

async function getOrCreateMonetizationProfile(
  userId
) {
  let profile =
    await MonetizationProfile.findOne({
      user: userId,
    });

  if (!profile) {
    profile =
      await MonetizationProfile.create({
        user: userId,
      });
  }

  return profile;
}

async function calculateEligibility(userId) {
  const user = await User.findById(userId).select(
    "isVerified verificationStatus followersCount followingCount isPrivate"
  );

  if (!user) {
    throw new Error("User not found");
  }

  const profile =
    await getOrCreateMonetizationProfile(userId);

  const requirements = [];

  const professionalPassed =
    profile.professionalAccount === true;

  requirements.push({
    id: "professional",
    title: "Professional account",
    description:
      "Your account must be configured as a professional account.",
    passed: professionalPassed,
  });

  const verifiedPassed =
    Boolean(user.isVerified) ||
    user.verificationStatus === "approved";

  requirements.push({
    id: "account",
    title: "Account in good standing",
    description:
      "Your account must comply with Snapgram policies.",
    passed:
      profile.policyStatus === "eligible",
  });

  requirements.push({
    id: "verification",
    title: "Identity verification",
    description:
      "Your account may need to complete verification for some monetization features.",
    passed: verifiedPassed,
  });

  const policyPassed =
    profile.policyStatus === "eligible";

  let status = "not_eligible";

  if (
    profile.policyStatus === "restricted"
  ) {
    status = "not_eligible";
  } else if (
    profile.policyStatus === "review"
  ) {
    status = "under_review";
  } else if (
    professionalPassed &&
    policyPassed
  ) {
    status = "eligible";
  } else {
    status = "not_eligible";
  }

  const features = [
    {
      id: "gifts",
      name: "Gifts",
      description:
        "Receive gifts from eligible viewers.",
      status:
        status === "eligible" &&
        profile.giftsEnabled
          ? "eligible"
          : "pending",
    },

    {
      id: "subscriptions",
      name: "Subscriptions",
      description:
        "Offer paid subscriptions to your audience.",
      status:
        status === "eligible" &&
        profile.subscriptionsEnabled
          ? "eligible"
          : "pending",
    },

    {
      id: "ads",
      name: "Ads",
      description:
        "Participate in eligible advertising programs.",
      status:
        status === "eligible" &&
        profile.adsEnabled
          ? "eligible"
          : "pending",
    },
  ];

  const passedRequirements =
    requirements.filter(
      (item) => item.passed
    ).length;

  return {
    status,

    message:
      status === "eligible"
        ? "Your account currently meets the requirements for available monetization features."
        : status === "under_review"
        ? "Your monetization access is currently under review."
        : "Your account does not currently meet all monetization requirements.",

    policyStatus:
      profile.policyStatus,

    policyMessage:
      profile.policyMessage || "",

    requirements,

    requirementProgress: {
      passed: passedRequirements,
      total: requirements.length,
    },

    features,
  };
}

module.exports = {
  getOrCreateMonetizationProfile,
  calculateEligibility,
};
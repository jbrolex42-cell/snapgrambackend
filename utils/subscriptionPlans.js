const SUBSCRIPTION_PLANS = {
  free: {
    id: "free",
    name: "Snapgram Free",
    shortName: "Free",
    price: 0,
    currency: "KES",
    interval: "monthly",

    features: [
      "Standard Snapgram account",
      "Create posts",
      "Create stories",
      "Create reels",
      "Direct messaging",
      "Basic profile",
      "Basic notifications",
    ],
  },

  plus: {
    id: "plus",
    name: "Snapgram Plus",
    shortName: "Plus",
    price: 1000,
    currency: "KES",
    interval: "monthly",

    features: [
      "Everything in Free",
      "Enhanced profile customization",
      "Additional creator tools",
      "Priority feature access",
      "Enhanced messaging features",
      "Premium profile badge styling",
    ],
  },

  pro: {
    id: "pro",
    name: "Snapgram Pro",
    shortName: "Pro",
    price: 1500,
    currency: "KES",
    interval: "monthly",

    features: [
      "Everything in Plus",
      "Verified account badge",
      "Advanced creator tools",
      "Advanced profile customization",
      "Advanced content tools",
      "Enhanced creator insights",
      "Priority support",
    ],
  },

  premium: {
    id: "premium",
    name: "Snapgram Premium",
    shortName: "Premium",
    price: 2000,
    currency: "KES",
    interval: "monthly",

    features: [
      "Everything in Pro",
      "Advanced professional tools",
      "Advanced analytics",
      "Premium creator features",
      "Enhanced monetization tools",
      "Premium account experience",
      "Priority access to new features",
      "Priority support",
    ],
  },
};

function getPlan(planId) {
  return (
    SUBSCRIPTION_PLANS[
      String(planId || "")
        .trim()
        .toLowerCase()
    ] || null
  );
}

function getPublicPlans() {
  return Object.values(SUBSCRIPTION_PLANS);
}

module.exports = {
  SUBSCRIPTION_PLANS,
  getPlan,
  getPublicPlans,
};
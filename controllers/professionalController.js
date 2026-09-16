const User = require("../models/User");
const Post = require("../models/Post");
const Earning = require("../models/Earning");
const MonetizationProfile = require("../models/MonetizationProfile");
const MonetizationSetup = require("../models/MonetizationSetup");

async function getProfessionalDashboard(
  req,
  res
) {
  try {
    const userId =
      req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const user =
      await User.findById(userId).select(
        "username fullName followersCount followingCount isVerified verificationStatus"
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const [
      posts,
      reels,
      earnings,
      monetizationProfile,
      monetizationSetup,
    ] = await Promise.all([
      Post.countDocuments({
        user: userId,
        postType: "post",
        isArchived: {
          $ne: true,
        },
      }),

      Post.countDocuments({
        user: userId,
        postType: "reel",
        isArchived: {
          $ne: true,
        },
      }),

      Earning.aggregate([
        {
          $match: {
            user: user._id,
          },
        },
        {
          $group: {
            _id: "$status",
            amount: {
              $sum: "$amount",
            },
          },
        },
      ]),

      MonetizationProfile.findOne({
        user: userId,
      }),

      MonetizationSetup.findOne({
        user: userId,
      }),
    ]);

    const profile =
      monetizationProfile ||
      (await MonetizationProfile.create({
        user: userId,
      }));

    const setup =
      monetizationSetup ||
      (await MonetizationSetup.create({
        user: userId,
      }));

    const totalEarnings =
      earnings.reduce(
        (sum, item) =>
          sum +
          ([
            "completed",
            "paid",
          ].includes(item._id)
            ? Number(item.amount || 0)
            : 0),
        0
      );

    const paidEarnings =
      earnings.reduce(
        (sum, item) =>
          sum +
          (item._id === "paid"
            ? Number(item.amount || 0)
            : 0),
        0
      );

    const pendingEarnings =
      earnings.reduce(
        (sum, item) =>
          sum +
          (item._id === "pending"
            ? Number(item.amount || 0)
            : 0),
        0
      );

    const availableEarnings =
      Math.max(
        0,
        totalEarnings -
          paidEarnings
      );

    const monetizationEligible =
      profile.professionalAccount ===
        true &&
      profile.policyStatus ===
        "eligible";

    const subscriptionEligible =
      monetizationEligible;

    return res.json({
      success: true,

      dashboard: {
        accountType:
          profile.professionalAccount
            ? "Professional"
            : "Personal",

        followers:
          user.followersCount || 0,

        following:
          user.followingCount || 0,

        posts,

        reels,

        reach: 0,

        impressions: 0,

        profileViews: 0,

        engagementRate: null,

        currency:
          setup.payoutCurrency ||
          "KES",

        earnings: {
          available:
            availableEarnings,

          total:
            totalEarnings,

          pending:
            pendingEarnings,

          paid:
            paidEarnings,
        },

        monetization: {
          enabled:
            Boolean(profile.enabled),

          eligible:
            monetizationEligible,

          setupComplete:
            Boolean(
              setup.setupComplete
            ),

          earnings: {
            available:
              availableEarnings,
          },

          currency:
            setup.payoutCurrency ||
            "KES",
        },

        subscriptions: {
          enabled:
            Boolean(
              profile.subscriptionsEnabled
            ),

          eligible:
            subscriptionEligible,
        },

        verification: {
          isVerified:
            Boolean(
              user.isVerified
            ),

          status:
            user.verificationStatus ||
            "none",
        },
      },
    });
  } catch (error) {
    console.error(
      "PROFESSIONAL DASHBOARD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load professional dashboard.",
    });
  }
}

module.exports = {
  getProfessionalDashboard,
};
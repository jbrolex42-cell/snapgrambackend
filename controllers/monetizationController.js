const User = require("../models/User");
const Earning = require("../models/Earning");
const PayoutMethod = require("../models/PayoutMethod");
const MonetizationProfile = require("../models/MonetizationProfile");
const MonetizationSetup = require("../models/MonetizationSetup");

const {
  calculateEligibility,
  getOrCreateMonetizationProfile,
} = require("../services/monetizationService");

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function getUserId(req) {
  return (
    req.user?._id?.toString() ||
    req.user?.id?.toString() ||
    req.userId?.toString() ||
    null
  );
}

function isBoolean(value) {
  return typeof value === "boolean";
}

async function getOrCreateSetup(userId) {
  let setup =
    await MonetizationSetup.findOne({
      user: userId,
    });

  if (!setup) {
    setup =
      await MonetizationSetup.create({
        user: userId,
      });
  }

  return setup;
}

async function getOrCreateProfile(userId) {
  return getOrCreateMonetizationProfile(
    userId
  );
}

// --------------------------------------------------
// GET MONETIZATION DASHBOARD
// GET /api/monetization
// --------------------------------------------------

async function getMonetizationDashboard(
  req,
  res
) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // User must be loaded before using user._id
    const user =
      await User.findById(userId).select(
        "isVerified verificationStatus"
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const [
      profile,
      setup,
      payoutMethod,
      earnings,
    ] = await Promise.all([
      MonetizationProfile.findOne({
        user: userId,
      }),

      MonetizationSetup.findOne({
        user: userId,
      }),

      PayoutMethod.findOne({
        user: userId,
      }).select(
        "type provider accountName last4 email country currency isVerified isDefault status"
      ),

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
    ]);

    const safeProfile =
      profile ||
      (await getOrCreateProfile(userId));

    const safeSetup =
      setup ||
      (await getOrCreateSetup(userId));

    // ------------------------------------------------
    // EARNINGS
    // ------------------------------------------------

    let completedEarnings = 0;
    let pendingEarnings = 0;
    let paidEarnings = 0;
    let failedEarnings = 0;
    let cancelledEarnings = 0;

    for (const item of earnings) {
      const amount =
        Number(item.amount) || 0;

      switch (item._id) {
        case "completed":
          completedEarnings += amount;
          break;

        case "pending":
          pendingEarnings += amount;
          break;

        case "paid":
          paidEarnings += amount;
          break;

        case "failed":
          failedEarnings += amount;
          break;

        case "cancelled":
          cancelledEarnings += amount;
          break;

        default:
          break;
      }
    }

    /*
     * IMPORTANT:
     *
     * This is only a display balance.
     * Actual payout availability should eventually
     * come from a proper accounting/ledger system.
     *
     * We never trust the mobile application
     * to calculate this value.
     */
    const availableEarnings = Math.max(
      0,
      completedEarnings - paidEarnings
    );

    // ------------------------------------------------
    // ELIGIBILITY
    // ------------------------------------------------

    const eligible =
      safeProfile.professionalAccount ===
        true &&
      safeProfile.policyStatus ===
        "eligible";

    let eligibility =
      "not_eligible";

    if (
      safeProfile.policyStatus ===
      "review"
    ) {
      eligibility = "pending";
    } else if (eligible) {
      eligibility = "eligible";
    }

    // ------------------------------------------------
    // SETUP
    // ------------------------------------------------

    const setupComplete =
      Boolean(
        safeSetup.setupComplete
      );

    const payoutSetupComplete =
      Boolean(payoutMethod);

    const currency =
      safeSetup.payoutCurrency ||
      payoutMethod?.currency ||
      "KES";

    // ------------------------------------------------
    // RESPONSE
    // ------------------------------------------------

    return res.json({
      success: true,

      monetization: {
        enabled: Boolean(
          safeProfile.enabled
        ),

        eligibility,

        setupComplete,

        currency,

        earnings: {
          available:
            availableEarnings,

          total:
            completedEarnings +
            paidEarnings,

          pending:
            pendingEarnings,

          paid:
            paidEarnings,

          failed:
            failedEarnings,

          cancelled:
            cancelledEarnings,
        },

        payouts: {
          setupComplete:
            payoutSetupComplete,

          currency:
            payoutMethod?.currency ||
            currency,

          method:
            payoutMethod || null,
        },

        gifts: {
          enabled:
            Boolean(
              safeProfile.giftsEnabled
            ),
        },

        subscriptions: {
          enabled:
            Boolean(
              safeProfile.subscriptionsEnabled
            ),
        },

        ads: {
          enabled:
            Boolean(
              safeProfile.adsEnabled
            ),
        },

        professionalAccount:
          Boolean(
            safeProfile.professionalAccount
          ),

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
      "GET MONETIZATION DASHBOARD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load monetization information.",
    });
  }
}

// --------------------------------------------------
// UPDATE MONETIZATION DASHBOARD
// PATCH /api/monetization
// --------------------------------------------------

async function updateMonetizationDashboard(
  req,
  res
) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const {
      enabled,
      giftsEnabled,
      subscriptionsEnabled,
      adsEnabled,
      professionalAccount,
    } = req.body || {};

    const fields = {
      enabled,
      giftsEnabled,
      subscriptionsEnabled,
      adsEnabled,
      professionalAccount,
    };

    // Validate all supplied values
    for (const [
      field,
      value,
    ] of Object.entries(fields)) {
      if (
        value !== undefined &&
        !isBoolean(value)
      ) {
        return res.status(400).json({
          success: false,
          message:
            `${field} must be a boolean.`,
        });
      }
    }

    const profile =
      await getOrCreateProfile(userId);

    if (enabled !== undefined) {
      profile.enabled = enabled;
    }

    if (giftsEnabled !== undefined) {
      profile.giftsEnabled =
        giftsEnabled;
    }

    if (
      subscriptionsEnabled !==
      undefined
    ) {
      profile.subscriptionsEnabled =
        subscriptionsEnabled;
    }

    if (adsEnabled !== undefined) {
      profile.adsEnabled =
        adsEnabled;
    }

    if (
      professionalAccount !==
      undefined
    ) {
      profile.professionalAccount =
        professionalAccount;
    }

    await profile.save();

    return res.json({
      success: true,

      message:
        "Monetization settings updated.",

      monetization: {
        enabled:
          Boolean(profile.enabled),

        giftsEnabled:
          Boolean(
            profile.giftsEnabled
          ),

        subscriptionsEnabled:
          Boolean(
            profile.subscriptionsEnabled
          ),

        adsEnabled:
          Boolean(
            profile.adsEnabled
          ),

        professionalAccount:
          Boolean(
            profile.professionalAccount
          ),
      },
    });
  } catch (error) {
    console.error(
      "UPDATE MONETIZATION DASHBOARD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update monetization settings.",
    });
  }
}

// --------------------------------------------------
// GET MONETIZATION ELIGIBILITY
// GET /api/monetization/eligibility
// --------------------------------------------------

async function getMonetizationEligibility(
  req,
  res
) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const eligibility =
      await calculateEligibility(
        userId
      );

    return res.json({
      success: true,
      eligibility,
    });
  } catch (error) {
    console.error(
      "GET MONETIZATION ELIGIBILITY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to determine monetization eligibility.",
    });
  }
}

// --------------------------------------------------
// GET MONETIZATION PROFILE
// GET /api/monetization/profile
// --------------------------------------------------

async function getMonetizationProfile(
  req,
  res
) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const profile =
      await getOrCreateProfile(userId);

    return res.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error(
      "GET MONETIZATION PROFILE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load monetization profile.",
    });
  }
}

// --------------------------------------------------
// UPDATE MONETIZATION PROFILE
// PATCH /api/monetization/profile
// --------------------------------------------------

async function updateMonetizationProfile(
  req,
  res
) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const profile =
      await getOrCreateProfile(userId);

    const allowedFields = [
      "professionalAccount",
      "giftsEnabled",
      "subscriptionsEnabled",
      "adsEnabled",
    ];

    for (const field of allowedFields) {
      if (
        req.body?.[field] !== undefined
      ) {
        if (
          !isBoolean(
            req.body[field]
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              `${field} must be a boolean.`,
          });
        }

        profile[field] =
          req.body[field];
      }
    }

    await profile.save();

    return res.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error(
      "UPDATE MONETIZATION PROFILE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update monetization profile.",
    });
  }
}

// --------------------------------------------------
// EXPORTS
// --------------------------------------------------

module.exports = {
  getMonetizationDashboard,
  updateMonetizationDashboard,

  getMonetizationEligibility,

  getMonetizationProfile,
  updateMonetizationProfile,
};
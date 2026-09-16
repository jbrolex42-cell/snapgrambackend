const MonetizationSetup = require("../models/MonetizationSetup");
const MonetizationProfile = require("../models/MonetizationProfile");
const PayoutMethod = require("../models/PayoutMethod");

function getUserId(req) {
  return (
    req.user?._id?.toString() ||
    req.user?.id?.toString() ||
    req.userId?.toString() ||
    null
  );
}

async function getOrCreateSetup(userId) {
  let setup = await MonetizationSetup.findOne({
    user: userId,
  });

  if (!setup) {
    setup = await MonetizationSetup.create({
      user: userId,
    });
  }

  return setup;
}

function calculateSetupProgress(setup) {
  const steps = [
    {
      id: "started",
      title: "Get started",
      complete: Boolean(setup.setupStarted),
    },
    {
      id: "payment",
      title: "Payment information",
      complete: Boolean(
        setup.paymentInformationComplete
      ),
    },
    {
      id: "tax",
      title: "Tax information",
      complete: Boolean(
        setup.taxInformationComplete
      ),
    },
    {
      id: "preferences",
      title: "Monetization preferences",
      complete: Boolean(
        setup.preferencesComplete
      ),
    },
  ];

  const completed = steps.filter(
    (step) => step.complete
  ).length;

  return {
    completed,
    total: steps.length,
    percentage: Math.round(
      (completed / steps.length) * 100
    ),
    steps,
  };
}

async function getMonetizationSetup(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const setup = await getOrCreateSetup(userId);

    const payoutMethod =
      await PayoutMethod.findOne({
        user: userId,
      }).select(
        "type provider accountName last4 email country currency isVerified isDefault status"
      );

    const progress =
      calculateSetupProgress(setup);

    return res.json({
      success: true,

      setup: {
        setupStarted: setup.setupStarted,
        setupComplete: setup.setupComplete,

        paymentInformationComplete:
          setup.paymentInformationComplete,

        taxInformationComplete:
          setup.taxInformationComplete,

        preferencesComplete:
          setup.preferencesComplete,

        payoutCurrency:
          setup.payoutCurrency,

        taxCountry:
          setup.taxCountry,

        taxStatus:
          setup.taxStatus,

        preferences:
          setup.preferences,

        payoutMethod,

        progress,
      },
    });
  } catch (error) {
    console.error(
      "GET MONETIZATION SETUP ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load monetization setup.",
    });
  }
}

async function updateMonetizationSetup(
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

    const setup =
      await getOrCreateSetup(userId);

    const {
      setupStarted,
      setupComplete,
      paymentInformationComplete,
      taxInformationComplete,
      preferencesComplete,
      taxCountry,
      taxStatus,
      payoutCurrency,
      preferences,
    } = req.body || {};

    if (
      setupStarted !== undefined
    ) {
      setup.setupStarted =
        Boolean(setupStarted);

      if (
        setup.setupStarted &&
        !setup.startedAt
      ) {
        setup.startedAt = new Date();
      }
    }

    if (
      paymentInformationComplete !==
      undefined
    ) {
      setup.paymentInformationComplete =
        Boolean(
          paymentInformationComplete
        );
    }

    if (
      taxInformationComplete !==
      undefined
    ) {
      setup.taxInformationComplete =
        Boolean(
          taxInformationComplete
        );

      if (
        setup.taxInformationComplete
      ) {
        setup.taxInformationSubmittedAt =
          new Date();

        setup.taxStatus = "complete";
      }
    }

    if (
      preferencesComplete !==
      undefined
    ) {
      setup.preferencesComplete =
        Boolean(
          preferencesComplete
        );
    }

    if (
      typeof taxCountry === "string"
    ) {
      setup.taxCountry =
        taxCountry
          .trim()
          .toUpperCase()
          .slice(0, 3) || null;
    }

    if (
      typeof payoutCurrency ===
      "string"
    ) {
      setup.payoutCurrency =
        payoutCurrency
          .trim()
          .toUpperCase()
          .slice(0, 10);
    }

    if (
      taxStatus !== undefined
    ) {
      const allowedTaxStatuses = [
        "not_started",
        "pending",
        "complete",
        "review",
        "rejected",
      ];

      if (
        !allowedTaxStatuses.includes(
          taxStatus
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid tax status.",
        });
      }

      setup.taxStatus = taxStatus;
    }

    if (
      preferences &&
      typeof preferences ===
        "object" &&
      !Array.isArray(preferences)
    ) {
      if (
        preferences.giftsEnabled !==
        undefined
      ) {
        setup.preferences.giftsEnabled =
          Boolean(
            preferences.giftsEnabled
          );
      }

      if (
        preferences.subscriptionsEnabled !==
        undefined
      ) {
        setup.preferences.subscriptionsEnabled =
          Boolean(
            preferences.subscriptionsEnabled
          );
      }

      if (
        preferences.adsEnabled !==
        undefined
      ) {
        setup.preferences.adsEnabled =
          Boolean(
            preferences.adsEnabled
          );
      }

      if (
        preferences.notificationsEnabled !==
        undefined
      ) {
        setup.preferences.notificationsEnabled =
          Boolean(
            preferences.notificationsEnabled
          );
      }
    }

    const allRequiredStepsComplete =
      setup.setupStarted &&
      setup.paymentInformationComplete &&
      setup.taxInformationComplete &&
      setup.preferencesComplete;

    setup.setupComplete =
      setupComplete !== undefined
        ? Boolean(setupComplete) &&
          allRequiredStepsComplete
        : allRequiredStepsComplete;

    if (setup.setupComplete) {
      setup.completedAt =
        setup.completedAt ||
        new Date();
    } else {
      setup.completedAt = null;
    }

    await setup.save();

    return res.json({
      success: true,
      message:
        "Monetization setup updated.",
      setup: {
        setupStarted:
          setup.setupStarted,

        setupComplete:
          setup.setupComplete,

        paymentInformationComplete:
          setup.paymentInformationComplete,

        taxInformationComplete:
          setup.taxInformationComplete,

        preferencesComplete:
          setup.preferencesComplete,

        taxCountry:
          setup.taxCountry,

        taxStatus:
          setup.taxStatus,

        payoutCurrency:
          setup.payoutCurrency,

        preferences:
          setup.preferences,

        progress:
          calculateSetupProgress(
            setup
          ),
      },
    });
  } catch (error) {
    console.error(
      "UPDATE MONETIZATION SETUP ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update monetization setup.",
    });
  }
}

async function completeMonetizationSetup(
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

    const setup =
      await getOrCreateSetup(userId);

    const progress =
      calculateSetupProgress(setup);

    if (
      progress.completed !==
      progress.total
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Complete all monetization setup steps before finishing setup.",
        progress,
      });
    }

    setup.setupComplete = true;
    setup.completedAt = new Date();

    await setup.save();

    return res.json({
      success: true,
      message:
        "Monetization setup completed.",
      setup: {
        setupComplete: true,
        progress:
          calculateSetupProgress(
            setup
          ),
      },
    });
  } catch (error) {
    console.error(
      "COMPLETE MONETIZATION SETUP ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to complete monetization setup.",
    });
  }
}

module.exports = {
  getMonetizationSetup,
  updateMonetizationSetup,
  completeMonetizationSetup,
};
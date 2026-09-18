const crypto = require("crypto");

const Payout = require("../models/Payout");
const PayoutMethod = require(
  "../models/PayoutMethod"
);
const Earning = require("../models/Earning");

function createReference() {
  return `PO-${Date.now()}-${crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

async function getPayoutSummary(req, res) {
  try {
    const userId = req.user._id;

    const [completed, pending, paid] =
      await Promise.all([
        Earning.aggregate([
          {
            $match: {
              user: userId,
              status: "completed",
            },
          },
          {
            $group: {
              _id: "$currency",
              amount: {
                $sum: "$amount",
              },
            },
          },
        ]),

        Earning.aggregate([
          {
            $match: {
              user: userId,
              status: "pending",
            },
          },
          {
            $group: {
              _id: "$currency",
              amount: {
                $sum: "$amount",
              },
            },
          },
        ]),

        Payout.aggregate([
          {
            $match: {
              user: userId,
              status: "paid",
            },
          },
          {
            $group: {
              _id: "$currency",
              amount: {
                $sum: "$amount",
              },
            },
          },
        ]),
      ]);

    const currency =
      completed[0]?._id ||
      pending[0]?._id ||
      paid[0]?._id ||
      "USD";

    return res.json({
      success: true,
      summary: {
        availableBalance:
          completed[0]?.amount || 0,

        pendingBalance:
          pending[0]?.amount || 0,

        totalPaid:
          paid[0]?.amount || 0,

        currency,
      },
    });
  } catch (error) {
    console.error(
      "GET PAYOUT SUMMARY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load payout summary.",
    });
  }
}

async function getPayoutMethod(req, res) {
  try {
    const method =
      await PayoutMethod.findOne({
        user: req.user._id,
      }).lean();

    return res.json({
      success: true,
      method: method || null,
    });
  } catch (error) {
    console.error(
      "GET PAYOUT METHOD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load payout method.",
    });
  }
}

async function createPayoutMethod(req, res) {
  try {
    const userId = req.user._id;

    const {
      type,
      provider,
      accountName,
      last4,
      email,
      country,
      currency,
      providerAccountId,
    } = req.body;

    const allowedTypes = [
      "bank_account",
      "mobile_money",
      "paypal",
      "other",
    ];

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payout method type.",
      });
    }

    const method =
      await PayoutMethod.findOneAndUpdate(
        { user: userId },
        {
          user: userId,
          type,
          provider:
            provider || "",
          accountName:
            accountName || "",
          last4:
            last4
              ? String(last4).slice(-4)
              : null,
          email:
            email || null,
          country:
            country || null,
          currency:
            currency || "USD",
          providerAccountId:
            providerAccountId || null,
          isVerified: false,
          isDefault: true,
          status: "pending",
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
        }
      );

    return res.status(201).json({
      success: true,
      method,
    });
  } catch (error) {
    console.error(
      "CREATE PAYOUT METHOD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to save payout method.",
    });
  }
}

async function updatePayoutMethod(
  req,
  res
) {
  try {
    const userId = req.user._id;

    const allowed = [
      "type",
      "provider",
      "accountName",
      "last4",
      "email",
      "country",
      "currency",
      "providerAccountId",
    ];

    const update = {};

    for (const field of allowed) {
      if (
        req.body[field] !== undefined
      ) {
        update[field] =
          req.body[field];
      }
    }

    if (update.last4) {
      update.last4 = String(
        update.last4
      ).slice(-4);
    }

    update.isVerified = false;
    update.status = "pending";

    const method =
      await PayoutMethod.findOneAndUpdate(
        { user: userId },
        { $set: update },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!method) {
      return res.status(404).json({
        success: false,
        message:
          "Payout method not found.",
      });
    }

    return res.json({
      success: true,
      method,
    });
  } catch (error) {
    console.error(
      "UPDATE PAYOUT METHOD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update payout method.",
    });
  }
}

async function deletePayoutMethod(
  req,
  res
) {
  try {
    await PayoutMethod.deleteOne({
      user: req.user._id,
    });

    return res.json({
      success: true,
      message:
        "Payout method removed.",
    });
  } catch (error) {
    console.error(
      "DELETE PAYOUT METHOD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to remove payout method.",
    });
  }
}

async function getPayoutHistory(
  req,
  res
) {
  try {
    const userId = req.user._id;

    const page = Math.max(
      Number(req.query.page) || 1,
      1
    );

    const limit = Math.min(
      Math.max(
        Number(req.query.limit) || 20,
        1
      ),
      100
    );

    const skip = (page - 1) * limit;

    const filter = {
      user: userId,
    };

    const [history, total] =
      await Promise.all([
        Payout.find(filter)
          .populate(
            "payoutMethod",
            "type provider accountName last4"
          )
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean(),

        Payout.countDocuments(filter),
      ]);

    return res.json({
      success: true,
      history,
      page,
      limit,
      total,
      hasMore:
        skip + history.length < total,
    });
  } catch (error) {
    console.error(
      "GET PAYOUT HISTORY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load payout history.",
    });
  }
}

async function getPayoutStatus(req, res) {
  try {
    const payout =
      await Payout.findOne({
        user: req.user._id,
      })
        .sort({
          createdAt: -1,
        })
        .populate(
          "payoutMethod",
          "type provider last4"
        )
        .lean();

    if (!payout) {
      return res.json({
        success: true,
        status: {
          status: "none",
          message:
            "You have not requested a payout yet.",
        },
      });
    }

    return res.json({
      success: true,
      status: {
        id: payout._id,
        status: payout.status,
        message:
          payout.failureReason ||
          `Payout ${payout.status}.`,
        amount: payout.amount,
        currency: payout.currency,
        reference: payout.reference,
        createdAt: payout.createdAt,
        updatedAt: payout.updatedAt,
        paidAt: payout.paidAt,
      },
    });
  } catch (error) {
    console.error(
      "GET PAYOUT STATUS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load payout status.",
    });
  }
}

async function requestPayout(req, res) {
  try {
    const userId = req.user._id;

    const amount = Number(
      req.body.amount
    );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A valid payout amount is required.",
      });
    }

    const method =
      await PayoutMethod.findOne({
        user: userId,
        isDefault: true,
      });

    if (!method) {
      return res.status(400).json({
        success: false,
        message:
          "Add a payout method first.",
      });
    }

    const currency =
      method.currency || "USD";

    const available =
      await Earning.aggregate([
        {
          $match: {
            user: userId,
            status: "completed",
            currency,
          },
        },
        {
          $group: {
            _id: null,
            amount: {
              $sum: "$amount",
            },
          },
        },
      ]);

    const availableAmount =
      available[0]?.amount || 0;

    if (amount > availableAmount) {
      return res.status(400).json({
        success: false,
        message:
          "Requested payout exceeds your available balance.",
      });
    }

    const payout =
      await Payout.create({
        user: userId,
        payoutMethod: method._id,
        amount,
        currency,
        status: "pending",
        reference:
          createReference(),
      });

    return res.status(201).json({
      success: true,
      payout,
    });
  } catch (error) {
    console.error(
      "REQUEST PAYOUT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to request payout.",
    });
  }
}

module.exports = {
  getPayoutSummary,
  getPayoutMethod,
  createPayoutMethod,
  updatePayoutMethod,
  deletePayoutMethod,
  getPayoutHistory,
  getPayoutStatus,
  requestPayout,
};
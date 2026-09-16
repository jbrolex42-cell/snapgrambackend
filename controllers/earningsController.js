const Earning = require("../models/Earning");

async function getEarningsSummary(
  req,
  res
) {
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

        Earning.aggregate([
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
        totalEarnings:
          completed[0]?.amount || 0,

        availableBalance:
          completed[0]?.amount || 0,

        pendingEarnings:
          pending[0]?.amount || 0,

        totalPaid:
          paid[0]?.amount || 0,

        currency,
      },
    });
  } catch (error) {
    console.error(
      "GET EARNINGS SUMMARY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load earnings summary.",
    });
  }
}

async function getEarningsHistory(
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
        Earning.find(filter)
          .populate(
            "gift",
            "giftName coins"
          )
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean(),

        Earning.countDocuments(filter),
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
      "GET EARNINGS HISTORY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load earnings history.",
    });
  }
}

async function getEarningsActivity(
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

    const [activity, total] =
      await Promise.all([
        Earning.find({
          user: userId,
        })
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean(),

        Earning.countDocuments({
          user: userId,
        }),
      ]);

    return res.json({
      success: true,
      activity,
      page,
      limit,
      total,
      hasMore:
        skip + activity.length < total,
    });
  } catch (error) {
    console.error(
      "GET EARNINGS ACTIVITY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load earnings activity.",
    });
  }
}

module.exports = {
  getEarningsSummary,
  getEarningsHistory,
  getEarningsActivity,
};
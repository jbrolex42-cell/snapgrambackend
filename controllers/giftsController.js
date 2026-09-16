const Gift = require("../models/Gift");
const Earning = require("../models/Earning");
const MonetizationProfile = require(
  "../models/MonetizationProfile"
);

async function getGiftSettings(req, res) {
  try {
    const userId = req.user._id;

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

    return res.json({
      success: true,
      settings: {
        enabled: profile.enabled,
        allowGifts: profile.giftsEnabled,
        showGiftButton: profile.giftsEnabled,
      },
    });
  } catch (error) {
    console.error(
      "GET GIFT SETTINGS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load gift settings.",
    });
  }
}

async function updateGiftSettings(req, res) {
  try {
    const userId = req.user._id;

    const {
      enabled,
      allowGifts,
      showGiftButton,
    } = req.body;

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

    if (typeof enabled === "boolean") {
      profile.enabled = enabled;
    }

    if (typeof allowGifts === "boolean") {
      profile.giftsEnabled = allowGifts;
    }

    if (typeof showGiftButton === "boolean") {
      profile.giftsEnabled =
        showGiftButton;
    }

    await profile.save();

    return res.json({
      success: true,
      settings: {
        enabled: profile.enabled,
        allowGifts: profile.giftsEnabled,
        showGiftButton:
          profile.giftsEnabled,
      },
    });
  } catch (error) {
    console.error(
      "UPDATE GIFT SETTINGS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update gift settings.",
    });
  }
}

async function getGiftSummary(req, res) {
  try {
    const userId = req.user._id;

    const [giftTotals, earningTotals] =
      await Promise.all([
        Gift.aggregate([
          {
            $match: {
              recipient: userId,
              status: "completed",
            },
          },
          {
            $group: {
              _id: null,
              totalReceived: {
                $sum: 1,
              },
              totalCoins: {
                $sum: "$coins",
              },
            },
          },
        ]),

        Earning.aggregate([
          {
            $match: {
              user: userId,
              source: "gift",
              status: {
                $in: [
                  "pending",
                  "completed",
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              total: {
                $sum: "$amount",
              },
            },
          },
        ]),
      ]);

    const gifts =
      giftTotals[0] || {};

    const earnings =
      earningTotals[0] || {};

    return res.json({
      success: true,
      summary: {
        totalReceived:
          gifts.totalReceived || 0,

        totalCoins:
          gifts.totalCoins || 0,

        availableBalance:
          earnings.total || 0,
      },
    });
  } catch (error) {
    console.error(
      "GET GIFT SUMMARY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load gift summary.",
    });
  }
}

async function getGiftActivity(req, res) {
  try {
    const userId = req.user._id;

    const page = Math.max(
      Number(req.query.page) || 1,
      1
    );

    const limit = Math.min(
      Math.max(
        Number(req.query.limit) || 30,
        1
      ),
      100
    );

    const skip = (page - 1) * limit;

    const filter = {
      recipient: userId,
    };

    const [activity, total] =
      await Promise.all([
        Gift.find(filter)
          .populate(
            "sender",
            "username fullName avatar"
          )
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean(),

        Gift.countDocuments(filter),
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
      "GET GIFT ACTIVITY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load gift activity.",
    });
  }
}

async function sendGift(req, res) {
  try {
    const senderId = req.user._id;

    const {
      recipientId,
      giftType,
      giftName,
      coins,
      postId,
      reelId,
      message,
    } = req.body;

    if (!recipientId) {
      return res.status(400).json({
        success: false,
        message: "Recipient is required.",
      });
    }

    if (
      String(senderId) ===
      String(recipientId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot send a gift to yourself.",
      });
    }

    const coinAmount = Number(coins);

    if (
      !Number.isFinite(coinAmount) ||
      coinAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid gift amount.",
      });
    }

    const gift = await Gift.create({
      sender: senderId,
      recipient: recipientId,
      giftType:
        giftType || "default",
      giftName:
        giftName || "Gift",
      coins: coinAmount,
      post: postId || null,
      reel: reelId || null,
      message: message || "",
      status: "completed",
    });

    /*
     * This is the accounting record.
     *
     * The actual coin-to-currency conversion
     * should be configured by your payment
     * business rules rather than hard-coded
     * in the client.
     */
    const amount =
      Number(req.body.earningAmount) || 0;

    if (amount > 0) {
      await Earning.create({
        user: recipientId,
        source: "gift",
        amount,
        currency:
          req.body.currency || "USD",
        status: "completed",
        gift: gift._id,
        post: postId || null,
        reel: reelId || null,
        description:
          `Gift received: ${giftName || "Gift"}`,
      });
    }

    return res.status(201).json({
      success: true,
      gift,
    });
  } catch (error) {
    console.error(
      "SEND GIFT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to send gift.",
    });
  }
}

module.exports = {
  getGiftSettings,
  updateGiftSettings,
  getGiftSummary,
  getGiftActivity,
  sendGift,
};
const mongoose = require("mongoose");

const Subscription = require("../models/Subscription");
const PaymentTransaction = require("../models/PaymentTransaction");

const {
  getPlan,
  getPublicPlans,
} = require("../utils/subscriptionPlans");

const {
  initiateStkPush,
  normalizePhoneNumber,
} = require("../config/mpesa");


// ============================================================
// HELPERS
// ============================================================

function getUserId(req) {
  return (
    req.user?._id ||
    req.user?.id ||
    req.user?.userId ||
    req.auth?.userId ||
    null
  );
}


function addOneMonth(date = new Date()) {
  const result = new Date(date);

  result.setMonth(result.getMonth() + 1);

  return result;
}


function serializeSubscription(subscription) {
  if (!subscription) {
    return null;
  }

  return {
    id: subscription._id,
    user: subscription.user,
    plan: subscription.plan,
    status: subscription.status,
    autoRenew: Boolean(subscription.autoRenew),
    startedAt: subscription.startedAt,
    expiresAt: subscription.expiresAt,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}


function serializePayment(payment) {
  if (!payment) {
    return null;
  }

  return {
    id: payment._id,
    subscription: payment.subscription,
    plan: payment.plan,
    amount: payment.amount,
    currency: payment.currency,
    phoneNumber: payment.phoneNumber,
    provider: payment.provider,
    status: payment.status,
    merchantRequestId: payment.merchantRequestId || null,
    checkoutRequestId: payment.checkoutRequestId || null,
    mpesaReceiptNumber:
      payment.mpesaReceiptNumber || null,
    resultCode:
      payment.resultCode !== undefined
        ? payment.resultCode
        : null,
    resultDescription:
      payment.resultDescription || null,
    paidAt: payment.paidAt || null,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

async function ensureSubscription(userId) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  let subscription =
    await Subscription.findOne({
      user: userId,
    });

  if (!subscription) {
    subscription =
      await Subscription.create({
        user: userId,
        plan: "free",
        status: "active",
        autoRenew: false,
        startedAt: new Date(),
        expiresAt: null,
      });

    return subscription;
  }

  const now = new Date();

  const isPaidPlan =
    subscription.plan &&
    subscription.plan !== "free";

  const hasExpired =
    subscription.expiresAt &&
    new Date(subscription.expiresAt) <= now;

  if (isPaidPlan && hasExpired) {
    subscription.plan = "free";
    subscription.status = "active";
    subscription.autoRenew = false;
    subscription.startedAt = now;
    subscription.expiresAt = null;

    await subscription.save();
  }

  return subscription;
}

async function getPlans(req, res) {
  try {
    const plans = getPublicPlans();

    return res.status(200).json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error(
      "GET SUBSCRIPTION PLANS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load subscription plans.",
    });
  }
}

async function getStatus(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const subscription =
      await ensureSubscription(userId);

    return res.status(200).json({
      success: true,
      subscription:
        serializeSubscription(subscription),
    });
  } catch (error) {
    console.error(
      "GET SUBSCRIPTION STATUS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load subscription status.",
    });
  }
}

async function createCheckout(req, res) {
  let payment = null;

  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const {
      planId,
      phoneNumber,
    } = req.body || {};

    const plan = getPlan(planId);

    if (!plan) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid subscription plan. Choose Free, Plus, Pro, or Premium.",
      });
    }

    // Free does not require M-PESA checkout.
    if (plan.id === "free") {
      return res.status(400).json({
        success: false,
        message:
          "The Free plan does not require payment.",
      });
    }

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message:
          "M-PESA phone number is required.",
      });
    }

    let phone;

    try {
      phone =
        normalizePhoneNumber(phoneNumber);
    } catch (phoneError) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a valid phone number.",
      });
    }

    if (!phone) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a valid phone number.",
      });
    }

    const subscription =
      await ensureSubscription(userId);

    const currentPlan =
      String(subscription.plan || "free")
        .trim()
        .toLowerCase();

    const subscriptionIsActive =
      subscription.status === "active" ||
      subscription.status === "cancelled";

    const hasValidExpiry =
      subscription.expiresAt &&
      new Date(subscription.expiresAt) > new Date();

    if (
      currentPlan === plan.id &&
      subscriptionIsActive &&
      hasValidExpiry
    ) {
      return res.status(400).json({
        success: false,
        message:
          `You already have an active ${plan.shortName} subscription.`,
        subscription:
          serializeSubscription(subscription),
      });
    }

    const pendingCutoff =
      new Date(Date.now() - 10 * 60 * 1000);

    const pendingPayment =
      await PaymentTransaction.findOne({
        user: userId,
        status: "pending",
        createdAt: {
          $gte: pendingCutoff,
        },
      }).sort({
        createdAt: -1,
      });

    if (pendingPayment) {
      return res.status(409).json({
        success: false,
        message:
          "You already have a pending M-PESA payment. Please complete it before starting another checkout.",
        payment:
          serializePayment(pendingPayment),
      });
    }

    payment =
      await PaymentTransaction.create({
        user: userId,
        subscription: subscription._id,
        plan: plan.id,
        amount: plan.price,
        currency: plan.currency,
        phoneNumber: phone,
        provider: "mpesa",
        status: "pending",
      });

    let stk;

    try {
      stk = await initiateStkPush({
        phoneNumber: phone,
        amount: plan.price,
        accountReference: `SNAPGRAM-${payment._id}`,
        transactionDesc:
          `Snapgram ${plan.shortName} subscription`,
      });
    } catch (stkError) {
      console.error(
        "M-PESA STK PUSH ERROR:",
        stkError
      );

      payment.status = "failed";
      payment.resultDescription =
        stkError?.message ||
        "Failed to initiate M-PESA payment.";

      await payment.save();

      return res.status(502).json({
        success: false,
        message:
          "We could not initiate the M-PESA payment. Please try again.",
        payment:
          serializePayment(payment),
      });
    }

    if (stk?.MerchantRequestID) {
      payment.merchantRequestId =
        String(stk.MerchantRequestID);
    }

    if (stk?.CheckoutRequestID) {
      payment.checkoutRequestId =
        String(stk.CheckoutRequestID);
    }

    if (stk?.ResponseCode !== undefined) {
      payment.resultCode =
        Number(stk.ResponseCode);
    }

    if (stk?.ResponseDescription) {
      payment.resultDescription =
        String(stk.ResponseDescription);
    }

    await payment.save();

    if (!stk?.CheckoutRequestID) {
      payment.status = "failed";

      payment.resultDescription =
        stk?.ResponseDescription ||
        "M-PESA did not return a CheckoutRequestID.";

      await payment.save();

      return res.status(502).json({
        success: false,
        message:
          "M-PESA checkout could not be started. Please try again.",
        payment:
          serializePayment(payment),
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "M-PESA payment request sent. Please check your phone and enter your M-PESA PIN.",
      payment:
        serializePayment(payment),
      stk: {
        merchantRequestId:
          stk.MerchantRequestID || null,
        checkoutRequestId:
          stk.CheckoutRequestID || null,
        responseCode:
          stk.ResponseCode !== undefined
            ? stk.ResponseCode
            : null,
        responseDescription:
          stk.ResponseDescription || null,
        customerMessage:
          stk.CustomerMessage || null,
      },
    });
  } catch (error) {
    console.error(
      "CREATE SUBSCRIPTION CHECKOUT ERROR:",
      error
    );

    if (
      payment &&
      payment.status === "pending"
    ) {
      try {
        payment.status = "failed";

        payment.resultDescription =
          error?.message ||
          "Subscription checkout failed.";

        await payment.save();
      } catch (saveError) {
        console.error(
          "FAILED TO UPDATE PAYMENT AFTER CHECKOUT ERROR:",
          saveError
        );
      }
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to start subscription checkout.",
    });
  }
}

async function getPaymentStatus(req, res) {
  try {
    const userId = getUserId(req);
    const { paymentId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (
      !paymentId ||
      !mongoose.Types.ObjectId.isValid(
        paymentId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID.",
      });
    }

    const payment =
      await PaymentTransaction.findOne({
        _id: paymentId,
        user: userId,
      });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found.",
      });
    }

    const subscription =
      await ensureSubscription(userId);

    return res.status(200).json({
      success: true,
      payment:
        serializePayment(payment),
      subscription:
        serializeSubscription(subscription),
    });
  } catch (error) {
    console.error(
      "GET PAYMENT STATUS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load payment status.",
    });
  }
}

async function getHistory(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const payments =
      await PaymentTransaction.find({
        user: userId,
      })
        .sort({
          createdAt: -1,
        })
        .limit(100);

    return res.status(200).json({
      success: true,
      payments: payments.map(
        serializePayment
      ),
    });
  } catch (error) {
    console.error(
      "GET SUBSCRIPTION HISTORY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load payment history.",
    });
  }
}

async function cancelSubscription(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const subscription =
      await ensureSubscription(userId);

    if (
      !subscription.plan ||
      subscription.plan === "free"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You do not have a paid subscription to cancel.",
        subscription:
          serializeSubscription(subscription),
      });
    }

    if (
      subscription.expiresAt &&
      new Date(subscription.expiresAt) <=
        new Date()
    ) {
      subscription.plan = "free";
      subscription.status = "active";
      subscription.autoRenew = false;
      subscription.expiresAt = null;
      subscription.startedAt =
        new Date();

      await subscription.save();

      return res.status(200).json({
        success: true,
        message:
          "Your subscription has already expired and your account is now on the Free plan.",
        subscription:
          serializeSubscription(subscription),
      });
    }

    subscription.status = "cancelled";
    subscription.autoRenew = false;

    await subscription.save();

    return res.status(200).json({
      success: true,
      message:
        "Your subscription has been cancelled. You will keep access until the current billing period ends.",
      subscription:
        serializeSubscription(subscription),
    });
  } catch (error) {
    console.error(
      "CANCEL SUBSCRIPTION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to cancel subscription.",
    });
  }
}

async function mpesaCallback(req, res) {
  try {
    console.log(
      "M-PESA CALLBACK RECEIVED:",
      JSON.stringify(req.body, null, 2)
    );

    const stkCallback =
      req.body?.Body?.stkCallback;

    if (!stkCallback) {
      console.warn(
        "M-PESA CALLBACK: Missing stkCallback"
      );

      // Always acknowledge Safaricom.
      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: "Accepted",
      });
    }

    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata,
    } = stkCallback;

    let payment = null;

    if (CheckoutRequestID) {
      payment =
        await PaymentTransaction.findOne({
          checkoutRequestId:
            String(CheckoutRequestID),
        });
    }

    if (
      !payment &&
      MerchantRequestID
    ) {
      payment =
        await PaymentTransaction.findOne({
          merchantRequestId:
            String(MerchantRequestID),
        });
    }

    if (!payment) {
      console.warn(
        "M-PESA CALLBACK: Payment not found",
        {
          MerchantRequestID,
          CheckoutRequestID,
        }
      );

      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: "Accepted",
      });
    }

    if (payment.status === "completed") {
      console.log(
        `M-PESA CALLBACK: Payment ${payment._id} already completed.`
      );

      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: "Accepted",
      });
    }

    if (
      MerchantRequestID &&
      !payment.merchantRequestId
    ) {
      payment.merchantRequestId =
        String(MerchantRequestID);
    }

    if (
      CheckoutRequestID &&
      !payment.checkoutRequestId
    ) {
      payment.checkoutRequestId =
        String(CheckoutRequestID);
    }

    payment.resultCode =
      Number(ResultCode);

    payment.resultDescription =
      ResultDesc || null;

    if (Number(ResultCode) !== 0) {
      payment.status = "failed";

      await payment.save();

      console.log(
        `M-PESA PAYMENT FAILED: ${payment._id}`,
        {
          resultCode: ResultCode,
          resultDescription: ResultDesc,
        }
      );

      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: "Accepted",
      });
    }

    const metadataItems =
      CallbackMetadata?.Item || [];

    const metadata = {};

    for (const item of metadataItems) {
      if (
        item?.Name &&
        item.Value !== undefined &&
        item.Value !== null
      ) {
        metadata[item.Name] =
          item.Value;
      }
    }

    const amount =
      Number(metadata.Amount);

    const receipt =
      metadata.MpesaReceiptNumber
        ? String(
            metadata.MpesaReceiptNumber
          )
        : null;

    const transactionDate =
      metadata.TransactionDate
        ? String(
            metadata.TransactionDate
          )
        : null;

    const callbackPhone =
      metadata.PhoneNumber
        ? String(
            metadata.PhoneNumber
          )
        : null;

    if (
      !Number.isFinite(amount) ||
      amount !== Number(payment.amount)
    ) {
      payment.status = "failed";

      payment.resultDescription =
        `M-PESA amount mismatch. Expected ${payment.amount}, received ${amount}.`;

      await payment.save();

      console.error(
        "M-PESA PAYMENT AMOUNT MISMATCH:",
        {
          paymentId: payment._id,
          expected: payment.amount,
          received: amount,
        }
      );

      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: "Accepted",
      });
    }

    if (receipt) {
      payment.mpesaReceiptNumber =
        receipt;
    }

    if (transactionDate) {
      try {
        const year =
          transactionDate.substring(0, 4);

        const month =
          transactionDate.substring(4, 6);

        const day =
          transactionDate.substring(6, 8);

        const hour =
          transactionDate.substring(8, 10);

        const minute =
          transactionDate.substring(10, 12);

        const second =
          transactionDate.substring(12, 14);

        const parsedDate =
          new Date(
            `${year}-${month}-${day}T${hour}:${minute}:${second}`
          );

        if (
          !Number.isNaN(
            parsedDate.getTime()
          )
        ) {
          payment.paidAt = parsedDate;
        }
      } catch (dateError) {
        console.warn(
          "Could not parse M-PESA transaction date:",
          dateError
        );
      }
    }

    if (!payment.paidAt) {
      payment.paidAt = new Date();
    }

    const plan =
      getPlan(payment.plan);

    if (!plan) {
      payment.status = "failed";

      payment.resultDescription =
        `Invalid payment plan: ${payment.plan}`;

      await payment.save();

      console.error(
        "M-PESA CALLBACK INVALID PLAN:",
        payment.plan
      );

      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: "Accepted",
      });
    }

    if (
      Number(payment.amount) !==
      Number(plan.price)
    ) {
      payment.status = "failed";

      payment.resultDescription =
        `Payment amount does not match plan price. Plan: ${plan.id}, expected: ${plan.price}, received: ${payment.amount}.`;

      await payment.save();

      console.error(
        "M-PESA PLAN PRICE MISMATCH:",
        {
          plan: plan.id,
          expected: plan.price,
          received: payment.amount,
        }
      );

      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: "Accepted",
      });
    }

    payment.status = "completed";

    await payment.save();

    const subscription =
      await Subscription.findOne({
        user: payment.user,
      });

    if (!subscription) {
      console.error(
        `M-PESA CALLBACK: Subscription not found for user ${payment.user}`
      );

      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: "Accepted",
      });
    }

    const now = new Date();

    let subscriptionStart =
      now;

    if (
      subscription.expiresAt &&
      new Date(subscription.expiresAt) >
        now &&
      subscription.plan !== "free"
    ) {
      subscriptionStart =
        new Date(
          subscription.expiresAt
        );
    }

    const subscriptionExpiry =
      addOneMonth(subscriptionStart);

    subscription.plan =
      plan.id;

    subscription.status =
      "active";

    subscription.autoRenew =
      true;

    subscription.startedAt =
      subscriptionStart;

    subscription.expiresAt =
      subscriptionExpiry;

    await subscription.save();

    console.log(
      "M-PESA SUBSCRIPTION ACTIVATED:",
      {
        userId: payment.user,
        plan: plan.id,
        amount: payment.amount,
        receipt,
        expiresAt:
          subscription.expiresAt,
      }
    );

    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: "Accepted",
    });
  } catch (error) {
    console.error(
      "M-PESA CALLBACK ERROR:",
      error
    );

    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: "Accepted",
    });
  }
}

module.exports = {
  getPlans,
  getStatus,
  createCheckout,
  getPaymentStatus,
  getHistory,
  cancelSubscription,
  mpesaCallback,
};
const mongoose = require("mongoose");

const Device = require("../models/Device");
const PreKey = require("../models/PreKey");

function getUserId(req) {
  return (
    req.user?._id?.toString() ||
    req.user?.id?.toString() ||
    req.userId?.toString() ||
    null
  );
}

function normalizeBase64(value) {
  if (!value) {
    throw new Error("Missing key data");
  }

  return String(value).trim();
}

async function registerDevice(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const {
      deviceId,
      registrationId,
      identityKey,
      signedPreKey,
      preKeys,
    } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        message: "deviceId is required",
      });
    }

    if (!registrationId) {
      return res.status(400).json({
        message: "registrationId is required",
      });
    }

    if (!identityKey) {
      return res.status(400).json({
        message: "identityKey is required",
      });
    }

    if (
      !signedPreKey ||
      signedPreKey.keyId === undefined ||
      !signedPreKey.publicKey ||
      !signedPreKey.signature
    ) {
      return res.status(400).json({
        message: "Invalid signed pre-key",
      });
    }

    if (!Array.isArray(preKeys)) {
      return res.status(400).json({
        message: "preKeys must be an array",
      });
    }

    const session = await mongoose.startSession();

    try {
      let result;

      await session.withTransaction(async () => {
        const device = await Device.findOneAndUpdate(
          {
            user: userId,
            deviceId,
          },
          {
            $set: {
              registrationId,
              identityKey: normalizeBase64(identityKey),
              signedPreKey: {
                keyId: signedPreKey.keyId,
                publicKey: normalizeBase64(
                  signedPreKey.publicKey
                ),
                signature: normalizeBase64(
                  signedPreKey.signature
                ),
                createdAt: new Date(),
              },
              isActive: true,
              lastSeenAt: new Date(),
            },
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
            session,
          }
        );

        await PreKey.deleteMany(
          {
            device: device._id,
          },
          {
            session,
          }
        );

        if (preKeys.length > 0) {
          const documents = preKeys.map((key) => ({
            device: device._id,
            keyId: key.keyId,
            publicKey: normalizeBase64(
              key.publicKey
            ),
          }));

          await PreKey.insertMany(
            documents,
            {
              session,
              ordered: true,
            }
          );
        }

        result = device;
      });

      return res.status(200).json({
        success: true,
        device: {
          id: result._id,
          deviceId: result.deviceId,
          registrationId: result.registrationId,
        },
      });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error(
      "REGISTER DEVICE ERROR:",
      error
    );

    return res.status(500).json({
      message: "Unable to register device",
    });
  }
}

async function getUserDevices(req, res) {
  try {
    const userId = getUserId(req);
    const targetUserId = req.params.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        targetUserId
      )
    ) {
      return res.status(400).json({
        message: "Invalid user id",
      });
    }

    const devices = await Device.find({
      user: targetUserId,
      isActive: true,
    })
      .select(
        "deviceId registrationId identityKey signedPreKey"
      )
      .lean();

    return res.json({
      success: true,
      devices,
    });
  } catch (error) {
    console.error(
      "GET DEVICES ERROR:",
      error
    );

    return res.status(500).json({
      message: "Unable to load devices",
    });
  }
}

async function getDevicePreKeyBundle(req, res) {
  try {
    const targetUserId = req.params.userId;
    const requestedDeviceId = req.query.deviceId
      ? Number(req.query.deviceId)
      : null;

    const deviceQuery = {
      user: targetUserId,
      isActive: true,
    };

    if (requestedDeviceId) {
      deviceQuery.deviceId =
        requestedDeviceId;
    }

    const device = await Device.findOne(
      deviceQuery
    )
      .select(
        "deviceId registrationId identityKey signedPreKey"
      )
      .lean();

    if (!device) {
      return res.status(404).json({
        message: "Device not found",
      });
    }

    const preKey =
      await PreKey.findOneAndUpdate(
        {
          device: device._id,
          consumed: false,
        },
        {
          $set: {
            consumed: true,
            consumedAt: new Date(),
          },
        },
        {
          sort: {
            createdAt: 1,
          },
          new: true,
        }
      ).lean();

    return res.json({
      success: true,

      bundle: {
        registrationId:
          device.registrationId,

        deviceId: device.deviceId,

        identityKey:
          device.identityKey,

        signedPreKey: {
          keyId:
            device.signedPreKey.keyId,

          publicKey:
            device.signedPreKey.publicKey,

          signature:
            device.signedPreKey.signature,
        },

        preKey: preKey
          ? {
              keyId: preKey.keyId,
              publicKey:
                preKey.publicKey,
            }
          : null,
      },
    });
  } catch (error) {
    console.error(
      "GET PREKEY BUNDLE ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to load encryption keys",
    });
  }
}

async function replenishPreKeys(req, res) {
  try {
    const userId = getUserId(req);

    const {
      deviceId,
      preKeys,
    } = req.body;

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (!Array.isArray(preKeys)) {
      return res.status(400).json({
        message: "preKeys must be an array",
      });
    }

    const device = await Device.findOne({
      user: userId,
      deviceId,
      isActive: true,
    });

    if (!device) {
      return res.status(404).json({
        message: "Device not found",
      });
    }

    const documents = preKeys.map(
      (key) => ({
        device: device._id,
        keyId: key.keyId,
        publicKey: normalizeBase64(
          key.publicKey
        ),
      })
    );

    if (documents.length > 0) {
      await PreKey.insertMany(
        documents,
        {
          ordered: false,
        }
      );
    }

    return res.json({
      success: true,
      added: documents.length,
    });
  } catch (error) {
    console.error(
      "REPLENISH PREKEY ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to replenish prekeys",
    });
  }
}

module.exports = {
  registerDevice,
  getUserDevices,
  getDevicePreKeyBundle,
  replenishPreKeys,
};
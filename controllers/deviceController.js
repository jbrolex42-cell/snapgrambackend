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

function normalizeBase64(value, fieldName = "key data") {
  if (!value) {
    throw new Error(`Missing ${fieldName}`);
  }

  const normalized = String(value).trim();

  if (!normalized) {
    throw new Error(`Missing ${fieldName}`);
  }

  return normalized;
}

function normalizePositiveInteger(value, fieldName) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return number;
}

async function registerDevice(req, res) {
  const mongoSession = await mongoose.startSession();

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
      kyberPreKey,
      preKeys,
    } = req.body || {};

    if (
      deviceId === undefined ||
      deviceId === null ||
      !Number.isInteger(Number(deviceId)) ||
      Number(deviceId) < 1
    ) {
      return res.status(400).json({
        message: "Valid deviceId is required",
      });
    }

    if (
      registrationId === undefined ||
      registrationId === null ||
      !Number.isInteger(Number(registrationId)) ||
      Number(registrationId) < 1
    ) {
      return res.status(400).json({
        message: "Valid registrationId is required",
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

    if (
      !kyberPreKey ||
      kyberPreKey.keyId === undefined ||
      !kyberPreKey.publicKey ||
      !kyberPreKey.signature
    ) {
      return res.status(400).json({
        message: "Invalid Kyber pre-key",
      });
    }

    if (!Array.isArray(preKeys)) {
      return res.status(400).json({
        message: "preKeys must be an array",
      });
    }

    const normalizedDeviceId = normalizePositiveInteger(
      deviceId,
      "deviceId"
    );

    const normalizedRegistrationId = normalizePositiveInteger(
      registrationId,
      "registrationId"
    );

    const normalizedSignedPreKeyId = normalizePositiveInteger(
      signedPreKey.keyId,
      "signedPreKey.keyId"
    );

    const normalizedKyberPreKeyId = normalizePositiveInteger(
      kyberPreKey.keyId,
      "kyberPreKey.keyId"
    );

    const normalizedPreKeys = preKeys.map((key, index) => {
      if (!key || key.keyId === undefined || !key.publicKey) {
        throw new Error(
          `Invalid pre-key at index ${index}`
        );
      }

      return {
        keyId: normalizePositiveInteger(
          key.keyId,
          `preKeys[${index}].keyId`
        ),

        publicKey: normalizeBase64(
          key.publicKey,
          `preKeys[${index}].publicKey`
        ),
      };
    });

    let result;

    await mongoSession.withTransaction(async () => {
      const device = await Device.findOneAndUpdate(
        {
          user: userId,
          deviceId: normalizedDeviceId,
        },
        {
          $set: {
            registrationId: normalizedRegistrationId,

            identityKey: normalizeBase64(
              identityKey,
              "identityKey"
            ),

            signedPreKey: {
              keyId: normalizedSignedPreKeyId,

              publicKey: normalizeBase64(
                signedPreKey.publicKey,
                "signedPreKey.publicKey"
              ),

              signature: normalizeBase64(
                signedPreKey.signature,
                "signedPreKey.signature"
              ),

              createdAt: signedPreKey.createdAt
                ? new Date(signedPreKey.createdAt)
                : new Date(),

              expiresAt: signedPreKey.expiresAt
                ? new Date(signedPreKey.expiresAt)
                : null,
            },

            kyberPreKey: {
              keyId: normalizedKyberPreKeyId,

              publicKey: normalizeBase64(
                kyberPreKey.publicKey,
                "kyberPreKey.publicKey"
              ),

              signature: normalizeBase64(
                kyberPreKey.signature,
                "kyberPreKey.signature"
              ),

              createdAt: kyberPreKey.createdAt
                ? new Date(kyberPreKey.createdAt)
                : new Date(),

              expiresAt: kyberPreKey.expiresAt
                ? new Date(kyberPreKey.expiresAt)
                : null,
            },

            isActive: true,
            lastSeenAt: new Date(),
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
          session: mongoSession,
        }
      );

      await PreKey.deleteMany(
        {
          device: device._id,
        },
        {
          session: mongoSession,
        }
      );

      if (normalizedPreKeys.length > 0) {
        const documents = normalizedPreKeys.map((key) => ({
          device: device._id,
          keyId: key.keyId,
          publicKey: key.publicKey,
          consumed: false,
          consumedAt: null,
        }));

        await PreKey.insertMany(
          documents,
          {
            session: mongoSession,
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
  } catch (error) {
    console.error(
      "REGISTER DEVICE ERROR:",
      error
    );

    return res.status(500).json({
      message: "Unable to register device",
    });
  } finally {
    await mongoSession.endSession();
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
        "deviceId registrationId identityKey signedPreKey kyberPreKey"
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
    const requesterId = getUserId(req);
    const targetUserId = req.params.userId;

    if (!requesterId) {
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

    const requestedDeviceId =
      req.query.deviceId !== undefined
        ? Number(req.query.deviceId)
        : null;

    if (
      requestedDeviceId !== null &&
      (!Number.isInteger(requestedDeviceId) ||
        requestedDeviceId < 1)
    ) {
      return res.status(400).json({
        message: "Invalid device id",
      });
    }

    const deviceQuery = {
      user: targetUserId,
      isActive: true,
    };

    if (requestedDeviceId !== null) {
      deviceQuery.deviceId =
        requestedDeviceId;
    }

    const device = await Device.findOne(
      deviceQuery
    )
      .select(
        "_id deviceId registrationId identityKey signedPreKey kyberPreKey"
      )
      .lean();

    if (!device) {
      return res.status(404).json({
        message: "Device not found",
      });
    }

    if (
      !device.identityKey ||
      !device.signedPreKey ||
      !device.kyberPreKey
    ) {
      return res.status(409).json({
        message:
          "Device encryption keys are incomplete",
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

        deviceId:
          device.deviceId,

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

        kyberPreKey: {
          keyId:
            device.kyberPreKey.keyId,

          publicKey:
            device.kyberPreKey.publicKey,

          signature:
            device.kyberPreKey.signature,
        },

        preKey: preKey
          ? {
              keyId:
                preKey.keyId,

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

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const {
      deviceId,
      preKeys,
    } = req.body || {};

    if (
      deviceId === undefined ||
      deviceId === null
    ) {
      return res.status(400).json({
        message: "deviceId is required",
      });
    }

    if (!Array.isArray(preKeys)) {
      return res.status(400).json({
        message: "preKeys must be an array",
      });
    }

    const normalizedDeviceId =
      normalizePositiveInteger(
        deviceId,
        "deviceId"
      );

    const device = await Device.findOne({
      user: userId,
      deviceId: normalizedDeviceId,
      isActive: true,
    });

    if (!device) {
      return res.status(404).json({
        message: "Device not found",
      });
    }

    const documents = preKeys.map(
      (key, index) => {
        if (
          !key ||
          key.keyId === undefined ||
          !key.publicKey
        ) {
          throw new Error(
            `Invalid pre-key at index ${index}`
          );
        }

        return {
          device: device._id,

          keyId: normalizePositiveInteger(
            key.keyId,
            `preKeys[${index}].keyId`
          ),

          publicKey: normalizeBase64(
            key.publicKey,
            `preKeys[${index}].publicKey`
          ),

          consumed: false,
          consumedAt: null,
        };
      }
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

    if (error?.code === 11000) {
      return res.status(409).json({
        message:
          "One or more pre-key IDs already exist",
      });
    }

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
const https = require("https");

function requestJson(
  url,
  options = {},
  body = null
) {
  return new Promise(
    (resolve, reject) => {
      const request =
        https.request(
          url,
          {
            method:
              options.method || "GET",
            headers: {
              ...(options.headers || {}),
              ...(body
                ? {
                    "Content-Type":
                      "application/json",
                  }
                : {}),
            },
          },
          (response) => {
            let data = "";

            response.on(
              "data",
              (chunk) => {
                data += chunk;
              }
            );

            response.on(
              "end",
              () => {
                let parsed;

                try {
                  parsed = data
                    ? JSON.parse(data)
                    : {};
                } catch {
                  parsed = {
                    raw: data,
                  };
                }

                if (
                  response.statusCode >=
                    200 &&
                  response.statusCode < 300
                ) {
                  resolve(parsed);
                  return;
                }

                const error =
                  new Error(
                    parsed?.errorMessage ||
                      parsed?.message ||
                      `M-PESA request failed with status ${response.statusCode}`
                  );

                error.statusCode =
                  response.statusCode;

                error.response =
                  parsed;

                reject(error);
              }
            );
          }
        );

      request.on(
        "error",
        reject
      );

      if (body) {
        request.write(
          JSON.stringify(body)
        );
      }

      request.end();
    }
  );
}

function getBaseUrl() {
  const environment =
    String(
      process.env.MPESA_ENV ||
        "sandbox"
    ).toLowerCase();

  if (
    environment === "production"
  ) {
    return (
      process.env.MPESA_BASE_URL ||
      "https://api.safaricom.co.ke"
    );
  }

  return (
    process.env.MPESA_BASE_URL ||
    "https://sandbox.safaricom.co.ke"
  );
}

function getTimestamp() {
  const now = new Date();

  const year =
    now.getUTCFullYear();

  const month = String(
    now.getUTCMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getUTCDate()
  ).padStart(2, "0");

  const hours = String(
    now.getUTCHours() + 3
  ).padStart(2, "0");

  const minutes = String(
    now.getUTCMinutes()
  ).padStart(2, "0");

  const seconds = String(
    now.getUTCSeconds()
  ).padStart(2, "0");

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function getPassword(timestamp) {
  const shortcode =
    process.env.MPESA_SHORTCODE;

  const passkey =
    process.env.MPESA_PASSKEY;

  if (
    !shortcode ||
    !passkey
  ) {
    throw new Error(
      "MPESA_SHORTCODE and MPESA_PASSKEY are required."
    );
  }

  return Buffer.from(
    `${shortcode}${passkey}${timestamp}`
  ).toString("base64");
}

async function getAccessToken() {
  const consumerKey =
    process.env.MPESA_CONSUMER_KEY;

  const consumerSecret =
    process.env.MPESA_CONSUMER_SECRET;

  if (
    !consumerKey ||
    !consumerSecret
  ) {
    throw new Error(
      "MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET are required."
    );
  }

  const credentials =
    Buffer.from(
      `${consumerKey}:${consumerSecret}`
    ).toString("base64");

  const response =
    await requestJson(
      `${getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      }
    );

  if (!response?.access_token) {
    throw new Error(
      "M-PESA did not return an access token."
    );
  }

  return response.access_token;
}

function normalizePhoneNumber(
  phone
) {
  let value = String(
    phone || ""
  ).replace(/\s+/g, "");

  if (value.startsWith("+254")) {
    value = value.substring(1);
  }

  if (value.startsWith("07")) {
    value =
      `254${value.substring(1)}`;
  }

  if (value.startsWith("01")) {
    value =
      `254${value.substring(1)}`;
  }

  if (
    !/^254\d{9}$/.test(value)
  ) {
    throw new Error(
      "Enter a valid Kenyan M-PESA number."
    );
  }

  return value;
}

async function initiateStkPush({
  amount,
  phoneNumber,
  accountReference,
  transactionDesc,
}) {
  const token =
    await getAccessToken();

  const timestamp =
    getTimestamp();

  const shortcode =
    process.env.MPESA_SHORTCODE;

  const callbackUrl =
    process.env.MPESA_CALLBACK_URL;

  if (!callbackUrl) {
    throw new Error(
      "MPESA_CALLBACK_URL is required."
    );
  }

  const normalizedPhone =
    normalizePhoneNumber(
      phoneNumber
    );

  const response =
    await requestJson(
      `${getBaseUrl()}/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      {
        BusinessShortCode:
          shortcode,

        Password:
          getPassword(timestamp),

        Timestamp: timestamp,

        TransactionType:
          process.env
            .MPESA_TRANSACTION_TYPE ||
          "CustomerPayBillOnline",

        Amount: Math.round(
          Number(amount)
        ),

        PartyA:
          normalizedPhone,

        PartyB:
          shortcode,

        PhoneNumber:
          normalizedPhone,

        CallBackURL:
          callbackUrl,

        AccountReference:
          accountReference,

        TransactionDesc:
          transactionDesc,
      }
    );

  return {
    ...response,
    phoneNumber:
      normalizedPhone,
  };
}

module.exports = {
  getAccessToken,
  initiateStkPush,
  normalizePhoneNumber,
};
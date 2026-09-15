const nodemailer = require("nodemailer");

const transporter =
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,

    port: Number(
      process.env.SMTP_PORT || 587
    ),

    secure:
      String(
        process.env.SMTP_SECURE
      ) === "true",

    auth: {
      user:
        process.env.SMTP_USER,

      pass:
        process.env.SMTP_PASSWORD,
    },
  });

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}

/* =========================================================
   PASSWORD RESET
========================================================= */

async function sendPasswordResetEmail({
  email,
  username,
  resetToken,
}) {
  if (!email) {
    throw new Error(
      "Password reset email address is required."
    );
  }

  if (!resetToken) {
    throw new Error(
      "Password reset token is required."
    );
  }

  const mobileAppUrl =
    process.env.MOBILE_APP_URL ||
    "mobile://reset-password";

  const separator =
    mobileAppUrl.includes("?")
      ? "&"
      : "?";

  const resetUrl =
    `${mobileAppUrl}${separator}token=${encodeURIComponent(
      resetToken
    )}`;

  const safeUsername =
    escapeHtml(
      username || "there"
    );

  const safeResetUrl =
    escapeHtml(resetUrl);

  await transporter.sendMail({
    from:
      process.env.EMAIL_FROM ||
      process.env.SMTP_USER,

    to: email,

    subject:
      "Reset your Snapgram password",

    text: `Hi ${
      username || "there"
    },

We received a request to reset your Snapgram password.

Open this link to choose a new password:

${resetUrl}

This link expires in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

Snapgram`,

    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>Reset your Snapgram password</title>
        </head>

        <body style="
          margin:0;
          padding:0;
          background:#fafafa;
          font-family:Arial,Helvetica,sans-serif;
          color:#262626;
        ">

          <div style="
            max-width:520px;
            margin:0 auto;
            padding:40px 20px;
          ">

            <div style="
              background:#ffffff;
              border:1px solid #dbdbdb;
              border-radius:12px;
              padding:32px 24px;
            ">

              <h1 style="
                text-align:center;
                font-size:32px;
                margin:0 0 32px;
                color:#262626;
              ">
                Snapgram
              </h1>

              <h2 style="
                font-size:22px;
                margin:0 0 20px;
              ">
                Reset your password
              </h2>

              <p style="
                font-size:15px;
                line-height:1.6;
                margin:0 0 16px;
              ">
                Hi ${safeUsername},
              </p>

              <p style="
                font-size:15px;
                line-height:1.6;
                margin:0 0 24px;
              ">
                We received a request to reset your
                Snapgram password.
              </p>

              <div style="
                text-align:center;
                margin:30px 0;
              ">
                <a
                  href="${safeResetUrl}"
                  style="
                    display:inline-block;
                    background:#0095F6;
                    color:#ffffff;
                    padding:13px 28px;
                    border-radius:8px;
                    text-decoration:none;
                    font-size:15px;
                    font-weight:bold;
                  "
                >
                  Reset password
                </a>
              </div>

              <p style="
                font-size:14px;
                line-height:1.6;
                color:#737373;
                margin:24px 0 8px;
              ">
                This link expires in 1 hour.
              </p>

              <p style="
                font-size:14px;
                line-height:1.6;
                color:#737373;
                margin:0;
              ">
                If you didn't request a password reset,
                you can safely ignore this email.
              </p>

              <div style="
                margin-top:32px;
                padding-top:20px;
                border-top:1px solid #efefef;
              ">
                <p style="
                  font-size:13px;
                  color:#8e8e8e;
                  margin:0;
                  text-align:center;
                ">
                  — Snapgram
                </p>
              </div>

            </div>
          </div>

        </body>
      </html>
    `,
  });
}

/* =========================================================
   TWO-FACTOR AUTHENTICATION
========================================================= */

async function sendTwoFactorCode({
  email,
  username,
  code,
}) {
  if (!email) {
    throw new Error(
      "Two-factor authentication email address is required."
    );
  }

  if (!code) {
    throw new Error(
      "Two-factor authentication code is required."
    );
  }

  const safeUsername =
    escapeHtml(
      username || "there"
    );

  const safeCode =
    escapeHtml(code);

  await transporter.sendMail({
    from:
      process.env.EMAIL_FROM ||
      process.env.SMTP_USER,

    to: email,

    subject:
      "Your Snapgram security code",

    text: `Hi ${
      username || "there"
    },

Your Snapgram security code is:

${code}

This code expires in 10 minutes.

If you did not try to sign in to Snapgram, please change your password immediately.

Snapgram`,

    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>Snapgram security code</title>
        </head>

        <body style="
          margin:0;
          padding:0;
          background:#fafafa;
          font-family:Arial,Helvetica,sans-serif;
          color:#262626;
        ">

          <div style="
            max-width:520px;
            margin:0 auto;
            padding:40px 20px;
          ">

            <div style="
              background:#ffffff;
              border:1px solid #dbdbdb;
              border-radius:12px;
              padding:32px 24px;
            ">

              <h1 style="
                text-align:center;
                font-size:32px;
                margin:0 0 30px;
              ">
                Snapgram
              </h1>

              <h2 style="
                font-size:22px;
                margin:0 0 18px;
              ">
                Security code
              </h2>

              <p style="
                font-size:15px;
                line-height:1.6;
              ">
                Hi ${safeUsername},
              </p>

              <p style="
                font-size:15px;
                line-height:1.6;
              ">
                Use the following code to complete
                your Snapgram login:
              </p>

              <div style="
                margin:30px 0;
                text-align:center;
              ">
                <div style="
                  display:inline-block;
                  padding:16px 28px;
                  border:1px solid #dbdbdb;
                  border-radius:10px;
                  font-size:32px;
                  font-weight:bold;
                  letter-spacing:8px;
                  color:#262626;
                ">
                  ${safeCode}
                </div>
              </div>

              <p style="
                font-size:14px;
                line-height:1.6;
                color:#737373;
              ">
                This code expires in 10 minutes.
              </p>

              <p style="
                font-size:14px;
                line-height:1.6;
                color:#737373;
              ">
                If you did not try to sign in,
                change your password immediately.
              </p>

              <div style="
                margin-top:30px;
                padding-top:20px;
                border-top:1px solid #efefef;
                text-align:center;
              ">
                <span style="
                  color:#8e8e8e;
                  font-size:13px;
                ">
                  — Snapgram Security
                </span>
              </div>

            </div>
          </div>

        </body>
      </html>
    `,
  });
}

module.exports = {
  sendPasswordResetEmail,
  sendTwoFactorCode,
};
const nodemailer = require('nodemailer');

// Only creates a real mail transporter if email credentials are configured.
// If not configured, sendPasswordResetEmail() below will simply do nothing
// and the caller falls back to showing the reset link directly (dev mode).
function getTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // must be a Gmail "App Password", not your normal password
    },
  });
}

// Sends the password reset email. Returns true if an email was actually
// sent, false if email isn't configured (caller should fall back to dev mode).
async function sendPasswordResetEmail(toEmail, resetLink) {
  const transporter = getTransporter();
  if (!transporter) return false;

  await transporter.sendMail({
    from: `"AI Grader" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Reset your AI Grader password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #4f3fd6;">Reset your password</h2>
        <p>We received a request to reset your AI Grader password. Click the button below to choose a new one. This link expires in 1 hour.</p>
        <a href="${resetLink}" style="display:inline-block;background:#6c5ce7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">Reset Password</a>
        <p style="color:#888;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });

  return true;
}

module.exports = { sendPasswordResetEmail };
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { generateToken } = require('../utils/jwt');
const { sendPasswordResetEmail } = require('../utils/mailer');

// Reusable validation rules for register/login forms
const registerValidation = [
  body('email').isEmail().withMessage('Enter a valid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['TEACHER', 'STUDENT']).withMessage('Role must be TEACHER or STUDENT'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Enter a valid email address'),
  body('password').notEmpty().withMessage('Password is required'),
  body('role').isIn(['TEACHER', 'STUDENT']).withMessage('Role must be TEACHER or STUDENT'),
];

// Sets the JWT as an HTTP-only cookie (safer than storing in localStorage)
function setTokenCookie(res, token, rememberMe) {
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 30 days or 1 day
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge,
  });
}

async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, role, name } = req.body;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, role, name, provider: 'local' },
    });

    const token = generateToken(user, false);
    setTokenCookie(res, token, false);

    return res.status(201).json({
      message: 'Account created successfully',
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
}

async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, role, rememberMe } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Same generic message for "no user" and "wrong password" -> avoids
    // telling attackers whether an email exists in the system.
    if (!user || !user.password) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (user.role !== role) {
      return res.status(403).json({
        message: `This account is registered as a ${user.role.toLowerCase()}, not a ${role.toLowerCase()}.`,
      });
    }

    const token = generateToken(user, !!rememberMe);
    setTokenCookie(res, token, !!rememberMe);

    return res.json({
      message: 'Logged in successfully',
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
}

function logout(req, res) {
  res.clearCookie('token');
  return res.json({ message: 'Logged out successfully' });
}

async function getCurrentUser(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.json({
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
}

const forgotPasswordValidation = [
  body('email').isEmail().withMessage('Enter a valid email address'),
];

const resetPasswordValidation = [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

// Generates a reset token, hashes it before storing (so a leaked database
// doesn't leak usable tokens), and gives it back to the caller. In a real
// production app this token would be emailed instead of returned directly -
// we return it here so you can test the full flow without setting up SMTP.
async function forgotPassword(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond the same way whether or not the email exists,
    // so attackers can't use this endpoint to discover registered emails.
    const genericResponse = {
      message: 'If an account with that email exists, a password reset link has been generated.',
    };

    if (!user) {
      return res.json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // valid for 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash: tokenHash, resetTokenExpiry: expiry },
    });

    const resetLink = `${process.env.CLIENT_URL}/frontent/reset-password/index.html?token=${rawToken}`;

    let emailSent = false;
    try {
      emailSent = await sendPasswordResetEmail(email, resetLink);
    } catch (emailErr) {
      console.error('Failed to send reset email:', emailErr.message);
    }

    if (emailSent) {
      // Real email went out - don't leak the link in the API response.
      return res.json(genericResponse);
    }

    // Email isn't configured yet - fall back to showing the link directly
    // so the flow is still fully testable during development.
    console.log(`Password reset link for ${email}: ${resetLink}`);
    return res.json({ ...genericResponse, devResetLink: resetLink });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
}

async function resetPassword(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { token, newPassword } = req.body;

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        resetTokenHash: tokenHash,
        resetTokenExpiry: { gt: new Date() }, // must not be expired
      },
    });

    if (!user) {
      return res.status(400).json({ message: 'This reset link is invalid or has expired. Please request a new one.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, resetTokenHash: null, resetTokenExpiry: null },
    });

    return res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
}

const updateProfileValidation = [
  body('name').trim().notEmpty().withMessage('Name cannot be empty'),
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
];

async function updateProfile(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name } = req.body;

  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name },
    });

    return res.json({
      message: 'Profile updated',
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not update profile.' });
  }
}

async function changePassword(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { currentPassword, newPassword } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user.password) {
      return res.status(400).json({ message: 'This account signed in via Google/Microsoft and has no password to change.' });
    }

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not change password.' });
  }
}

module.exports = {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  updateProfileValidation,
  changePasswordValidation,
  register,
  login,
  logout,
  getCurrentUser,
  setTokenCookie,
  forgotPassword,
  resetPassword,
  updateProfile,
  changePassword,
};
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const express = require('express');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const {
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
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { generateToken } = require('../utils/jwt');

const router = express.Router();

// Limits login attempts to slow down brute-force password guessing.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
});

// --- Email/password auth ---
router.post('/register', registerValidation, register);
router.post('/login', loginLimiter, loginValidation, login);
router.post('/logout', logout);
router.get('/me', requireAuth, getCurrentUser);
router.post('/forgot-password', loginLimiter, forgotPasswordValidation, forgotPassword);
router.post('/reset-password', loginLimiter, resetPasswordValidation, resetPassword);
router.put('/profile', requireAuth, updateProfileValidation, updateProfile);
router.put('/change-password', requireAuth, changePasswordValidation, changePassword);

// --- Google OAuth ---
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login?error=google`,
  }),
  (req, res) => {

    // Existing user
    if (!req.user.isNewUser) {

      const token = generateToken(req.user.user, true);

      setTokenCookie(res, token, true);

      if (req.user.user.role === 'TEACHER') {
        const redirectUrl =
          `${process.env.CLIENT_URL}/teacher_dashboard/index.html`;

        console.log("Redirect URL:", redirectUrl);

        return res.redirect(redirectUrl);
      }

      const redirectUrl =
        `${process.env.CLIENT_URL}/student_dashboard/index.html`;

      console.log("Redirect URL:", redirectUrl);

      return res.redirect(redirectUrl);
    }

    // ---------- NEW USER ----------

    const tempToken = jwt.sign(
      {
        email: req.user.user.email,
        name: req.user.user.name,
        provider: req.user.user.provider,
        providerId: req.user.user.providerId,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '10m',
      }
    );

    return res.redirect(
      `${process.env.CLIENT_URL}/choose-role/choose-role.html?token=${tempToken}`
    );
  }
);
// --- Microsoft OAuth ---
router.get(
  '/microsoft/callback',
  passport.authenticate('microsoft', {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login?error=microsoft`,
  }),
  (req, res) => {

    if (!req.user.isNewUser) {

      const token = generateToken(req.user.user, true);
      setTokenCookie(res, token, true);

      if (req.user.user.role === 'TEACHER') {
        return res.redirect(
          `${process.env.CLIENT_URL}/teacher_dashboard/index.html`
        );
      }

      return res.redirect(
        `${process.env.CLIENT_URL}/student_dashboard/index.html`
      );
    }

    const tempToken = jwt.sign(
      {
        email: req.user.user.email,
        name: req.user.user.name,
        provider: req.user.user.provider,
        providerId: req.user.user.providerId,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '10m',
      }
    );

    return res.redirect(
      `${process.env.CLIENT_URL}/choose-role/choose-role.html?token=${tempToken}`
    );
  }
);

router.post('/oauth/register', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Missing temporary OAuth token.'
      });
    }

    const tempToken = authHeader.split(' ')[1];

    let payload;

    try {
      payload = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        message: 'OAuth session expired. Please sign in again.'
      });
    }

    const { role } = req.body;

    let user = await prisma.user.findUnique({
      where: {
        email: payload.email
      }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name,
          provider: payload.provider,
          providerId: payload.providerId,
          role
        }
      });
    }

    const loginToken = generateToken(user, true);

    setTokenCookie(res, loginToken, true);

    res.json({
      success: true,
      user
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: 'OAuth registration failed.'
    });

  }
});

module.exports = router;
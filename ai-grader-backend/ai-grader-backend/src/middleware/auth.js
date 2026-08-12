const { verifyToken } = require('../utils/jwt');

// Checks that a valid token was sent (in cookie or Authorization header).
// Attaches the decoded user info to req.user so later code can use it.
function requireAuth(req, res, next) {
  const token =
    req.cookies?.token ||
    req.headers.authorization?.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: 'Not authenticated. Please log in.' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Session expired or invalid. Please log in again.' });
  }
}

// Use after requireAuth to restrict a route to a specific role,
// e.g. requireRole('TEACHER') on a "create assignment" endpoint.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to do this.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };

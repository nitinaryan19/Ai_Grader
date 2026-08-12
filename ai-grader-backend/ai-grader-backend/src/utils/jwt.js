const jwt = require('jsonwebtoken');

// Creates a signed token containing the user's id and role.
// If "rememberMe" is true, the token lasts 30 days instead of 1 day.
function generateToken(user, rememberMe = false) {
  const expiresIn = rememberMe
    ? process.env.JWT_REMEMBER_ME_EXPIRY
    : process.env.JWT_DEFAULT_EXPIRY;

  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn }
  );
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { generateToken, verifyToken };

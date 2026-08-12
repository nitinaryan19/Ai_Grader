const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const prisma = require('./db');
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);
console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "Loaded" : "Missing");
console.log("GOOGLE_CALLBACK_URL:", process.env.GOOGLE_CALLBACK_URL);

// Finds an existing user by provider ID/email, or creates a new one.
// Note: OAuth sign-in doesn't know the role (Teacher/Student) ahead of time,
// so new OAuth users default to STUDENT — you can add a "choose your role"
// step on the frontend right after their first OAuth login.
async function findOrCreateOAuthUser({ provider, providerId, email, name }) {

  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    return {
      isNewUser: false,
      user: existingUser
    };
  }

  return {
    isNewUser: true,
    user: {
      email,
      name,
      provider,
      providerId
    }
  };
}

// Only register Google strategy if credentials are actually set in .env.
// This lets the app run fine with just email/password login until you're
// ready to set up OAuth.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateOAuthUser({
            provider: 'google',
            providerId: profile.id,
            email: profile.emails[0].value,
            name: profile.displayName,
          });
          done(null, user);
        } catch (err) {
          done(err, null);
        }
      }
    )
  );
} else {
  console.log('Google OAuth not configured - skipping (set GOOGLE_CLIENT_ID/SECRET in .env to enable)');
}

// Same idea for Microsoft.
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  passport.use(
    new MicrosoftStrategy(
      {
        clientID: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        callbackURL: process.env.MICROSOFT_CALLBACK_URL,
        scope: ['user.read'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateOAuthUser({
            provider: 'microsoft',
            providerId: profile.id,
            email: profile.emails[0].value,
            name: profile.displayName,
          });
          done(null, user);
        } catch (err) {
          done(err, null);
        }
      }
    )
  );
} else {
  console.log('Microsoft OAuth not configured - skipping (set MICROSOFT_CLIENT_ID/SECRET in .env to enable)');
}

module.exports = passport;
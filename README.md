# AI Grader — Backend

Backend for the AI Grader login/auth system (Teacher & Student roles, email/password login, "Remember me," Google & Microsoft sign-in).

## What's inside

```
ai-grader-backend/
├── prisma/
│   └── schema.prisma        # Database structure (User table)
├── src/
│   ├── config/
│   │   ├── db.js            # Database connection
│   │   └── passport.js      # Google/Microsoft OAuth setup
│   ├── controllers/
│   │   └── authController.js # Register/login/logout logic
│   ├── middleware/
│   │   └── auth.js          # Route protection
│   ├── routes/
│   │   └── authRoutes.js    # API endpoints
│   ├── utils/
│   │   └── jwt.js           # Token generation
│   └── server.js            # App entry point
├── .env.example
└── package.json
```

## Step-by-step setup

### 1. Install Node.js
Download and install from https://nodejs.org (LTS version). This gives you `node` and `npm`.

### 2. Install project dependencies
Open a terminal in the `ai-grader-backend` folder and run:
```bash
npm install
```

### 3. Set up your environment file
```bash
cp .env.example .env
```
Open `.env` and replace `JWT_SECRET` with any long random string (you can generate one at https://randomkeygen.com). You can leave the Google/Microsoft fields blank for now — email/password login will work without them.

### 4. Create the database
This single command creates your `dev.db` SQLite file and the `User` table automatically:
```bash
npx prisma migrate dev --name init
```

### 5. Start the server
```bash
npm run dev
```
You should see: `AI Grader backend running on http://localhost:5000`

### 6. Test it works
```bash
curl https://ai-grader-backend-02cv.onrender.com/api/health
```
Should return `{"status":"ok","message":"AI Grader backend is running"}`

## Testing the login endpoints

**Register a teacher:**
```bash
curl -X POST https://ai-grader-backend-02cv.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@example.com","password":"password123","role":"TEACHER","name":"Jane Doe"}'
```

**Log in:**
```bash
curl -X POST https://ai-grader-backend-02cv.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"teacher@example.com","password":"password123","role":"TEACHER","rememberMe":true}'
```

**Get current logged-in user (using the saved cookie):**
```bash
curl https://ai-grader-backend-02cv.onrender.com/api/auth/me -b cookies.txt
```

## Connecting your frontend

From your login page's JavaScript, call the API like this:

```javascript
async function handleLogin(email, password, role, rememberMe) {
  const res = await fetch('https://ai-grader-backend-02cv.onrender.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // IMPORTANT: sends/receives the auth cookie
    body: JSON.stringify({ email, password, role, rememberMe }),
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.message); // show error to user
    return;
  }
  window.location.href = '/dashboard';
}
```

For the "Continue with Google" / "Continue with Microsoft" buttons, simply link/redirect them to:
- `https://ai-grader-backend-02cv.onrender.com/api/auth/google`
- `https://ai-grader-backend-02cv.onrender.com/api/auth/microsoft`

## Setting up Google/Microsoft OAuth (optional, do this later)

**Google:**
1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth Client ID → Web application
3. Add authorized redirect URI: `https://ai-grader-backend-02cv.onrender.com/api/auth/google/callback`
4. Copy the Client ID/Secret into your `.env`

**Microsoft:**
1. Go to https://portal.azure.com → App registrations → New registration
2. Add redirect URI: `https://ai-grader-backend-02cv.onrender.com/api/auth/microsoft/callback`
3. Create a client secret under "Certificates & secrets"
4. Copy the Application (client) ID and secret into your `.env`

## How the "Remember Me" checkbox works
- Unchecked → login token expires in 1 day (`JWT_DEFAULT_EXPIRY`)
- Checked → login token expires in 30 days (`JWT_REMEMBER_ME_EXPIRY`)

Both values are configurable in `.env`.

## Security features already included
- Passwords are hashed with bcrypt (never stored in plain text)
- JWT stored in an `httpOnly` cookie (JavaScript on the page can't read/steal it)
- Login attempts are rate-limited (10 tries per 15 minutes) to block brute-force attacks
- Same error message for "wrong password" and "no such account" (prevents attackers from discovering which emails are registered)
- Input validation on register/login (valid email format, minimum password length)

## Next steps to build on this
- Add a `/api/auth/forgot-password` flow (send reset link via email — e.g. using Nodemailer)
- Add short-answer submission & grading endpoints/tables (`Assignment`, `Submission` models in `schema.prisma`)
- When ready for production, switch `DATABASE_URL` from SQLite to PostgreSQL — Prisma makes this a one-line change

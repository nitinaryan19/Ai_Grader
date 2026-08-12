const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const multer = require('multer');

// Load .env
const result = dotenv.config({
  path: path.resolve(__dirname, '../.env')
});

if (result.error) {
  console.error('Failed to load .env:', result.error);
} else {
  console.log('Loaded .env from:', path.resolve(__dirname, '../.env'));
  console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID || 'NOT FOUND');
  console.log(
    'GOOGLE_CLIENT_SECRET:',
    process.env.GOOGLE_CLIENT_SECRET ? 'Loaded' : 'Missing'
  );
}

const passport = require('./config/passport');
const authRoutes = require('./routes/authRoutes');
const examRoutes = require('./routes/examRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

// ---------- Middleware ----------
app.use(express.json());

app.use(cookieParser());

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(passport.initialize());

// Serves uploaded answer photos (e.g. so a teacher can open the original
// handwritten photo behind an AI-transcribed answer, if ever needed).
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------- Routes ----------
app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'AI Grader backend is running',
  });
});

// ---------- Error Handler ----------
app.use((err, req, res, next) => {
  console.error(err);

  // Multer errors (file too large, wrong field, etc.) get a clearer message
  // than the generic 500 below, since they're usually the student's fault
  // (e.g. picked too large a photo) rather than a real server error.
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'One of the uploaded photos is too large (max 8MB).' });
    }
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }
  if (err && err.message && err.message.includes('Only image files are allowed')) {
    return res.status(400).json({ message: err.message });
  }

  res.status(500).json({
    message: 'Unexpected server error',
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`AI Grader backend running on http://localhost:${PORT}`);
});
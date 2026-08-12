// Handles teacher uploads of course materials (notes, PDFs, answer keys) that
// get attached to an exam for students to view/download. Unlike answer-file
// uploads, these are NOT text-extracted - they're just stored and served as-is.

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads', 'materials');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname) || ''}`);
  },
});

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword', // legacy .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'text/plain',
]);

const materialUpload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB - materials can be bigger than answer files
  fileFilter: (req, file, cb) => {
    const isAllowed = file.mimetype.startsWith('image/') || ALLOWED_MIME_TYPES.has(file.mimetype);
    if (!isAllowed) {
      return cb(new Error('Unsupported file type. Please upload a PDF, Word document, text file, or image.'));
    }
    cb(null, true);
  },
});

module.exports = materialUpload;
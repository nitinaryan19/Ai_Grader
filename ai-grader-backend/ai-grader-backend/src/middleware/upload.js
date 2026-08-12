// Handles the answer-file uploads that come in when a student answers a
// question by uploading a scanned/typed page instead of typing directly
// into the exam - images, PDFs, Word docs (.docx), or plain text files.
//
// Files are stored on disk under src/uploads/answer-files, named with a
// timestamp so two students' uploads never collide. We use upload.any()
// on the route (not upload.single()/fields()) because the frontend sends
// one file per file-mode question, with a dynamic field name like
// `answerFile_<questionId>` - the question IDs aren't known ahead of time.

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads', 'answer-files');
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

// Types the frontend can send and fileTextExtractor.js knows how to read:
//   - any image/* (photo of a handwritten page)
//   - application/pdf
//   - .docx (modern Word format only - NOT legacy .doc, which mammoth can't read)
//   - text/plain (.txt)
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'text/plain',
]);

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB - matches the frontend's client-side check
  fileFilter: (req, file, cb) => {
    const isAllowed = file.mimetype.startsWith('image/') || ALLOWED_MIME_TYPES.has(file.mimetype);
    if (!isAllowed) {
      return cb(new Error('Unsupported file type. Please upload an image, PDF, Word (.docx), or text (.txt) file.'));
    }
    cb(null, true);
  },
});

module.exports = upload;
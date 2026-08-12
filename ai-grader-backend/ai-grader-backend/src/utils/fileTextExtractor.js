// Given an uploaded answer file, returns its text content so it can be
// graded the same way as a typed answer. Different file types need
// completely different extraction methods:
//   - images (jpg/png/etc.) and PDFs -> Gemini vision (handles handwriting/scans)
//   - .docx (Word)                   -> mammoth (reads the file's own text directly)
//   - .txt (plain text)               -> read directly, no extraction needed
// Legacy .doc (old binary Word format) is intentionally NOT supported here -
// mammoth only reads modern .docx - so it's rejected earlier in upload.js.

const mammoth = require('mammoth');
const { extractTextViaGemini } = require('./aiGrader');

async function extractTextFromFile({ fileBuffer, mimeType }) {
  if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
    return extractTextViaGemini({ fileBuffer, mimeType });
  }

  if (mimeType === 'text/plain') {
    const text = fileBuffer.toString('utf-8').trim();
    return text || null;
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      const text = (result.value || '').trim();
      return text || null;
    } catch (err) {
      throw new Error(`Could not read the Word document: ${err.message}`);
    }
  }

  // Unsupported type (shouldn't normally reach here - upload.js's fileFilter
  // rejects it before this point - but handled defensively just in case).
  return null;
}

module.exports = { extractTextFromFile };
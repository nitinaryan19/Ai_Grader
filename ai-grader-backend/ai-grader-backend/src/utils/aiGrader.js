// Calls the Google Gemini API (free tier) to (a) read handwritten answer
// photos via OCR, and (b) compare a student's answer against the teacher's
// model answer, returning a score + feedback.
// Get a free API key at https://aistudio.google.com/apikey (no credit card needed).

// Grades a text answer against the model answer, weighing how much
// explanation is expected relative to the marks available.
async function gradeAnswer({ questionText, modelAnswer, studentAnswer, maxMarks }) {
  const prompt = `You are grading a student's short-answer exam response.

Question: ${questionText}

Model/ideal answer (for your reference only): ${modelAnswer}

Student's answer: ${studentAnswer}

Maximum marks available: ${maxMarks}

Grading instructions:
- Grade based on how well the answer captures the key ideas in the model answer, not on exact wording.
- The expected depth of explanation scales with the marks on offer. A question worth only 1-2 marks just needs the key fact/definition. A question worth 8-10+ marks needs a fuller explanation - multiple points, reasoning, or examples as appropriate. A short answer that is technically correct but clearly too shallow for the marks available should NOT receive full marks - dock marks for missing depth/detail and say so in the feedback.
- Do not penalize spelling or grammar on their own - focus on understanding, completeness, and depth of explanation.
- If the answer was transcribed from a handwritten photo and looks like it may contain OCR misreadings, be reasonably lenient about wording that looks like a transcription artifact, but still grade the underlying content normally.

Respond ONLY with a JSON object, no other text, no markdown fences, in exactly this format:
{"score": <number between 0 and ${maxMarks}>, "feedback": "<2-3 sentences of constructive feedback for the student, mentioning if more explanation was expected for the marks available>"}`;

  const apiKey = process.env.GEMINI_API_KEY;
  // NOTE: using the "-latest" alias rather than a pinned dated model name.
  // Google has repeatedly retired dated/pinned model names out from under
  // this project (gemini-2.0-flash, then gemini-2.5-flash and
  // gemini-2.5-flash-lite, all stopped working within the same project's
  // lifetime). The "-latest" aliases (gemini-flash-latest,
  // gemini-flash-lite-latest) are Google-maintained pointers that get
  // redirected to a current model automatically, so they're less likely to
  // 404 out of nowhere. If this ever 404s again, run:
  //   curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY"
  // to see what your key currently has access to, and swap the model name below.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';

  const cleaned = rawText.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    console.error('gradeAnswer: could not parse AI response as JSON. Raw response was:', rawText);
    throw parseErr;
  }

  if (parsed.score === undefined || Number.isNaN(Number(parsed.score))) {
    console.error('gradeAnswer: AI response had no usable score. Parsed:', parsed);
    throw new Error('AI response did not include a valid score.');
  }

  return {
    score: Math.max(0, Math.min(maxMarks, Number(parsed.score))),
    feedback: parsed.feedback,
  };
}

// Reads a scanned/photographed answer file (image or PDF) and transcribes it
// to plain text, using the same vision-capable Gemini model as grading -
// gemini-flash-latest handles text, image, and PDF input, so one model
// covers both jobs and there's only one model name to maintain.
async function extractTextViaGemini({ fileBuffer, mimeType }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

  const base64Data = fileBuffer.toString('base64');
  const isPdf = mimeType === 'application/pdf';

  const prompt = `This file is a scan or photo of a student's ${isPdf ? 'written' : 'handwritten'} exam answer${isPdf ? ' (PDF)' : ''}. Read it carefully and transcribe it into clean, accurate text. Fix only obvious handwriting/OCR misreadings - do not rephrase, summarize, or add anything the student did not write. If the file is blank, illegible, or not a written answer, respond with exactly: [UNREADABLE]

Respond ONLY with the transcribed answer text (or [UNREADABLE]) - no preamble, no quotes, no markdown formatting.`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Data } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini vision API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  const cleaned = rawText.trim();

  if (!cleaned || cleaned === '[UNREADABLE]') {
    return null; // caller decides how to handle a failed/blank read
  }

  return cleaned;
}

module.exports = { gradeAnswer, extractTextViaGemini };
const fs = require('fs');
const prisma = require('../config/db');
const { gradeAnswer } = require('../utils/aiGrader');
const { extractTextFromFile } = require('../utils/fileTextExtractor');
const { createNotification } = require('../utils/notify');

// STUDENT: submit answers for an exam. Each answer is either:
//   - { questionId, type: 'text', studentAnswer }   -> graded directly
//   - { questionId, type: 'file' }                  -> paired with an uploaded
//     file named `answerFile_<questionId>` (image, PDF, .docx, or .txt),
//     its text extracted, THEN graded
//
// This can be called MORE THAN ONCE for the same exam: if the student
// already has a submission (e.g. the teacher added new questions after
// their first attempt), this reuses that submission, only grades the
// questions that don't already have an answer, and recalculates the total
// score across everything (old answers + new ones).
//
// The request is multipart/form-data (not JSON): the "answers" field is a
// JSON string describing each answer, and any uploaded files arrive in
// req.files (handled by the `upload.any()` multer middleware on this route).
async function submitExam(req, res) {
  const { examId } = req.params;

  let answersMeta;
  try {
    const raw = req.body.answers;
    answersMeta = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    return res.status(400).json({ message: 'Invalid answers payload.' });
  }

  if (!Array.isArray(answersMeta) || answersMeta.length === 0) {
    return res.status(400).json({ message: 'At least one answer is required.' });
  }

  // Match uploaded files back to the question they belong to
  const filesByField = {};
  (req.files || []).forEach((f) => {
    filesByField[f.fieldname] = f;
  });

  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: true },
    });
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });

    let submission = await prisma.submission.findFirst({
      where: { examId, studentId: req.user.id },
      include: { answers: true },
    });

    const alreadyAnsweredQuestionIds = new Set((submission?.answers || []).map((a) => a.questionId));

    // Only grade questions that don't already have an answer on this submission
    const newAnswersMeta = answersMeta.filter((a) => !alreadyAnsweredQuestionIds.has(a.questionId));

    if (submission && newAnswersMeta.length === 0) {
      return res.status(409).json({ message: 'You have already answered all of these questions.' });
    }

    if (!submission) {
      submission = await prisma.submission.create({
        data: { examId, studentId: req.user.id },
        include: { answers: true },
      });
    }

    // Grade each new answer one at a time and save the result
    for (const ans of newAnswersMeta) {
      const question = exam.questions.find((q) => q.id === ans.questionId);
      if (!question) continue; // skip any questionId that doesn't belong to this exam

      const answerType = ans.type === 'file' ? 'file' : 'text';
      let studentAnswerText = '';

      if (answerType === 'file') {
        const file = filesByField[`answerFile_${ans.questionId}`];

        if (!file) {
          studentAnswerText = '(No file was uploaded for this question)';
        } else {
          try {
            const fileBuffer = fs.readFileSync(file.path);
            const extracted = await extractTextFromFile({
              fileBuffer,
              mimeType: file.mimetype,
            });
            studentAnswerText = extracted || '(Could not read any text from the uploaded file - a teacher will review this)';
          } catch (extractErr) {
            console.error('Text extraction failed for question', question.id, extractErr.message);
            studentAnswerText = '(Could not read the uploaded file automatically - a teacher will review this)';
          }
        }
      } else {
        studentAnswerText = (ans.studentAnswer || '').trim() || '(No answer provided)';
      }

      let score = 0;
      let feedback = 'Could not be graded automatically - a teacher will review this.';

      try {
        const result = await gradeAnswer({
          questionText: question.questionText,
          modelAnswer: question.modelAnswer,
          studentAnswer: studentAnswerText,
          maxMarks: question.maxMarks,
        });
        score = result.score;
        feedback = result.feedback;
      } catch (aiErr) {
        console.error('AI grading failed for question', question.id, aiErr.message);
        // We still save the answer ungraded rather than failing the whole submission
      }

      await prisma.answer.create({
        data: {
          submissionId: submission.id,
          questionId: question.id,
          studentAnswer: studentAnswerText,
          answerType,
          score,
          feedback,
        },
      });
    }

    // Recompute the total score from ALL answers on this submission (old + new),
    // so scores stay correct after questions are added incrementally.
    const allAnswers = await prisma.answer.findMany({ where: { submissionId: submission.id } });
    const totalScore = allAnswers.reduce((sum, a) => sum + (a.score || 0), 0);

    const updatedSubmission = await prisma.submission.update({
      where: { id: submission.id },
      data: { totalScore, graded: true, submittedAt: new Date() },
      include: { answers: { include: { question: true } } },
    });

    // Notify the student their result is ready, and the teacher that a
    // submission came in/was updated.
    try {
      await createNotification({
        userId: req.user.id,
        message: `Your exam "${exam.title}" was graded - you scored ${totalScore}.`,
        examId: exam.id,
      });
      await createNotification({
        userId: exam.teacherId,
        message: `${req.user.email} submitted "${exam.title}" and scored ${totalScore}.`,
        examId: exam.id,
      });
    } catch (notifyErr) {
      console.error('Could not create notification:', notifyErr.message);
    }

    return res.status(201).json({ message: 'Exam submitted and graded', submission: updatedSubmission });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not submit exam.' });
  }
}

// STUDENT: view their own results for a specific submission
async function getMySubmission(req, res) {
  const { submissionId } = req.params;
  try {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { answers: { include: { question: true } }, exam: true },
    });
    if (!submission) return res.status(404).json({ message: 'Submission not found.' });
    if (submission.studentId !== req.user.id) {
      return res.status(403).json({ message: 'This is not your submission.' });
    }
    return res.json({ submission });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not fetch submission.' });
  }
}

// STUDENT: list all of their own past submissions (results history)
async function listMySubmissions(req, res) {
  try {
    const submissions = await prisma.submission.findMany({
      where: { studentId: req.user.id },
      include: { exam: true },
      orderBy: { submittedAt: 'desc' },
    });
    return res.json({ submissions });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not fetch submissions.' });
  }
}

// TEACHER: view all submissions for one of their exams
async function listExamSubmissions(req, res) {
  const { examId } = req.params;
  try {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });
    if (exam.teacherId !== req.user.id) {
      return res.status(403).json({ message: 'This is not your exam.' });
    }

    const submissions = await prisma.submission.findMany({
      where: { examId },
      include: { student: true, answers: { include: { question: true } } },
      orderBy: { submittedAt: 'desc' },
    });
    return res.json({ submissions });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not fetch submissions.' });
  }
}

module.exports = {
  submitExam,
  getMySubmission,
  listMySubmissions,
  listExamSubmissions,
};
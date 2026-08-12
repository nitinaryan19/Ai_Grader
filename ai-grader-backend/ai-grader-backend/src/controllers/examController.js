const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { createNotification, createNotificationForMany } = require('../utils/notify');

const createExamValidation = [
  body('title').notEmpty().withMessage('Exam title is required'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be a positive number (minutes)'),
];

const addQuestionValidation = [
  body('questionText').notEmpty().withMessage('Question text is required'),
  body('modelAnswer').notEmpty().withMessage('A model answer is required so the AI can grade against it'),
  body('maxMarks').optional().isInt({ min: 1 }).withMessage('Max marks must be a positive number'),
];

// TEACHER: create a new exam (empty of questions initially)
async function createExam(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { title, subject, duration } = req.body;

  try {
    const exam = await prisma.exam.create({
      data: { title, subject, duration: Number(duration), teacherId: req.user.id },
    });
    return res.status(201).json({ message: 'Exam created', exam });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not create exam.' });
  }
}

// TEACHER: add a question (with its model answer) to one of their own exams.
// If students have already submitted this exam, they're notified so they
// know to come back and answer the new question - it will reappear in
// their "Upcoming Exams" list automatically.
async function addQuestion(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { examId } = req.params;
  const { questionText, modelAnswer, maxMarks } = req.body;

  try {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });
    if (exam.teacherId !== req.user.id) {
      return res.status(403).json({ message: 'You can only add questions to your own exams.' });
    }

    const question = await prisma.question.create({
      data: {
        examId,
        questionText,
        modelAnswer,
        maxMarks: maxMarks ? Number(maxMarks) : 10,
      },
    });

    // Notify every student who has already submitted this exam - they now
    // have a new pending question to answer.
    const priorSubmissions = await prisma.submission.findMany({
      where: { examId },
      select: { studentId: true },
      distinct: ['studentId'],
    });
    const studentIds = priorSubmissions.map((s) => s.studentId);

    let notifiedCount = 0;
    if (studentIds.length > 0) {
      await createNotificationForMany({
        userIds: studentIds,
        message: `A new question was added to "${exam.title}". Please answer it to complete your grade.`,
        examId: exam.id,
      });
      notifiedCount = studentIds.length;
    }

    return res.status(201).json({ message: 'Question added', question, notifiedCount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not add question.' });
  }
}

// TEACHER: list all exams they've created, with question count and submission count
async function listMyExams(req, res) {
  try {
    const exams = await prisma.exam.findMany({
      where: { teacherId: req.user.id },
      include: {
        _count: { select: { questions: true, submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ exams });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not fetch exams.' });
  }
}

// TEACHER: view one exam in full detail, including questions and model answers
async function getExamDetail(req, res) {
  const { examId } = req.params;
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: true },
    });
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });
    if (exam.teacherId !== req.user.id) {
      return res.status(403).json({ message: 'This is not your exam.' });
    }
    return res.json({ exam });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not fetch exam.' });
  }
}

// STUDENT: list all available exams, including - for each one - whether this
// student still has unanswered questions on it (either they never started it,
// or the teacher added new questions since their last submission). The
// frontend uses `hasPending` to decide what shows in "Upcoming Exams".
async function listAvailableExams(req, res) {
  try {
    const exams = await prisma.exam.findMany({
      include: { _count: { select: { questions: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const mySubmissions = await prisma.submission.findMany({
      where: { studentId: req.user.id },
      include: { answers: { select: { questionId: true } } },
    });
    const submissionByExamId = {};
    mySubmissions.forEach((s) => { submissionByExamId[s.examId] = s; });

    const examsWithStatus = exams.map((exam) => {
      const submission = submissionByExamId[exam.id];
      const answeredCount = submission ? submission.answers.length : 0;
      const totalQuestions = exam._count.questions;
      const hasPending = totalQuestions > 0 && answeredCount < totalQuestions;
      return {
        ...exam,
        answeredCount,
        hasPending,
        alreadyStarted: !!submission,
      };
    });

    return res.json({ exams: examsWithStatus });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not fetch exams.' });
  }
}

// STUDENT: get one exam's questions to take it (model answers stripped out - never
// sent to students). Also tells the frontend which questions this student has
// already answered, so the take-exam page can show only the new/unanswered ones.
async function getExamForStudent(req, res) {
  const { examId } = req.params;
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          select: { id: true, questionText: true, maxMarks: true, createdAt: true }, // no modelAnswer field
        },
      },
    });
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });

    const submission = await prisma.submission.findFirst({
      where: { examId, studentId: req.user.id },
      include: { answers: { select: { questionId: true } } },
    });

    const alreadyAnsweredQuestionIds = submission ? submission.answers.map((a) => a.questionId) : [];

    return res.json({ exam, alreadyAnsweredQuestionIds, hasPriorSubmission: !!submission });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not fetch exam.' });
  }
}

// TEACHER: delete one of their own exams, along with all its questions,
// submissions, and answers (SQLite doesn't cascade-delete automatically,
// so we remove child records first, then the exam itself).
async function deleteExam(req, res) {
  const { examId } = req.params;

  try {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });
    if (exam.teacherId !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete your own exams.' });
    }

    const submissions = await prisma.submission.findMany({
      where: { examId },
      select: { id: true },
    });
    const submissionIds = submissions.map((s) => s.id);

    await prisma.$transaction([
      prisma.answer.deleteMany({ where: { submissionId: { in: submissionIds } } }),
      prisma.submission.deleteMany({ where: { examId } }),
      prisma.question.deleteMany({ where: { examId } }),
      prisma.exam.delete({ where: { id: examId } }),
    ]);

    return res.json({ message: 'Exam deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not delete exam.' });
  }
}

// TEACHER: list every student who has submitted at least one of their exams,
// with how many exams they've taken and their average score.
async function getMyStudents(req, res) {
  try {
    const submissions = await prisma.submission.findMany({
      where: { exam: { teacherId: req.user.id } },
      include: { student: true },
    });

    const byStudent = {};
    submissions.forEach((sub) => {
      const id = sub.student.id;
      if (!byStudent[id]) {
        byStudent[id] = {
          id,
          name: sub.student.name,
          email: sub.student.email,
          examsTaken: 0,
          totalScore: 0,
        };
      }
      byStudent[id].examsTaken += 1;
      byStudent[id].totalScore += sub.totalScore || 0;
    });

    const students = Object.values(byStudent).map((s) => ({
      ...s,
      averageScore: s.examsTaken > 0 ? Math.round((s.totalScore / s.examsTaken) * 10) / 10 : 0,
    }));

    return res.json({ students });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not fetch students.' });
  }
}

// TEACHER: per-exam average score + submission counts, for a simple analytics chart.
async function getMyAnalytics(req, res) {
  try {
    const exams = await prisma.exam.findMany({
      where: { teacherId: req.user.id },
      include: { submissions: true },
    });

    const examStats = exams.map((exam) => {
      const scores = exam.submissions.map((s) => s.totalScore || 0);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return {
        examId: exam.id,
        title: exam.title,
        submissionCount: exam.submissions.length,
        averageScore: Math.round(avg * 10) / 10,
      };
    });

    const totalSubmissions = examStats.reduce((sum, e) => sum + e.submissionCount, 0);
    const overallAverage =
      examStats.length > 0
        ? Math.round((examStats.reduce((sum, e) => sum + e.averageScore * e.submissionCount, 0) / (totalSubmissions || 1)) * 10) / 10
        : 0;

    return res.json({ examStats, totalExams: exams.length, totalSubmissions, overallAverage });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not fetch analytics.' });
  }
}

// TEACHER: recent submissions across all their exams, used to power the
// notification bell (most recent student activity first).
async function getRecentSubmissions(req, res) {
  try {
    const submissions = await prisma.submission.findMany({
      where: { exam: { teacherId: req.user.id } },
      include: { student: true, exam: true },
      orderBy: { submittedAt: 'desc' },
      take: 10,
    });
    return res.json({ submissions });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not fetch recent activity.' });
  }
}

// TEACHER: build a per-student, per-subject marks report across all of
// their exams - i.e. "what has each student scored, broken down by subject."
async function getStudentReports(req, res) {
  try {
    const submissions = await prisma.submission.findMany({
      where: { exam: { teacherId: req.user.id } },
      include: {
        student: true,
        exam: { include: { questions: { select: { maxMarks: true } } } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const byStudent = {};

    submissions.forEach((sub) => {
      const studentId = sub.student.id;
      const maxPossible = sub.exam.questions.reduce((sum, q) => sum + q.maxMarks, 0);
      const score = sub.totalScore || 0;
      const percentage = maxPossible > 0 ? Math.round((score / maxPossible) * 1000) / 10 : 0;

      if (!byStudent[studentId]) {
        byStudent[studentId] = {
          studentId,
          name: sub.student.name,
          email: sub.student.email,
          subjects: {},
          allPercentages: [],
        };
      }

      const subject = sub.exam.subject;
      if (!byStudent[studentId].subjects[subject]) {
        byStudent[studentId].subjects[subject] = [];
      }

      byStudent[studentId].subjects[subject].push({
        examTitle: sub.exam.title,
        score,
        maxPossible,
        percentage,
        submittedAt: sub.submittedAt,
      });
      byStudent[studentId].allPercentages.push(percentage);
    });

    const students = Object.values(byStudent).map((s) => {
      const overallAverage =
        s.allPercentages.length > 0
          ? Math.round((s.allPercentages.reduce((a, b) => a + b, 0) / s.allPercentages.length) * 10) / 10
          : 0;
      const { allPercentages, ...rest } = s;
      return { ...rest, overallAverage };
    });

    // Highest average first
    students.sort((a, b) => b.overallAverage - a.overallAverage);

    return res.json({ students });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not build reports.' });
  }
}

module.exports = {
  createExamValidation,
  addQuestionValidation,
  createExam,
  addQuestion,
  listMyExams,
  getExamDetail,
  listAvailableExams,
  getExamForStudent,
  deleteExam,
  getMyStudents,
  getMyAnalytics,
  getRecentSubmissions,
  getStudentReports,
};
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const materialUpload = require('../middleware/materialUpload');
const {
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
} = require('../controllers/examController');
const {
  submitExam,
  getMySubmission,
  listMySubmissions,
  listExamSubmissions,
} = require('../controllers/submissionController');
const { uploadMaterial, listMaterials } = require('../controllers/materialsController');

const router = express.Router();

// Everything here requires the person to be logged in
router.use(requireAuth);

// --- Teacher-only routes ---
router.post('/', requireRole('TEACHER'), createExamValidation, createExam);
router.get('/mine', requireRole('TEACHER'), listMyExams);
router.get('/:examId/detail', requireRole('TEACHER'), getExamDetail);
router.post('/:examId/questions', requireRole('TEACHER'), addQuestionValidation, addQuestion);
router.get('/:examId/submissions', requireRole('TEACHER'), listExamSubmissions);
router.delete('/:examId', requireRole('TEACHER'), deleteExam);
router.get('/students', requireRole('TEACHER'), getMyStudents);
router.get('/analytics', requireRole('TEACHER'), getMyAnalytics);
router.get('/notifications', requireRole('TEACHER'), getRecentSubmissions);
router.get('/reports', requireRole('TEACHER'), getStudentReports);
router.post('/:examId/materials', requireRole('TEACHER'), materialUpload.single('file'), uploadMaterial);

// --- Student-only routes ---
router.get('/available', requireRole('STUDENT'), listAvailableExams);
router.get('/:examId/take', requireRole('STUDENT'), getExamForStudent);
// upload.any() parses the multipart/form-data body: it fills req.body with the
// non-file fields (like "answers", our JSON string) and req.files with any
// uploaded answer files, since each file field name is dynamic
// (`answerFile_<questionId>`) and not known ahead of time.
router.post('/:examId/submit', requireRole('STUDENT'), upload.any(), submitExam);
router.get('/submissions/mine', requireRole('STUDENT'), listMySubmissions);
router.get('/submissions/:submissionId', requireRole('STUDENT'), getMySubmission);

// --- Shared (either role, already logged in) ---
router.get('/:examId/materials', listMaterials);

module.exports = router;
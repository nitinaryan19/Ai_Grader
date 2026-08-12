const prisma = require('../config/db');

// TEACHER: upload a material file (notes, PDF, answer key, etc.) for one of
// their own exams.
async function uploadMaterial(req, res) {
  const { examId } = req.params;

  if (!req.file) {
    return res.status(400).json({ message: 'Please choose a file to upload.' });
  }

  try {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });
    if (exam.teacherId !== req.user.id) {
      return res.status(403).json({ message: 'You can only upload materials to your own exams.' });
    }

    // Build the full URL the file can be opened at, e.g.
    // http://localhost:5000/uploads/materials/173xxxxx.pdf
    const url = `${req.protocol}://${req.get('host')}/uploads/materials/${req.file.filename}`;

    const material = await prisma.material.create({
      data: {
        examId,
        filename: req.file.originalname,
        storedName: req.file.filename,
        url,
      },
    });

    return res.status(201).json({ message: 'Material uploaded', material });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not upload material.' });
  }
}

// Both TEACHER and STUDENT can view the materials list for an exam - students
// need it to study, teachers need it to see what they've already uploaded.
async function listMaterials(req, res) {
  const { examId } = req.params;

  try {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });

    const materials = await prisma.material.findMany({
      where: { examId },
      orderBy: { uploadedAt: 'desc' },
    });

    return res.json({ materials });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not fetch materials.' });
  }
}

module.exports = { uploadMaterial, listMaterials };
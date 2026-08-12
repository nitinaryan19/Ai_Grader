const prisma = require('../config/db');

// Creates a notification for a single user.
async function createNotification({ userId, message, examId = null }) {
  return prisma.notification.create({
    data: { userId, message, examId },
  });
}

// Creates the same notification for many users at once (e.g. every student
// who already submitted an exam that just got a new question added).
async function createNotificationForMany({ userIds, message, examId = null }) {
  if (!userIds || userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, message, examId })),
  });
}

module.exports = { createNotification, createNotificationForMany };
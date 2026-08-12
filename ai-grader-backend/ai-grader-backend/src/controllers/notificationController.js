const prisma = require('../config/db');

// Works for both roles - just returns whatever notifications belong to
// the logged-in user, most recent first.
async function listMyNotifications(req, res) {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user.id, read: false },
    });
    return res.json({ notifications, unreadCount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not fetch notifications.' });
  }
}

// Marks all of the logged-in user's notifications as read (called when they
// open the notifications panel).
async function markAllNotificationsRead(req, res) {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, read: false },
      data: { read: true },
    });
    return res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not update notifications.' });
  }
}

module.exports = { listMyNotifications, markAllNotificationsRead };
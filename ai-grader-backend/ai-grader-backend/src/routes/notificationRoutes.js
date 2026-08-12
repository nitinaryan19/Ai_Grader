const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { listMyNotifications, markAllNotificationsRead } = require('../controllers/notificationController');

const router = express.Router();

router.use(requireAuth);
router.get('/', listMyNotifications);
router.put('/mark-read', markAllNotificationsRead);

module.exports = router;
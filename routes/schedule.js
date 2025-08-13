const express = require('express');
const router = express.Router();
const scheduler = require('../scheduler');

/**
 * POST /api/schedule/schedule
 * Body: { 
 *   "type": "now" | "schedule", 
 *   "time": "HH:mm", 
 *   "date": "YYYY-MM-DD",
 *   "userId": "user-id",
 *   "message": "pre-generated message"
 * }
 */
router.post('/schedule', (req, res) => {
  const { type, time, date, userId, message } = req.body || {};

  try {
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!message) return res.status(400).json({ error: 'message is required' });

    if (type === 'now') {
      scheduler.runNow(userId, message);
      return res.json({ 
        success: true, 
        message: `Message sent immediately to user ${userId}`,
        userId,
        status: 'sent'
      });
    }
    if (type === 'schedule') {
      if (!time) return res.status(400).json({ error: 'time is required for scheduled jobs' });
      scheduler.scheduleAt(time, date, userId, message);
      return res.json({ 
        success: true, 
        message: `Message scheduled for user ${userId} at ${time}${date ? ' on ' + date : ' daily'}`,
        userId,
        status: 'scheduled',
        scheduledTime: time,
        scheduledDate: date
      });
    }
    return res.status(400).json({ error: "type must be 'now' or 'schedule'" });
  } catch (err) {
    scheduler.appendLog(`Error while scheduling job: ${err.message}`, req.body?.userId);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/schedule/logs  -> returns recent human-readable log lines for specific user or all users
router.get('/logs', (req, res) => {
  const { userId } = req.query;
  return res.json({ logs: scheduler.getLogs(userId) });
});

module.exports = router;

require('dotenv').config();
const cron = require('node-cron');
const automation = require('./automate');

// In-memory log store so admin UI can poll and display
const logs = [];

function appendLog(message, userId = null) {
  const userPrefix = userId ? `[User:${userId}] ` : '[All] ';
  const entry = `${new Date().toLocaleString()}  |  ${userPrefix}${message}`;
  console.log(entry);
  logs.push({
    timestamp: new Date().toISOString(),
    message: entry,
    userId: userId
  });
  // Keep last 500 entries to avoid unbounded memory growth
  if (logs.length > 500) logs.shift();
}

/**
 * Immediately triggers the existing automation flow.
 * @param {string} userId - User ID to target a specific user
 * @param {string} message - Pre-generated message to use
 */
function runNow(userId, message) {
  if (!userId || !message) {
    throw new Error('Both userId and message are required');
  }
  
  appendLog(`Manual execution triggered for user ${userId}`, userId);
  appendLog(`Using pre-generated message: ${message.substring(0, 50)}...`, userId);
  
  // Send the pre-generated message directly to the user
  const mockReq = { body: { driver_id: userId, message } };
  const mockRes = {
    json: data => {
      console.log('Notification sent:', data);
      appendLog(`Message sent successfully to user ${userId}`, userId);
    },
    status: code => ({
      json: data => {
        console.error(`Notification error (${code}):`, data);
        appendLog(`Failed to send message to user ${userId}: ${data?.error || 'Unknown error'}`, userId);
      }
    })
  };
  
  const notifyController = require('./controllers/notifyController');
  notifyController.sendNotification(mockReq, mockRes);
  appendLog('Manual execution completed', userId);
}

/**
 * Schedule a job at HH:mm (24-hour) daily or on a specific date.
 * @param {string} time  format "HH:mm"
 * @param {string|undefined} date optional "YYYY-MM-DD". If provided, the job will run only on that date.
 * @param {string} userId User ID to target
 * @param {string} message Message to send
 */
function scheduleAt(time, date, userId, message) {
  const [hour, minute] = time.split(':');
  if (hour === undefined || minute === undefined) {
    throw new Error('Invalid time format – expected HH:mm');
  }
  if (!userId || !message) {
    throw new Error('Both userId and message are required');
  }

  let cronExpr;
  if (date) {
    const [yyyy, mm, dd] = date.split('-');
    cronExpr = `${minute} ${hour} ${dd} ${mm} *`; // at given date
    appendLog(`Message scheduled for user ${userId} on ${date} at ${time}`, userId);
  } else {
    cronExpr = `${minute} ${hour} * * *`; // daily
    appendLog(`Daily message scheduled for user ${userId} at ${time}`, userId);
  }

  cron.schedule(cronExpr, () => {
    appendLog(`Scheduled message starting for user ${userId} (${date ? date : 'daily'}) ${time}`, userId);
    
    // Send the pre-generated message directly to the user
    const mockReq = { body: { driver_id: userId, message } };
    const mockRes = {
      json: data => {
        console.log('Scheduled notification sent:', data);
        appendLog(`Scheduled message sent successfully to user ${userId}`, userId);
      },
      status: code => ({
        json: data => {
          console.error(`Scheduled notification error (${code}):`, data);
          appendLog(`Failed to send scheduled message to user ${userId}: ${data?.error || 'Unknown error'}`, userId);
        }
      })
    };
    
    const notifyController = require('./controllers/notifyController');
    notifyController.sendNotification(mockReq, mockRes);
    appendLog('Scheduled job completed', userId);
  });
}

function getLogs(userId = null) {
  if (userId) {
    // Filter logs for specific user
    return logs
      .filter(log => log.userId === userId)
      .slice(-200)
      .map(log => log.message);
  }
  // Return all logs
  return logs.slice(-200).map(log => log.message);
}

module.exports = {
  runNow,
  scheduleAt,
  getLogs,
  appendLog
};

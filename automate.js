require('dotenv').config();
const cron = require('node-cron');
const axios = require('axios');
const { poolPromise, sql } = require('./db/sql');

// Controllers
const fitrockrController = require('./controllers/fitrockrController');
const messageController  = require('./controllers/messageController');
const notifyController   = require('./controllers/notifyController');

/**
 * Get yesterday’s and today’s dates in YYYY-MM-DD.
 */
function getDateRange() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const fmt = date => date.toISOString().split('T')[0];
  return { startDate: fmt(yesterday), endDate: fmt(today) };
}

/**
 * Store a single user’s health data in the health_data table.
 */
async function storeHealthData(userId, healthData) {
  try {
    console.log(`Storing health data for user ${userId}…`);
    const pool = await poolPromise;
    const request = pool.request();

    // Ensure table exists
    await request.query(`
      IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'health_data'
      )
      BEGIN
        CREATE TABLE health_data (
          id INT IDENTITY(1,1) PRIMARY KEY,
          userId VARCHAR(255) NOT NULL,
          date DATE NOT NULL,
          steps INT DEFAULT 0,
          calories INT DEFAULT 0,
          distance FLOAT DEFAULT 0,
          activeMinutes INT DEFAULT 0,
          sleepHours FLOAT DEFAULT 0,
          heartRate INT DEFAULT 0
        )
      END
    `);

    // Insert the row
    await pool.request()
      .input('userId',      sql.VarChar, userId)
      .input('date',        sql.Date,    new Date())
      .input('steps',       sql.Int,     healthData.steps       || 0)
      .input('calories',    sql.Int,     healthData.calories    || 0)
      .input('distance',    sql.Float,   healthData.distance    || 0)
      .input('activeMinutes', sql.Int,   healthData.activeMinutes || 0)
      .input('sleepHours',  sql.Float,   healthData.sleepHours  || 0)
      .input('heartRate',   sql.Int,     healthData.heartRate   || 0)
      .query(`
        INSERT INTO health_data 
          (userId, date, steps, calories, distance, activeMinutes, sleepHours, heartRate)
        VALUES 
          (@userId, @date, @steps, @calories, @distance, @activeMinutes, @sleepHours, @heartRate)
      `);

    console.log(`✅ Stored health data for user ${userId}.`);
    return true;

  } catch (err) {
    console.error(`❌ Error storing data for user ${userId}:`, err.message);
    return false;
  }
}

/**
 * Fetch users from Fitrockr and process each one’s data.
 */
async function fetchUsersAndHealthData() {
  try {
    console.log('Fetching users from Fitrockr…');
    const users = await new Promise((resolve, reject) => {
      const mockReq = {};
      const mockRes = {
        json: data => resolve(data),
        status: code => ({
          json: data => reject(new Error(`API ${code}: ${data?.message || 'Unknown'}`))
        })
      };
      fitrockrController.getUsers(mockReq, mockRes);
    });

    if (!Array.isArray(users) || users.length === 0) {
      console.log('❌ No users returned.');
      return;
    }
    console.log(`✅ Retrieved ${users.length} users.`);

    const { startDate, endDate } = getDateRange();
    console.log(`Processing health data from ${startDate} to ${endDate}…`);

    for (const user of users) {
      await processUserHealthData(user.id, startDate, endDate);
    }
    console.log('✅ All users processed.');

  } catch (err) {
    console.error('🚨 Error in fetchUsersAndHealthData:', err.message);
  }
}

/**
 * Process one user’s daily summary, store it, and notify.
 */
async function processUserHealthData(userId, startDate, endDate) {
  try {
    console.log(`\n-- Processing user ${userId} --`);
    console.log(`Fetching summary ${startDate} → ${endDate}…`);
    
    // Fetch daily summary
    const summaryResponse = await new Promise((resolve, reject) => {
      const mockReq = { params: { userId }, query: { startDate, endDate } };
      const mockRes = {
        json: data => resolve(data),
        status: code => ({
          json: data => reject(new Error(`API ${code}: ${data.error}`))
        })
      };
      fitrockrController.getDailySummary(mockReq, mockRes);
    });

    const entries = summaryResponse.content || summaryResponse;
    if (!Array.isArray(entries) || entries.length === 0) {
      console.log('❌ No summary entries found.');
      return;
    }
    console.log(`✅ ${entries.length} entries retrieved.`);

    // Filter & sort by date
    const filtered = entries
      .filter(e => {
        if (!e.date) return false;
        const d = `${e.date.year}-${String(e.date.month).padStart(2,'0')}-${String(e.date.day).padStart(2,'0')}`;
        return d >= startDate && d <= endDate;
      })
      .sort((a, b) => {
        const da = new Date(a.date.year, a.date.month - 1, a.date.day);
        const db = new Date(b.date.year, b.date.month - 1, b.date.day);
        return db - da;
      });

    if (filtered.length === 0) {
      console.log('❌ No entries within date range.');
      return;
    }

    const latest = filtered[0];
    console.log('Latest summary:', latest);

    // Build healthData object
    const healthData = {
      steps:           latest.steps           || 0,
      calories:        latest.calories        || 0,
      distance:        latest.distance        || 0,
      activeMinutes:   latest.activityMinutes || 0,
      sleepHours:      latest.sleepDuration ? latest.sleepDuration / 3600 : 0,
      heartRate:       latest.averageHeartRate || 0
    };

    // Skip if all zeros
    if (!Object.values(healthData).some(v => v > 0)) {
      console.log('⚠️ All metrics zero; skipping.');
      return;
    }

    // Store data
    const stored = await storeHealthData(userId, healthData);
    if (!stored) return;

    // Generate & send notification
    const message = await generatePersonalizedMessage(healthData);
    console.log('Message:', message);

    const notified = await sendUserNotification(userId, message);
    console.log(notified
      ? `✅ Notified user ${userId}.`
      : `❌ Notification failed for ${userId}.`
    );

  } catch (err) {
    console.error(`‼️ Error processing user ${userId}:`, err.stack);
  }
}

/**
 * Ask messageController to build a personalized message.
 */
async function generatePersonalizedMessage(healthData) {
  try {
    console.log('Generating personalized message…');
    const mockReq = { body: { healthData } };
    const response = await new Promise((resolve, reject) => {
      const mockRes = {
        json: data => resolve(data),
        status: code => ({ json: data => reject(new Error(`API ${code}: ${data.error}`)) })
      };
      messageController.generateMessage(mockReq, mockRes);
    });
    return response.message;
  } catch (err) {
    console.error('Error generating message:', err.message);
    return "Here's your daily health update!";
  }
}

/**
 * Ask notifyController to send a notification.
 */
async function sendUserNotification(userId, message) {
  console.log(`Sending notification to ${userId}…`);
  try {
    const mockReq = { body: { driver_id: userId, message } };
    await new Promise((resolve, reject) => {
      const mockRes = {
        json: data => resolve(data),
        status: code => ({ json: data => reject(new Error(`API ${code}: ${data.error}`)) })
      };
      notifyController.sendNotification(mockReq, mockRes);
    });
    return true;
  } catch (err) {
    console.error(`Notification error for ${userId}:`, err.message);
    return false;
  }
}

// -------------------------------------------------------------
// Public API: nothing executes on require()
// -------------------------------------------------------------
function runManually() {
  console.log('▶ Manually running health data pipeline…');
  fetchUsersAndHealthData();
}

/**
 * Process health data for a specific user.
 * @param {string} userId - The ID of the user to process
 */
async function processUserHealthData(userId) {
  try {
    console.log(`[${new Date().toISOString()}] [MANUAL] Starting manual execution for user ${userId}`);
    
    // Get user details
    const userResponse = await new Promise((resolve, reject) => {
      const mockReq = { params: { userId } };
      const mockRes = {
        json: data => resolve(data),
        status: code => ({
          json: data => reject(new Error(`API ${code}: ${data.error}`))
        })
      };
      fitrockrController.getUser(mockReq, mockRes);
    });
    
    if (!userResponse || !userResponse.name) {
      console.error(`[${new Date().toISOString()}] [MANUAL] User ${userId} not found or invalid response`);
      return;
    }
    
    const user = userResponse;
    console.log(`[${new Date().toISOString()}] [MANUAL] Processing user: ${user.name} (${userId})`);
    
    // Get daily summary for this user
    // Calculate date range for last 7 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];
    
    const summaryResponse = await new Promise((resolve, reject) => {
      const mockReq = { params: { userId }, query: { startDate: formattedStartDate, endDate: formattedEndDate } };
      const mockRes = {
        json: data => resolve(data),
        status: code => ({
          json: data => reject(new Error(`API ${code}: ${data.error}`))
        })
      };
      fitrockrController.getDailySummary(mockReq, mockRes);
    });
    
    const entries = summaryResponse.content || summaryResponse;
    if (!Array.isArray(entries) || entries.length === 0) {
      console.log(`[${new Date().toISOString()}] [MANUAL] No daily summary data for user ${userId}`);
      return;
    }
    
    // Filter and sort entries by date (newest first)
    const validEntries = entries
      .filter(entry => entry.date)
      .sort((a, b) => {
        const dateA = new Date(a.date.year, a.date.month - 1, a.date.day);
        const dateB = new Date(b.date.year, b.date.month - 1, b.date.day);
        return dateB - dateA;
      });
    
    if (validEntries.length === 0) {
      console.log(`[${new Date().toISOString()}] [MANUAL] No valid entries for user ${userId}`);
      return;
    }
    
    const latestEntry = validEntries[0];
    console.log(`[${new Date().toISOString()}] [MANUAL] Latest entry date: ${latestEntry.date.year}-${latestEntry.date.month}-${latestEntry.date.day}`);
    
    // Build health data object
    const healthData = {
      userId: userId,
      userName: user.name,
      steps: latestEntry.steps || 0,
      calories: latestEntry.calories || 0,
      distance: latestEntry.distance || 0,
      activeMinutes: latestEntry.activityMinutes || 0,
      sleepHours: latestEntry.sleepDuration ? latestEntry.sleepDuration / 3600 : 0,
      heartRate: latestEntry.averageHeartRate || 0,
      date: `${latestEntry.date.year}-${latestEntry.date.month}-${latestEntry.date.day}`
    };
    
    // Generate message
    const messageResponse = await new Promise((resolve) => {
      const mockReq = { body: { healthData } };
      const mockRes = { json: data => resolve(data) };
      messageController.generateMessage(mockReq, mockRes);
    });
    
    if (!messageResponse || !messageResponse.message) {
      console.error(`[${new Date().toISOString()}] [MANUAL] Failed to generate message for user ${userId}`);
      return;
    }
    
    // Send notification
    await notifyController.sendNotification({
      body: {
        driver_id: userId,
        message: messageResponse.message
      }
    }, {
      json: data => console.log(`[${new Date().toISOString()}] [MANUAL] Notification sent:`, data),
      status: code => ({
        json: data => console.error(`[${new Date().toISOString()}] [MANUAL] Notification error (${code}):`, data)
      })
    });
    
    console.log(`[${new Date().toISOString()}] [MANUAL] Manual execution completed for user ${userId}`);
    return messageResponse.message;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [MANUAL] Error during manual execution for user ${userId}:`, error);
    return null;
  }
}

function scheduleDaily() {
  cron.schedule('0 0 * * *', () => {
    console.log('⏰ Triggering scheduled health data processing…');
    fetchUsersAndHealthData();
  });
  console.log('✅ Scheduled daily job at 00:00.');
}

module.exports = {
  runManually,
  scheduleDaily,
  processUserHealthData
};

// If run directly, process once for testing:
if (require.main === module) {
  console.log('Standalone execution: processing now…');
  fetchUsersAndHealthData();
}

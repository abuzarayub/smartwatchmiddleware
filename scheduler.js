require('dotenv').config();
const cron = require('node-cron');
const automation = require('./automate');

// In-memory log store so admin UI can poll and display
const logs = [];

function appendLog(message, userId = null, type = 'info') {
  const userPrefix = userId ? `[User:${userId}] ` : '[All] ';
  const timestamp = new Date().toLocaleString();
  const entry = `${timestamp}  |  ${userPrefix}${message}`;
  
  console.log(entry);
  logs.push({
    timestamp: new Date().toISOString(),
    formattedTime: timestamp,
    message: entry,
    userId: userId,
    type: type
  });
  
  // Keep last 500 entries to avoid unbounded memory growth
  if (logs.length > 500) logs.shift();
}

/**
 * Immediately triggers the existing automation flow and stores the message in the chat database.
 * @param {string} userId - User ID to target a specific user
 * @param {string} message - Pre-generated message to use
 */
async function runNow(userId, message) {
  if (!userId || !message) {
    throw new Error('Both userId and message are required');
  }
  
  const timestamp = new Date().toLocaleString();
  
  appendLog(`Message sent immediately via Send Now button`, userId, 'send');
  appendLog(`Message content: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`, userId, 'content');
  appendLog(`Sent at: ${timestamp}`, userId, 'timestamp');
  
  try {
    // Store message in the chat database
    await storeMessageInChatSystem(userId, message);
    appendLog(`Message stored in chat database successfully`, userId, 'database');
    
    // Send the notification
    const mockReq = { body: { driver_id: userId, message } };
    const mockRes = {
      json: data => {
        console.log('Notification sent:', data);
        appendLog(`Notification sent via FCM token successfully`, userId, 'notification');
        appendLog(`FCM Response: ${JSON.stringify(data)}`, userId, 'fcm_response');
      },
      status: code => ({
        json: data => {
          console.error(`Notification error (${code}):`, data);
          appendLog(`Failed to send notification via FCM: ${data?.error || 'Unknown error'}`, userId, 'error');
        }
      })
    };
    
    const notifyController = require('./controllers/notifyController');
    notifyController.sendNotification(mockReq, mockRes);
    appendLog(`Message sending process completed`, userId, 'complete');
  } catch (error) {
    appendLog(`Error in runNow: ${error.message}`, userId, 'error');
    throw error;
  }
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

  const scheduledTime = date ? `${date} ${time}` : `Daily at ${time}`;
  const timestamp = new Date().toLocaleString();

  let cronExpr;
  if (date) {
    const [yyyy, mm, dd] = date.split('-');
    cronExpr = `${minute} ${hour} ${dd} ${mm} *`; // at given date
    appendLog(`Message scheduled for specific date`, userId, 'schedule');
    appendLog(`Scheduled for: ${scheduledTime}`, userId, 'schedule_detail');
  } else {
    cronExpr = `${minute} ${hour} * * *`; // daily
    appendLog(`Daily message scheduled`, userId, 'schedule');
    appendLog(`Scheduled for: ${scheduledTime}`, userId, 'schedule_detail');
  }

  appendLog(`Scheduled at: ${timestamp}`, userId, 'schedule_timestamp');
  appendLog(`Message content: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`, userId, 'schedule_content');

  cron.schedule(cronExpr, async () => {
    const executionTime = new Date().toLocaleString();
    appendLog(`Scheduled message execution started`, userId, 'schedule_execute');
    appendLog(`Executing at: ${executionTime}`, userId, 'schedule_execute_time');
    appendLog(`Original schedule: ${scheduledTime}`, userId, 'schedule_original');
    
    try {
      // Store message in the chat database
      await storeMessageInChatSystem(userId, message);
      appendLog(`Scheduled message stored in chat database successfully`, userId, 'schedule_database');
      
      // For scheduled messages, we log them as sent messages that will appear in chat
      appendLog(`Scheduled message ready for delivery`, userId, 'schedule_ready');
      appendLog(`Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`, userId, 'schedule_message');
      
      // Send the notification
      const mockReq = { body: { driver_id: userId, message } };
      const mockRes = {
        json: data => {
          console.log('Scheduled notification sent:', data);
          appendLog(`Scheduled message sent successfully via FCM`, userId, 'schedule_sent');
          appendLog(`FCM Response: ${JSON.stringify(data)}`, userId, 'schedule_fcm_response');
          appendLog(`Message delivered at: ${new Date().toLocaleString()}`, userId, 'schedule_delivery');
        },
        status: code => ({
          json: data => {
            console.error(`Scheduled notification error (${code}):`, data);
            appendLog(`Failed to send scheduled message via FCM: ${data?.error || 'Unknown error'}`, userId, 'schedule_error');
            appendLog(`Error occurred at: ${new Date().toLocaleString()}`, userId, 'schedule_error_time');
          }
        })
      };
      
      const notifyController = require('./controllers/notifyController');
      notifyController.sendNotification(mockReq, mockRes);
      appendLog(`Scheduled message process completed`, userId, 'schedule_complete');
    } catch (error) {
      appendLog(`Error in scheduled execution: ${error.message}`, userId, 'schedule_error');
    }
  });
}

function getLogs(userId = null) {
  if (userId) {
    // Filter logs for specific user and return array of strings
    return logs
      .filter(log => log.userId === userId)
      .slice(-200)
      .map(log => log.message);
  }
  // Return all logs as array of strings
  return logs.slice(-200).map(log => log.message);
}

/**
 * Stores a message in the chat system database using the same approach as the chat system.
 * @param {string} userId - User ID to target a specific user
 * @param {string} message - Message to store
 */
async function storeMessageInChatSystem(userId, message) {
  try {
    const axios = require('axios');
    const { getUserById } = require('./utils/userUtils');
    
    // Get user data to find the room ID
    const userData = await getUserById(userId);
    if (!userData) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Get admin ID (system user ID) for the room
     const adminId = process.env.SYSTEM_ADMIN_ID || 50; // Default to 50 if not set (admin@gmail.com)
    
    // Find or create room
    let roomId;
    try {
      // Try to find existing room
       const backendUrl = 'https://amployee-api-bdcwgrhvf3dxdpfs.westeurope-01.azurewebsites.net';
       const findRoomResponse = await axios.post(
         `${backendUrl}/api/v1/chat/find-room`,
         { userId: userData.id, adminId },
         { headers: { 'Content-Type': 'application/json' } }
       );
       roomId = findRoomResponse.data.data;
       
       if (!roomId) {
         // Create new room if not found
         const createRoomResponse = await axios.post(
           `${backendUrl}/api/v1/chat/join-chat`,
           { userId: userData.id, adminId },
           { headers: { 'Content-Type': 'application/json' } }
         );
        roomId = createRoomResponse.data.data.id;
      }
    } catch (error) {
      console.error('Error finding/creating room:', error.message);
      throw new Error(`Failed to find or create chat room: ${error.message}`);
    }
    
    if (!roomId) {
      throw new Error('Failed to determine room ID for message storage');
    }
    
    // Store message in the chat system
     const sendMessageResponse = await axios.post(
       `${backendUrl}/api/v1/chat/send-message`,
       { 
         roomId, 
         messageBody: message,
         senderId: adminId
       },
       { headers: { 'Content-Type': 'application/json' } }
     );
    
    return sendMessageResponse.data;
  } catch (error) {
    console.error('Error storing message in chat system:', error.message);
    throw error;
  }
}

module.exports = {
  runNow,
  scheduleAt,
  getLogs,
  appendLog,
  storeMessageInChatSystem
};

const axios = require('axios');
const { getUserById } = require('../utils');

const AUTH_URL = 'https://amployee-api-bdcwgrhvf3dxdpfs.westeurope-01.azurewebsites.net/api/v1/auth/login';
const NOTIFY_URL = process.env.INTERNAL_API_URL;

exports.sendNotification = async (req, res) => {
  const { driver_id, message } = req.body;

  console.log(`[NotifyController] driver_id: ${driver_id}`);
  console.log(`[NotifyController] message: ${message}`);
  
  // Get user data to ensure we have the correct FCM token
  let userData = null;
  try {
    userData = await getUserById(driver_id);
    if (userData) {
      console.log(`[NotifyController] Found user data for driver_id ${driver_id}`);
      // If the request doesn't include a message, we can use user data to personalize one
      if (!message && userData.full_name) {
        req.body.message = `Hello ${userData.full_name}, here's your daily health update!`;
      }
    } else {
      console.warn(`[NotifyController] No user data found for driver_id ${driver_id}`);
    }
  } catch (error) {
    console.error(`[NotifyController] Error fetching user data: ${error.message}`);
    // Continue with the notification process even if user data lookup fails
  }
  console.log(`[NotifyController] AUTH_URL: ${AUTH_URL}`);
  console.log(`[NotifyController] NOTIFY_URL: ${NOTIFY_URL}`);

  try {
    // 1️⃣ Authenticate to get a fresh JWT
    const authResponse = await axios.post(
      AUTH_URL,
      { email: 'admin@gmail.com', password: 'admin' },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const token = authResponse.data?.data?.token;
    console.log(`[NotifyController] Fetched token: ${token?.slice(0, 20)}…`);

    if (!token) {
      throw new Error('Authentication succeeded but no token was returned.');
    }

    // 2️⃣ Send the notification using the new JWT
    console.log(`[NotifyController] Sending notification body: ${JSON.stringify({ driver_id, message })}`);
    const notifyResponse = await axios.post(
      NOTIFY_URL,
      { driver_id, message },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(
      `[NotifyController] Notification sent to ${driver_id}.`,
      notifyResponse.data
    );
    return res.json({ success: true, data: notifyResponse.data });
  } catch (error) {
    // Determine whether it was an auth error or notify error
    if (error.response) {
      console.error(
        `[NotifyController] Error (status ${error.response.status}):`,
        error.response.data || error.message
      );
      return res
        .status(error.response.status)
        .json({ error: error.message, details: error.response.data });
    } else {
      console.error('[NotifyController] Unexpected error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }
};


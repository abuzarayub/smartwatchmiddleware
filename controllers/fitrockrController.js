const axios = require('axios');
const { getMsFitIdByUserId } = require('../utils');

// Fitrockr API configuration
const FITROCKR_BASE_URL = 'https://api-02.fitrockr.com/v1/users';
const headers = {
  'Content-Type': 'application/json',
  'X-Tenant': process.env.FITROCKR_TENANT || 'apployeenl',
  'X-API-Key': process.env.FITROCKR_API_KEY || '6f5d8c4e-7b22-4751-af5a-edd8658d5ed3'
};

// GET /users
const getUsers = async (req, res) => {
  try {
    console.log('Fetching all users from Fitrockr...');
    const { data: users } = await axios.get(`${FITROCKR_BASE_URL}?page=0&size=100`, { headers });

    if (Array.isArray(users) && users.length) {
      console.log(`✅ Retrieved ${users.length} users.`);
      return res.json(users);
    }

    console.warn('⚠️ No users found.');
    return res.status(404).json({ message: 'No users found.' });

  } catch (err) {
    console.error('❌ Error fetching users:', err.response?.status, err.response?.data || err.message);
    return res.status(err.response?.status || 500).json({
      message: err.message,
      details: err.response?.data || 'Unknown error'
    });
  }
};

// GET /users/:userId
const getUser = async (req) => {
  const { userId } = req.params;
  let idStr;
  
  // Try to get user_id from database if this is a user_id
  try {
    console.log(`Attempting to look up user_id for user_id ${userId}...`);
    const msFitId = await getMsFitIdByUserId(userId);
    if (msFitId) {
      console.log(`✅ Found user_id ${msFitId} for user_id ${userId}`);
      idStr = String(msFitId);
    } else {
      // If not found in database, use the provided ID directly
      console.log(`⚠️ No user_id found for user_id ${userId}, using provided ID directly`);
      idStr = String(userId);
    }
  } catch (error) {
    // If there's an error with the database lookup, use the provided ID directly
    console.log(`❌ Error looking up user_id for user_id ${userId}: ${error.message}`);
    idStr = String(userId);
    console.log(`Fetching all users to find ID ${userId}...`);
  }

  try {
    console.log(`Fetching all users to find ID ${idStr}...`);
    const resp = await axios.get(`${FITROCKR_BASE_URL}?page=0&size=100`, { headers });

    // Defensive: normalize payload to an array of users
    const payload = resp?.data;
    const users = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.content)
      ? payload.content
      : Array.isArray(payload?.data)
      ? payload.data
      : [];

    console.log("all users count:", users.length);
    
    // Log all user IDs to help with debugging
    console.log("All user IDs in Fitrockr:", users.map(u => ({ id: u?.id, name: u?.firstName })));
    // Compare as strings so mixed types won't break the find
    const user = users.find(u => String(u?.id) === idStr);

    if (user) {
      console.log(`✅ User ${idStr} found:`, user);
      return { data: user };
    }

    console.warn(`⚠️ User ${idStr} not found.`);

    // Create an error object that includes a `response` property so
    // callers that access err.response.status won't throw.
    const notFoundErr = new Error(`No user found with ID ${idStr}.`);
    notFoundErr.response = { status: 404, data: { message: `No user found with ID ${idStr}` } };
    throw notFoundErr;

  } catch (err) {
    // Ensure err.response exists so downstream handlers that read
    // err.response.status won't crash with "Cannot read properties of undefined".
    if (!err || typeof err !== 'object') {
      const wrapper = new Error(String(err));
      wrapper.response = { status: 500, data: String(err) };
      throw wrapper;
    }

    if (!err.response) {
      // If this was an axios/network error without response, provide a safe shape
      err.response = { status: 500, data: err.message || 'Unknown error' };
    }

    console.error(`❌ Error fetching user ${idStr}:`, err.response.status, err.response.data);
    throw err;
  }
};
// GET /users/:userId/dailySummaries



const getDailySummary = async (req) => {
  const userId = req.params.userId;
  const { startDate, endDate } = req.query;

  try {
    const url = `https://api-02.fitrockr.com/v1/users/${userId}/dailySummaries?startDate=${startDate}&endDate=${endDate}`;
    const response = await axios.get(url, { headers });

    const summary = response.data;
    if (summary) {
      console.log(`✅ Summary found for user ${userId} content is ${JSON.stringify(summary)}`);
      return summary;
    } else {
      console.warn(`⚠️ No summary found for user ${userId}`);
      throw new Error("No summary found.");
    }

  } catch (error) {
    // Ensure error.response exists so downstream handlers that read
    // error.response.status won't crash with "Cannot read properties of undefined".
    if (!error || typeof error !== 'object') {
      const wrapper = new Error(String(error));
      wrapper.response = { status: 500, data: String(error) };
      throw wrapper;
    }

    if (!error.response) {
      // If this was an axios/network error without response, provide a safe shape
      error.response = { status: 500, data: error.message || 'Unknown error' };
    }

    console.error('❌ Fitrockr dailySummary error:', error.response.status, error.response.data);
    throw error;
  }

};




module.exports = {
  getUsers,
  getUser,
  getDailySummary
};

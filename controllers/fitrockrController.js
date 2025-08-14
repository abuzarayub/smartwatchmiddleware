const axios = require('axios');

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

  try {
    console.log(`Fetching all users to find ID ${userId}...`);
    const { data: users } = await axios.get(`${FITROCKR_BASE_URL}?page=0&size=100`, { headers });
console.log("all users ", users);

    const user = users.find(u => u.id === userId);

    if (user) {
      console.log(`✅ User ${userId} found:`, user);
      return { data: user };
    }

    console.warn(`⚠️ User ${userId} not found.`);
    throw new Error(`No user found with ID ${userId}.`);

  } catch (err) {
    console.error(`❌ Error fetching user ${userId}:`, err.response?.status, err.response?.data || err.message);
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
    console.error('❌ Fitrockr dailySummary error:', error.response?.status, error.response?.data);
    throw error;
  }

};




module.exports = {
  getUsers,
  getUser,
  getDailySummary
};

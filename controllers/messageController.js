const axios = require('axios');

/**
 * Generate a personalized coaching message based on health data.
 */
const generateMessage = async (req, res) => {
  console.log(`[${new Date().toISOString()}] [MESSAGE] generateMessage request received: ${JSON.stringify(req.body)}`);
  const { healthData } = req.body;
  const prompt = `Based on this health data, generate a personalized coaching message in dutch languages and dont include "hi" , "hello" greeting words in starting instead directly give coaching message and dont include any characters or quotation marks:\n${JSON.stringify(healthData)}`; 


  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const message = response.data.choices[0].message.content;
    res.json({ message });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [MESSAGE] Error in generateMessage: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Generate a personalized coaching message for a specific user by ID.
 * This function fetches the user's data and health summary from Fitrockr,
 * then generates a personalized message.
 */
const generateMessageByUserId = async (req, res) => {
  const userId = req.query.userId;
  console.log(`[${new Date().toISOString()}] [MESSAGE] generateMessageByUserId request received for userId: ${userId}`);
 
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    // Get date range for yesterday and today
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const fmt = date => date.toISOString().split('T')[0];
    const startDate = fmt(yesterday);
    const endDate = fmt(today);

    // Fetch user info to get name
    console.log(`Fetching user info for userId: ${userId}`);
    const userResponse = await axios.get('https://api-02.fitrockr.com/v1/users', {
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant': process.env.FITROCKR_TENANT,
        'X-API-Key': process.env.FITROCKR_API_KEY
      }
    });

    // Find the user with matching ID
    const user = userResponse.data.find(u => u.id === userId);
    const userName = user ? (user.firstName || 'there') : 'there';

    // Fetch health data summary
    console.log(`Fetching health data for userId: ${userId}`);
    const summaryUrl = `https://api-02.fitrockr.com/v1/users/${userId}/dailySummaries?startDate=${startDate}&endDate=${endDate}`;
    const summaryResponse = await axios.get(summaryUrl, {
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant': process.env.FITROCKR_TENANT,
        'X-API-Key': process.env.FITROCKR_API_KEY
      }
    });

    const entries = summaryResponse.data.content || summaryResponse.data;
    
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.json({ message: `Hi ${userName}! I don't have any recent health data for you. Keep up the good work!` });
    }

    // Filter & sort by date to get the latest entry
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
      return res.json({ message: `Hi ${userName}! I don't have any recent health data for you. Keep up the good work!` });
    }

    const latest = filtered[0];

    // Build healthData object
    const healthData = {
      steps:           latest.steps           || 0,
      calories:        latest.calories        || 0,
      distance:        latest.distance        || 0,
      activeMinutes:   latest.activityMinutes || 0,
      sleepHours:      latest.sleepDuration ? latest.sleepDuration / 3600 : 0,
      heartRate:       latest.averageHeartRate || 0
    };

    // Generate personalized message
    const prompt = `Generate a personalized health coaching message for ${userName} based on this health data:\n${JSON.stringify(healthData)}. Start with "Hi ${userName}" and keep it motivational and concise.`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const message = response.data.choices[0].message.content;
    res.json({ message });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [MESSAGE] Error in generateMessageByUserId for userId ${userId}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  generateMessage,
  generateMessageByUserId
};

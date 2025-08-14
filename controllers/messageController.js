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
  const userId = req.params.userId || req.query.userId;
  console.log(`[${new Date().toISOString()}] [MESSAGE] Received request to generate message for userId: ${userId}`);

  if (!userId) {
    console.error(`[${new Date().toISOString()}] [ERROR] userId is missing in request`);
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    // Date range for yesterday and today
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const fmt = date => date.toISOString().split('T')[0];
    const startDate = fmt(yesterday);
    const endDate = fmt(today);
    console.log(`[${new Date().toISOString()}] [INFO] Date range set: ${startDate} to ${endDate}`);

    // Fetch user info using fitrockrController
    console.log(`[${new Date().toISOString()}] [INFO] Fetching user info for userId: ${userId}`);
    const { getUser } = require('./fitrockrController');
    const userResponse = await getUser({ params: { userId } });
    const user = userResponse.data;

    const userName = user.firstName || 'there';
    console.log(`[${new Date().toISOString()}] [INFO] User found: ${userName}`);

    // Fetch health data using fitrockrController
    console.log(`[${new Date().toISOString()}] [INFO] Fetching health data for userId: ${userId}`);
    const { getDailySummary } = require('./fitrockrController');
    const entries = await getDailySummary({
      params: { userId },
      query: { startDate, endDate }
    });

    // Filter and sort entries
    const filtered = entries
      .filter(e => {
        if (!e.date) return false;
        const d = `${e.date.year}-${String(e.date.month).padStart(2, '0')}-${String(e.date.day).padStart(2, '0')}`;
        return d >= startDate && d <= endDate;
      })
      .sort((a, b) => {
        const da = new Date(a.date.year, a.date.month - 1, a.date.day);
        const db = new Date(b.date.year, b.date.month - 1, b.date.day);
        return db - da;
      });

    if (filtered.length === 0) {
      console.warn(`[${new Date().toISOString()}] [WARNING] No recent health data found for user ${userId}`);
      return res.json({
        message: null,
        hasFitrockerData: false,
        fitrockerData: null,
        error: "No recent health data available"
      });
    }

    const latest = filtered[0];
    console.log(`[${new Date().toISOString()}] [INFO] Latest health data retrieved:`, latest);

    // Build health data object
    const healthData = {
      steps: latest.steps || 0,
      calories: latest.calories || 0,
      distance: latest.distance || 0,
      activeMinutes: latest.activityMinutes || 0,
      sleepHours: latest.sleepDuration ? latest.sleepDuration / 3600 : 0,
      heartRate: latest.averageHeartRate || 0
    };
    console.log(`[${new Date().toISOString()}] [INFO] Health data structured:`, healthData);

    // Human-readable format
    const humanReadableData = {
      steps: `${healthData.steps} steps`,
      calories: `${healthData.calories} calories burned`,
      distance: `${(healthData.distance / 1000).toFixed(2)} km`,
      activeMinutes: `${healthData.activeMinutes} active minutes`,
      sleepHours: `${healthData.sleepHours.toFixed(1)} hours of sleep`,
      heartRate: `${healthData.heartRate} bpm average heart rate`,
      date: `${latest.date.year}-${String(latest.date.month).padStart(2, '0')}-${String(latest.date.day).padStart(2, '0')}`
    };
    console.log(`[${new Date().toISOString()}] [INFO] Human-readable health data:`, humanReadableData);

    // Generate personalized message
    const prompt = `Generate a personalized health coaching message for ${userName} based on this health data:\n${JSON.stringify(healthData)}. Dont Start with Greeting but include his name ${userName}" and keep it motivational and concise and it should be in dutch language not in english and dont include any characters or quotation marks in the message.`;
    console.log(`[${new Date().toISOString()}] [INFO] Generated prompt for OpenAI API`);

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
    console.log(`[${new Date().toISOString()}] [INFO] Received message from OpenAI API`);

    res.json({
      message,
      hasFitrockerData: true,
      fitrockerData: humanReadableData
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [ERROR] Error in generateMessageByUserId for userId ${userId}: ${error.message}`);
    let errorMessage = error.message;
    let statusCode = 500;

    if (error.message.includes("No user found")) {
      errorMessage = "User not registered on Fitrocker";
      statusCode = 404;
    } else if (error.message.includes("No summary found")) {
      errorMessage = "No health data available";
      statusCode = 404;
    }

    res.status(statusCode).json({
      message: null,
      hasFitrockerData: false,
      fitrockerData: null,
      error: errorMessage
    });
  }
};


module.exports = {
  generateMessage,
  generateMessageByUserId
};

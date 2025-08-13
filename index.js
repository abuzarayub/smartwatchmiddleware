require('dotenv').config();
console.log(`[${new Date().toISOString()}] [INIT] Loaded environment variables from .env`);

const express = require('express');
const cors = require('cors');
const app=express();
console.log(`[${new Date().toISOString()}] [INIT] Imported Express module`);

const bodyParser = require('body-parser');
console.log(`[${new Date().toISOString()}] [INIT] Imported body-parser module`);

// Initialize Express app\ nconst app = express();
console.log(`[${new Date().toISOString()}] [INIT] Express app initialized`);

// Import automation module
console.log(`[${new Date().toISOString()}] [INIT] Requiring automation module`);
const automation = require('./automate');
console.log(`[${new Date().toISOString()}] [INIT] Automation module loaded`);

// Import route modules
console.log(`[${new Date().toISOString()}] [INIT] Loading route module: fitrockr`);
const fitrockrRoutes = require('./routes/fitrockr');
console.log(`[${new Date().toISOString()}] [INIT] fitrockr route module loaded`);

console.log(`[${new Date().toISOString()}] [INIT] Loading route module: message`);
const messageRoutes = require('./routes/message');
console.log(`[${new Date().toISOString()}] [INIT] message route module loaded`);

console.log(`[${new Date().toISOString()}] [INIT] Loading route module: notify`);
const notifyRoutes = require('./routes/notify');
console.log(`[${new Date().toISOString()}] [INIT] notify route module loaded`);

console.log(`[${new Date().toISOString()}] [INIT] Loading route module: schedule`);
const scheduleRoutes = require('./routes/schedule');
console.log(`[${new Date().toISOString()}] [INIT] schedule route module loaded`);

// Middleware: request logging\ nconsole.log(`[${new Date().toISOString()}] [INIT] Setting up request-logging middleware`);
app.use((req, res, next) => {
  console.log(`
[${new Date().toISOString()}] [REQUEST] ${req.method} ${req.url}`);
  next();
});

// Middleware: JSON body parsing
console.log(`[${new Date().toISOString()}] [INIT] Adding JSON body-parser middleware`);
app.use(bodyParser.json());

// Enable CORS for all origins
console.log(`[${new Date().toISOString()}] [INIT] Enabling CORS for all origins`);
app.use(cors());

// Mount routes with logging
console.log(`[${new Date().toISOString()}] [INIT] Mounting fitrockr routes at /api/fitrockr`);
app.use('/api/fitrockr', fitrockrRoutes);

console.log(`[${new Date().toISOString()}] [INIT] Mounting message routes at /api/message`);
app.use('/api/message', messageRoutes);

console.log(`[${new Date().toISOString()}] [INIT] Mounting notify routes at /api/notify`);
app.use('/api/notify', notifyRoutes);

console.log(`[${new Date().toISOString()}] [INIT] Mounting schedule routes at /api/schedule`);
app.use('/api/schedule', scheduleRoutes);

// Health check endpoint with logging
console.log(`[${new Date().toISOString()}] [INIT] Setting up health-check endpoint at '/'`);
app.get('/', (req, res) => {
  console.log(`[${new Date().toISOString()}] [HANDLER] GET / called`);
  res.send('Smartwatch Coaching API Running');
});

// Start server
const PORT = process.env.PORT || 3000;
console.log(`[${new Date().toISOString()}] [INIT] About to start server on port ${PORT}`);
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] [START] Server running on port ${PORT}`);
  
  // Check if automation should be started with the server
  console.log(`[${new Date().toISOString()}] [CHECK] START_AUTOMATION=${process.env.START_AUTOMATION}`);
  if (process.env.START_AUTOMATION === 'true') {
    console.log(`[${new Date().toISOString()}] [AUTO] Starting automated health data processing`);
    automation.runManually();
    console.log(`[${new Date().toISOString()}] [AUTO] Automated scheduling is active. Will run daily at midnight.`);
  } else {
    console.log(`[${new Date().toISOString()}] [AUTO] START_AUTOMATION not enabled; skipping automation startup`);
  }
});

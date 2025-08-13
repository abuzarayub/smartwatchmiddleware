#!/usr/bin/env node

/**
 * This is a standalone script to run the automation process.
 * It can be used with process managers like PM2 for production deployment.
 * 
 * Example PM2 command:
 * pm2 start run-automation.js --name "smartwatch-automation"
 */

require('dotenv').config();
const automation = require('./automate');

console.log('Starting Smartwatch Health Coach automation as a standalone process');
console.log('Automated scheduling is active. Will run daily at midnight.');

// The automation module will handle the scheduling
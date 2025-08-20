/**
 * Utils Index
 * 
 * This file exports all utility functions from the utils directory
 * for easier importing across the application.
 */

const userUtils = require('./userUtils');

module.exports = {
  ...userUtils
};
/**
 * User Utility Functions
 * 
 * This module provides utility functions for user data operations,
 * specifically for retrieving and validating user information from the database.
 */

const { poolPromise } = require('../db/sql');

/**
 * Validates a user ID format
 * 
 * @param {string|number} userId - The user ID to validate
 * @returns {boolean} - True if the ID is valid, false otherwise
 */
const validateUserId = (userId) => {
  // If userId is not provided, it's invalid
  if (userId === undefined || userId === null) {
    console.log(`❌ validateUserId: userId is undefined or null`);
    return false;
  }
  
  // Convert to string if it's not already
  const userIdStr = String(userId);
  
  // Check if it's a MongoDB ObjectId (24-character hex string)
  const mongoIdRegex = /^[0-9a-fA-F]{24}$/;
  if (mongoIdRegex.test(userIdStr)) {
    console.log(`✅ validateUserId: Valid MongoDB ObjectId format: ${userIdStr}`);
    return true;
  }
  
  // For other formats, just ensure it's not empty
  if (userIdStr.trim() === '') {
    console.log(`❌ validateUserId: userId is empty string`);
    return false;
  }
  
  console.log(`⚠️ validateUserId: Non-standard ID format: ${userIdStr}, but accepting it`);
  return true;
};

/**
 * Retrieves a user's user_id by their user ID
 * 
 * @param {string|number} userId - The user ID to search for
 * @returns {Promise<string|null>} - The user_id if found, null otherwise
 * @throws {Error} - If there's a database error or validation fails
 */
const getMsFitIdByUserId = async (userId) => {
  console.log(`🔍 getMsFitIdByUserId: Looking up user_id for user ${userId}`);
  
  // For numeric IDs, try to get user by ID field first
  if (!isNaN(userId) && String(userId).trim() !== '') {
    try {
      const numericId = Number(userId);
      console.log(`🔢 getMsFitIdByUserId: Treating ${userId} as numeric ID`);
      const user = await getUserByNumericId(numericId);
      if (user && user.user_id) {
        console.log(`✅ getMsFitIdByUserId: Found user_id ${user.user_id} for numeric ID ${userId}`);
        return user.user_id;
      }
    } catch (error) {
      console.log(`⚠️ getMsFitIdByUserId: Error looking up by numeric ID, will try as user_id: ${error.message}`);
    }
  }
  
  // Validate the user ID for MongoDB format
  if (!validateUserId(userId)) {
    console.error(`❌ getMsFitIdByUserId: Invalid user ID format: ${userId}`);
    throw new Error(`Invalid user ID format: ${userId}`);
  }

  try {
    // Get the connection pool
    const pool = await poolPromise;
    
    // Query the database for the user with the given ID
    const result = await pool.request()
      .input('userId', userId)
      .query('SELECT * FROM dbo.Users WHERE user_id = @userId');
    
    // Check if user was found
    if (result.recordset.length === 0) {
      return null;
    }
    
    // Return the user_id
    const user = result.recordset[0];
    return user.user_id;
  } catch (error) {
    console.error(`❌ Error retrieving user_id for user ${userId}:`, error);
    throw new Error(`Failed to retrieve user data: ${error.message}`);
  }
};

/**
 * Retrieves user data by numeric ID
 * 
 * @param {number} id - The numeric ID to search for
 * @returns {Promise<Object|null>} - The user object if found, null otherwise
 * @throws {Error} - If there's a database error
 */
const getUserByNumericId = async (id) => {
  console.log(`🔍 getUserByNumericId: Looking up user with numeric ID ${id}`);
  try {
    // Get the connection pool
    const pool = await poolPromise;
    
    // Query the database for the user with the given numeric ID
    const result = await pool.request()
      .input('id', id)
      .query('SELECT * FROM dbo.Users WHERE id = @id');
    
    // Check if user was found
    if (result.recordset.length === 0) {
      console.log(`⚠️ getUserByNumericId: No user found with ID ${id}`);
      return null;
    }
    
    // Return the user object
    console.log(`✅ getUserByNumericId: Found user with ID ${id}`);
    return result.recordset[0];
  } catch (error) {
    console.error(`❌ getUserByNumericId: Error retrieving user with ID ${id}:`, error);
    throw new Error(`Failed to retrieve user data by numeric ID: ${error.message}`);
  }
};

/**
 * Retrieves full user data by their user ID
 * 
 * @param {string|number} userId - The user ID to search for
 * @returns {Promise<Object|null>} - The user object if found, null otherwise
 * @throws {Error} - If there's a database error or validation fails
 */
const getUserById = async (userId) => {
  console.log(`🔍 getUserById: Looking up user with ID ${userId}`);
  
  // For numeric IDs, try to get user by ID field first
  if (!isNaN(userId) && String(userId).trim() !== '') {
    try {
      const numericId = Number(userId);
      console.log(`🔢 getUserById: Treating ${userId} as numeric ID`);
      const user = await getUserByNumericId(numericId);
      if (user) {
        return user;
      }
    } catch (error) {
      console.log(`⚠️ getUserById: Error looking up by numeric ID, will try as user_id: ${error.message}`);
    }
  }
  
  // Validate the user ID for MongoDB format if it's not a numeric ID
  if (!validateUserId(userId)) {
    console.error(`❌ getUserById: Invalid user ID format: ${userId}`);
    throw new Error(`Invalid user ID format: ${userId}`);
  }

  try {
    // Get the connection pool
    const pool = await poolPromise;
    
    // Query the database for the user with the given ID
    const result = await pool.request()
      .input('userId', userId)
      .query('SELECT * FROM dbo.Users WHERE user_id = @userId');
    
    // Check if user was found
    if (result.recordset.length === 0) {
      return null;
    }
    
    // Return the user object
    return result.recordset[0];
  } catch (error) {
    console.error(`❌ Error retrieving user ${userId}:`, error);
    throw new Error(`Failed to retrieve user data: ${error.message}`);
  }
};

module.exports = {
  validateUserId,
  getMsFitIdByUserId,
  getUserById,
  getUserByNumericId
};
/**
 * ====================================
 * LogHawk – Database Configuration
 * ====================================
 * config/db.js
 * 
 * MongoDB connection handler using Mongoose.
 * Establishes and manages the database connection lifecycle.
 */

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`📦 MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

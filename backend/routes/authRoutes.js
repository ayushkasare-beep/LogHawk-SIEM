/**
 * ====================================
 * LogHawk – Auth Routes
 * ====================================
 * routes/authRoutes.js
 */

const express = require('express');
const router = express.Router();
const {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  getMe,
  changePassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public Auth Endpoints
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Private Auth Endpoints (require JWT token protection)
router.get('/me', protect, getMe);
router.patch('/me/password', protect, changePassword);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);

module.exports = router;

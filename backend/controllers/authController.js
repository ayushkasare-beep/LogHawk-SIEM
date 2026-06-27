/**
 * ====================================
 * LogHawk – Auth Controller
 * ====================================
 * controllers/authController.js
 * 
 * Handles user registration, login, logout, password resets,
 * and profile management.
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

// Helper to validate password complexity
const validatePasswordStrength = (password) => {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return 'Password must contain at least one special character';
  }
  return null; // Strong
};

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new analyst account
 * @access  Public
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const username = req.body.username || name;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required' });
    }

    // Password strength check
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: 'An account with this username already exists' });
    }

    const user = await User.create({
      username,
      email,
      passwordHash: password,
    });

    res.status(201).json({
      message: 'Account created successfully. Please log in to continue.',
      user: { id: user._id, username: user.username, email: user.email, role: user.role },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user, record lastLogin, and return token
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Update last login telemetry
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email, role: user.role },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Revoke user session (stateless response)
 * @access  Public
 */
exports.logout = async (req, res) => {
  res.status(200).json({ message: 'Successfully logged out' });
};

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Generate password reset token and return reset URL
 * @access  Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email address is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account matches this email address' });
    }

    // Generate random token
    const rawToken = crypto.randomBytes(20).toString('hex');
    
    // Hash token to store in DB
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
      
    // Set 30-minute expiry window
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000;

    await user.save();

    // Construct local development reset URL
    const resetUrl = `http://localhost:5173/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;
    
    // Log to console for security auditing / local testing ease
    console.log(`\n🔑 [LogHawk API] Password reset link requested for ${email}:`);
    console.log(`   ${resetUrl}\n`);

    res.status(200).json({
      message: 'Password reset link generated successfully.',
      resetUrl, // Return directly for simplified recruiter local testing
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/reset-password
 * @desc    Submit reset password token to set new password
 * @access  Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, token, newPassword, confirmPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({ message: 'Email, token, and new password are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    // Re-hash incoming token to match DB entry
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      email,
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired password reset token' });
    }

    // Set new password
    user.passwordHash = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile (with creation date)
 * @access  Private
 */
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile username and email
 * @access  Private
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const { username, email } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (username && username !== user.username) {
      const usernameConflict = await User.findOne({ username });
      if (usernameConflict) {
        return res.status(400).json({ message: 'This username is already in use by another account' });
      }
      user.username = username;
    }
    
    if (email && email !== user.email) {
      // Check if email already taken
      const emailConflict = await User.findOne({ email });
      if (emailConflict) {
        return res.status(400).json({ message: 'This email is already in use by another account' });
      }
      user.email = email;
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get authenticated session info (virtual mapping)
 * @access  Private
 */
exports.getMe = async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
      createdAt: req.user.createdAt,
      lastLogin: req.user.lastLogin,
    }
  });
};

/**
 * @route   PATCH /api/auth/me/password
 * @desc    Change authenticated user's password with strength check
 * @access  Private
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'currentPassword and newPassword are required' });
    }

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const user = await User.findById(req.user._id).select('+passwordHash');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.passwordHash = newPassword;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};

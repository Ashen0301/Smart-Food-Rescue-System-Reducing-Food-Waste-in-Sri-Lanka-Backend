import User from '../models/User.js';
import jwt from 'jsonwebtoken';

/**
 * Generate JWT Token helper
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * Helper to structure user response payload with full vendor & user details
 */
const formatUserPayload = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone || '',
  outletName: user.outletName || user.name,
  district: user.district || 'Colombo',
  address: user.address || '',
  isVerified: user.isVerified,
  reliabilityScore: user.reliabilityScore || 100,
});

/**
 * @desc    Register a new public user (Consumer / Vendor / NGO)
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
export const register = async (req, res) => {
  try {
    const { name, email, password, role, phone, outletName, district } = req.body;

    // Security Check: Block public self-registration for ADMIN role
    if (role === 'ADMIN') {
      return res.status(400).json({
        success: false,
        message: 'Public registration for System Administrator is not permitted. Admin accounts must be created via admin seeder or assigned by an existing administrator.',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists. Please log in.',
      });
    }

    // Create user in MongoDB Atlas
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'CONSUMER',
      phone,
      outletName: outletName || name,
      district: district || 'Colombo',
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to FoodSave LK.',
      token,
      user: formatUserPayload(user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration',
    });
  }
};

/**
 * @desc    Login user with email and password
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    // Search for registered user in MongoDB Atlas
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'No registered account found with this email address. Please register first.',
      });
    }

    // Compare bcrypt password hash
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password. Please check your password and try again.',
      });
    }

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: formatUserPayload(user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during authentication',
    });
  }
};

/**
 * @desc    Get current logged in user profile
 * @route   GET /api/v1/auth/profile
 * @access  Private (Protected by JWT)
 */
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found in system',
      });
    }
    res.status(200).json({
      success: true,
      user: formatUserPayload(user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving user profile',
    });
  }
};

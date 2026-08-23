import User from '../models/User.js';
import Listing from '../models/Listing.js';
import Review from '../models/Review.js';

/**
 * @desc    Get user profile details
 * @route   GET /api/v1/users/profile
 * @access  Private
 */
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User profile not found' });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update user profile details
 * @route   PUT /api/v1/users/profile
 * @access  Private
 */
export const updateUserProfile = async (req, res) => {
  try {
    const { name, phone, outletName, address, district, dietaryPreferences } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (outletName) user.outletName = outletName;
    if (address) user.address = address;
    if (district) user.district = district;
    if (dietaryPreferences) user.dietaryPreferences = dietaryPreferences;

    const updatedUser = await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Set notification & discovery preferences (Consumers)
 * @route   PUT /api/v1/users/preferences
 * @access  Private
 */
export const setNotificationPreferences = async (req, res) => {
  try {
    const { emailAlerts, proximityAlerts, preferredCategories, maxRadiusKm, dailyAlertLimit } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.notificationPreferences = {
      emailAlerts: emailAlerts !== undefined ? emailAlerts : user.notificationPreferences.emailAlerts,
      proximityAlerts: proximityAlerts !== undefined ? proximityAlerts : user.notificationPreferences.proximityAlerts,
      preferredCategories: preferredCategories || user.notificationPreferences.preferredCategories,
      maxRadiusKm: maxRadiusKm || user.notificationPreferences.maxRadiusKm,
      dailyAlertLimit: dailyAlertLimit || user.notificationPreferences.dailyAlertLimit,
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Notification preferences updated successfully',
      notificationPreferences: user.notificationPreferences,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Admin Function: Verify or reject a vendor account
 * @route   PUT /api/v1/users/admin/verify-vendor/:id
 * @access  Private (Admin Only)
 */
export const verifyVendor = async (req, res) => {
  try {
    const { isVerified } = req.body; // true or false
    const vendorId = req.params.id;

    const vendor = await User.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    if (vendor.role !== 'VENDOR') {
      return res.status(400).json({ success: false, message: 'User is not a vendor' });
    }

    vendor.isVerified = isVerified;
    vendor.verifiedAt = isVerified ? new Date() : null;
    vendor.verifiedBy = isVerified ? req.user.id : null;

    await vendor.save();

    res.status(200).json({
      success: true,
      message: isVerified
        ? `Vendor (${vendor.name}) has been verified and can now post listings.`
        : `Vendor (${vendor.name}) verification status set to unverified.`,
      vendor,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Admin Function: Assign user role
 * @route   PUT /api/v1/users/admin/assign-role/:id
 * @access  Private (Admin Only)
 */
export const assignUserRole = async (req, res) => {
  try {
    const { role } = req.body; // 'CONSUMER', 'VENDOR', 'NGO', 'ADMIN'
    const userId = req.params.id;

    if (!['CONSUMER', 'VENDOR', 'NGO', 'ADMIN'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role provided' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.role = role;
    if (role === 'CONSUMER' || role === 'NGO') {
      user.isVerified = true;
    }
    await user.save();

    res.status(200).json({
      success: true,
      message: `User (${user.name}) role updated to ${role}`,
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Admin Function: Get list of unverified vendors awaiting approval
 * @route   GET /api/v1/users/admin/unverified-vendors
 * @access  Private (Admin Only)
 */
export const getUnverifiedVendors = async (req, res) => {
  try {
    const unverifiedVendors = await User.find({ role: 'VENDOR', isVerified: false });
    res.status(200).json({
      success: true,
      count: unverifiedVendors.length,
      vendors: unverifiedVendors,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Admin Function: Get all registered users
 * @route   GET /api/v1/users/admin/all
 * @access  Private (Admin Only)
 */
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get Vendor Public Profile (For Consumer Discovery & Rating Inspection)
 * @route   GET /api/v1/users/vendor-profile/:id
 * @access  Public
 */
export const getVendorPublicProfile = async (req, res) => {
  try {
    const vendor = await User.findById(req.params.id).select('-password');
    if (!vendor || vendor.role !== 'VENDOR') {
      return res.status(404).json({ success: false, message: 'Vendor profile not found' });
    }

    const activeListings = await Listing.find({ vendor: vendor._id, status: 'ACTIVE' });
    const allListings = await Listing.find({ vendor: vendor._id });
    const reviews = await Review.find({ vendor: vendor._id }).sort({ createdAt: -1 }).limit(10);

    const totalFoodListedKg = allListings.reduce((sum, l) => sum + (l.quantityKg || 0), 0);
    const totalFoodRescuedKg = allListings.reduce((sum, l) => sum + (l.collectedQuantityKg || 0), 0);

    res.status(200).json({
      success: true,
      vendor: {
        id: vendor._id,
        name: vendor.name,
        outletName: vendor.outletName || vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
        district: vendor.district || 'Colombo',
        vendorRating: vendor.vendorRating || 4.8,
        ratingCount: reviews.length,
        reliabilityScore: vendor.reliabilityScore || 100,
        isVerified: vendor.isVerified,
        totalFoodListedKg: Math.round(totalFoodListedKg * 10) / 10,
        totalFoodRescuedKg: Math.round(totalFoodRescuedKg * 10) / 10,
        activeListingsCount: activeListings.length,
      },
      activeListings,
      reviews,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

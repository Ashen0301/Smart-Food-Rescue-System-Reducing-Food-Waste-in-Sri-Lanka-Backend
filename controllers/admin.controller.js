import User from '../models/User.js';
import Listing from '../models/Listing.js';
import Order from '../models/Order.js';

/**
 * @desc    Get real-time system analytics for Admin Dashboard
 * @route   GET /api/v1/admin/stats
 * @access  Private (Admin Only)
 */
export const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const consumerCount = await User.countDocuments({ role: 'CONSUMER' });
    const vendorCount = await User.countDocuments({ role: 'VENDOR' });
    const ngoCount = await User.countDocuments({ role: 'NGO' });
    const adminCount = await User.countDocuments({ role: 'ADMIN' });

    const pendingVendorsCount = await User.countDocuments({ role: 'VENDOR', isVerified: false });
    const verifiedVendorsCount = await User.countDocuments({ role: 'VENDOR', isVerified: true });

    const totalListings = await Listing.countDocuments();
    const activeListingsCount = await Listing.countDocuments({ status: 'ACTIVE' });

    const allListings = await Listing.find().select('quantityKg collectedQuantityKg reservedQuantityKg');
    const totalFoodListedKg = allListings.reduce((sum, l) => sum + (l.quantityKg || 0), 0);
    const totalFoodCollectedKg = allListings.reduce((sum, l) => sum + (l.collectedQuantityKg || 0), 0);
    const totalFoodReservedKg = allListings.reduce((sum, l) => sum + (l.reservedQuantityKg || 0), 0);

    const totalOrders = await Order.countDocuments();
    const completedOrders = await Order.countDocuments({ status: 'COLLECTED' });
    const pendingOrders = await Order.countDocuments({ status: 'PENDING' });
    const confirmedOrders = await Order.countDocuments({ status: 'CONFIRMED' });
    const readyOrders = await Order.countDocuments({ status: 'READY_FOR_COLLECTION' });
    const cancelledOrders = await Order.countDocuments({ status: 'CANCELLED' });

    // Calculate CO2 emissions saved in kg (approx 2.5 kg CO2 per kg food rescued)
    const co2SavedKg = Math.round(totalFoodCollectedKg * 2.5 * 10) / 10;

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        consumerCount,
        vendorCount,
        ngoCount,
        adminCount,
        pendingVendorsCount,
        verifiedVendorsCount,
        totalListings,
        activeListingsCount,
        totalFoodListedKg: Math.round(totalFoodListedKg * 10) / 10,
        totalFoodCollectedKg: Math.round(totalFoodCollectedKg * 10) / 10,
        totalFoodReservedKg: Math.round(totalFoodReservedKg * 10) / 10,
        co2SavedKg,
        totalOrders,
        completedOrders,
        pendingOrders,
        confirmedOrders,
        readyOrders,
        cancelledOrders,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get all food listings across all vendors in Sri Lanka (Admin Moderation)
 * @route   GET /api/v1/admin/listings
 * @access  Private (Admin Only)
 */
export const getAllSystemListings = async (req, res) => {
  try {
    const { search, category, status, district } = req.query;

    const query = {};
    if (category && category !== 'ALL') query.category = category;
    if (status && status !== 'ALL') query.status = status;

    let listings = await Listing.find(query)
      .populate('vendor', 'name outletName email phone district isVerified reliabilityScore')
      .sort({ createdAt: -1 })
      .lean();

    if (district && district !== 'ALL') {
      listings = listings.filter((l) => {
        const vendorDist = l.vendor?.district || '';
        const locationStr = l.outletLocation || '';
        return (
          vendorDist.toLowerCase() === district.toLowerCase() ||
          locationStr.toLowerCase().includes(district.toLowerCase())
        );
      });
    }

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      listings = listings.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.category.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          (l.vendor?.name && l.vendor.name.toLowerCase().includes(q)) ||
          (l.vendor?.outletName && l.vendor.outletName.toLowerCase().includes(q)) ||
          (l.outletLocation && l.outletLocation.toLowerCase().includes(q))
      );
    }

    res.status(200).json({
      success: true,
      count: listings.length,
      listings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete food listing (Admin Moderation)
 * @route   DELETE /api/v1/admin/listings/:id
 * @access  Private (Admin Only)
 */
export const deleteSystemListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Food listing not found' });
    }

    await listing.deleteOne();

    res.status(200).json({
      success: true,
      message: `Listing "${listing.title}" deleted by Administrator`,
      id: req.params.id,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get all system orders across all vendors and consumers (Admin Tracking)
 * @route   GET /api/v1/admin/orders
 * @access  Private (Admin Only)
 */
export const getAllSystemOrders = async (req, res) => {
  try {
    const { status } = req.query;

    const query = {};
    if (status && status !== 'ALL') query.status = status;

    const orders = await Order.find(query)
      .populate('listing', 'title category priceType price outletLocation')
      .populate('vendor', 'name outletName phone email district')
      .populate('customer', 'name email phone reliabilityScore')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Toggle user verification status directly (Admin Only)
 * @route   PUT /api/v1/admin/users/:id/toggle-verify
 * @access  Private (Admin Only)
 */
export const toggleUserVerification = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isVerified = !user.isVerified;
    if (user.isVerified) {
      user.verifiedAt = new Date();
      user.verifiedBy = req.user.id;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: `User (${user.name}) verification status set to ${user.isVerified ? 'VERIFIED' : 'UNVERIFIED'}`,
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

import Listing from '../models/Listing.js';
import Order from '../models/Order.js';
import DonationCertificate from '../models/DonationCertificate.js';
import User from '../models/User.js';

/**
 * @desc    Get free bulk community food donations for NGOs
 * @route   GET /api/v1/ngo/donations
 * @access  Private (NGO / Admin)
 */
export const getNgoBulkDonations = async (req, res) => {
  try {
    const { district, category, search } = req.query;

    const query = {
      status: 'ACTIVE',
      priceType: 'FREE',
      collectionEndDate: { $gt: new Date() },
    };
    if (category && category !== 'ALL') query.category = category;

    let listings = await Listing.find(query)
      .populate('vendor', 'name outletName email phone district vendorRating reliabilityScore')
      .sort({ createdAt: -1 })
      .lean();

    if (district && district !== 'ALL') {
      listings = listings.filter((l) => {
        const vDist = l.vendor?.district || '';
        const loc = l.outletLocation || '';
        return vDist.toLowerCase() === district.toLowerCase() || loc.toLowerCase().includes(district.toLowerCase());
      });
    }

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      listings = listings.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          (l.vendor?.outletName && l.vendor.outletName.toLowerCase().includes(q))
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
 * @desc    Get NGO Impact Statistics (Total kg received, meals served, CO2 saved)
 * @route   GET /api/v1/ngo/impact
 * @access  Private (NGO Only)
 */
export const getNgoImpactStats = async (req, res) => {
  try {
    const ngoId = req.user.id;

    const certificates = await DonationCertificate.find({ recipient: ngoId });
    const completedOrders = await Order.find({ customer: ngoId, status: 'COLLECTED' });
    const activeOrders = await Order.find({ customer: ngoId, status: { $in: ['PENDING', 'CONFIRMED', 'READY_FOR_COLLECTION'] } });

    const totalFoodReceivedKg = certificates.reduce((sum, c) => sum + (c.quantityKg || 0), 0);
    const totalMealsServed = certificates.reduce((sum, c) => sum + (c.estimatedMeals || 0), 0);
    const totalCo2SavedKg = certificates.reduce((sum, c) => sum + (c.co2SavedKg || 0), 0);

    res.status(200).json({
      success: true,
      stats: {
        totalFoodReceivedKg: Math.round(totalFoodReceivedKg * 10) / 10,
        totalMealsServed,
        totalCo2SavedKg: Math.round(totalCo2SavedKg * 10) / 10,
        certificatesCount: certificates.length,
        completedRescuesCount: completedOrders.length,
        activeRescuesCount: activeOrders.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get issued CSR donation certificates for logged in NGO
 * @route   GET /api/v1/ngo/certificates
 * @access  Private (NGO Only)
 */
export const getNgoCertificates = async (req, res) => {
  try {
    const certificates = await DonationCertificate.find({ recipient: req.user.id })
      .populate('vendor', 'name outletName email phone district')
      .populate('listing', 'title category priceType')
      .sort({ issuedAt: -1 });

    res.status(200).json({
      success: true,
      count: certificates.length,
      certificates,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get CSR donation certificates issued to a Vendor (For CSR/Tax Records)
 * @route   GET /api/v1/ngo/vendor-certificates
 * @access  Private (Vendor / Admin)
 */
export const getVendorCertificates = async (req, res) => {
  try {
    const certificates = await DonationCertificate.find({ vendor: req.user.id })
      .populate('recipient', 'name email role district phone')
      .populate('listing', 'title category')
      .sort({ issuedAt: -1 });

    const totalDonatedKg = certificates.reduce((sum, c) => sum + (c.quantityKg || 0), 0);
    const totalMealsProvided = certificates.reduce((sum, c) => sum + (c.estimatedMeals || 0), 0);

    res.status(200).json({
      success: true,
      count: certificates.length,
      totalDonatedKg: Math.round(totalDonatedKg * 10) / 10,
      totalMealsProvided,
      certificates,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

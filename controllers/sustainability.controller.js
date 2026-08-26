import Order from '../models/Order.js';
import Listing from '../models/Listing.js';
import User from '../models/User.js';
import DonationCertificate from '../models/DonationCertificate.js';
import crypto from 'crypto';

/**
 * Environmental Impact Multipliers (UNEP / FAO Agricultural Footprint Standards):
 * - 1 kg food rescued = 3 estimated meals provided
 * - 1 kg food rescued = 2.5 kg CO2 greenhouse gas emissions avoided
 * - 1 kg food rescued = 1,000 Liters embedded agricultural water footprint saved
 * - 1 tree absorbs ~20 kg CO2 per year
 * - 1 kg CO2 avoided = ~4.1 km driven by an average passenger vehicle
 */
const MEALS_PER_KG = 3;
const CO2_PER_KG = 2.5;
const WATER_LITERS_PER_KG = 1000;

/**
 * @desc    Get Platform-Wide Sustainability & Environmental Impact Statistics
 * @route   GET /api/v1/sustainability/impact
 * @access  Public
 */
export const getPlatformSustainabilityImpact = async (req, res) => {
  try {
    // 1. Find all collected orders
    const collectedOrders = await Order.find({ status: 'COLLECTED' }).lean();

    // 2. Aggregate total rescued quantity in kg
    const totalRescuedKg = collectedOrders.reduce((sum, o) => sum + (o.quantityReservedKg || 0), 0);

    // 3. Compute Environmental Metrics
    const totalMealsServed = Math.round(totalRescuedKg * MEALS_PER_KG);
    const totalCo2SavedKg = Math.round(totalRescuedKg * CO2_PER_KG * 10) / 10;
    const totalCo2SavedTons = Math.round((totalCo2SavedKg / 1000) * 100) / 100;
    const totalWaterSavedLiters = Math.round(totalRescuedKg * WATER_LITERS_PER_KG);
    const treesEquivalent = Math.round(totalCo2SavedKg / 20);
    const carKmAvoided = Math.round(totalCo2SavedKg * 4.1);

    // 4. Count active vendors & completed rescue operations
    const activeVendorsCount = await User.countDocuments({ role: 'VENDOR', isVerified: true });
    const totalRescuesCompleted = collectedOrders.length;

    // 5. District Distribution Aggregate
    const districtImpactMap = {};
    for (const order of collectedOrders) {
      const listing = await Listing.findById(order.listing).select('district category').lean();
      const dist = listing?.district || 'Colombo';
      if (!districtImpactMap[dist]) {
        districtImpactMap[dist] = { district: dist, rescuedKg: 0, rescuesCount: 0 };
      }
      districtImpactMap[dist].rescuedKg += order.quantityReservedKg || 0;
      districtImpactMap[dist].rescuesCount += 1;
    }

    const districtImpact = Object.values(districtImpactMap)
      .map((d) => ({
        ...d,
        rescuedKg: Math.round(d.rescuedKg * 10) / 10,
        co2SavedKg: Math.round(d.rescuedKg * CO2_PER_KG * 10) / 10,
      }))
      .sort((a, b) => b.rescuedKg - a.rescuedKg);

    res.status(200).json({
      success: true,
      impact: {
        totalRescuedKg: Math.round(totalRescuedKg * 10) / 10,
        totalMealsServed,
        totalCo2SavedKg,
        totalCo2SavedTons,
        totalWaterSavedLiters,
        treesEquivalent,
        carKmAvoided,
        activeVendorsCount,
        totalRescuesCompleted,
        districtImpact,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get Auto-Generated Monthly CSR & Sustainability Impact Report for Vendor or NGO
 * @route   GET /api/v1/sustainability/monthly-report
 * @access  Private (Vendor / NGO / Admin)
 */
export const getMonthlyImpactReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User profile not found' });
    }

    // Parse month (1-12) & year (e.g. 2026)
    const now = new Date();
    const targetMonth = req.query.month ? parseInt(req.query.month) : now.getMonth() + 1;
    const targetYear = req.query.year ? parseInt(req.query.year) : now.getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthLabel = `${monthNames[targetMonth - 1]} ${targetYear}`;

    // Query collected orders for this user in target month
    const orderQuery = {
      status: 'COLLECTED',
      collectedAt: { $gte: startDate, $lte: endDate },
    };

    if (user.role === 'VENDOR') {
      orderQuery.vendor = userId;
    } else {
      orderQuery.customer = userId;
    }

    const monthlyOrders = await Order.find(orderQuery)
      .populate('listing', 'title category priceType price')
      .populate('vendor', 'name outletName district')
      .populate('customer', 'name district role')
      .lean();

    // Aggregate monthly impact metrics
    const monthlyRescuedKg = monthlyOrders.reduce((sum, o) => sum + (o.quantityReservedKg || 0), 0);
    const monthlyMealsServed = Math.round(monthlyRescuedKg * MEALS_PER_KG);
    const monthlyCo2SavedKg = Math.round(monthlyRescuedKg * CO2_PER_KG * 10) / 10;
    const monthlyWaterSavedLiters = Math.round(monthlyRescuedKg * WATER_LITERS_PER_KG);
    const treesEquivalent = Math.round(monthlyCo2SavedKg / 20);
    const carKmAvoided = Math.round(monthlyCo2SavedKg * 4.1);

    // Food category breakdown
    const categoryBreakdownMap = {};
    for (const o of monthlyOrders) {
      const cat = o.listing?.category || 'general';
      if (!categoryBreakdownMap[cat]) categoryBreakdownMap[cat] = 0;
      categoryBreakdownMap[cat] += o.quantityReservedKg || 0;
    }
    const categoryBreakdown = Object.entries(categoryBreakdownMap).map(([category, kg]) => ({
      category,
      kg: Math.round(kg * 10) / 10,
    }));

    // Generate unique verification code for CSR audit
    const rawCode = `${userId}-${targetYear}-${targetMonth}-${monthlyRescuedKg}`;
    const reportCode = `SR-${targetYear}-${targetMonth.toString().padStart(2, '0')}-${crypto.createHash('md5').update(rawCode).digest('hex').substring(0, 6).toUpperCase()}`;

    // Count CSR certificates issued/received
    const certQuery = { issuedAt: { $gte: startDate, $lte: endDate } };
    if (user.role === 'VENDOR') certQuery.vendor = userId;
    else certQuery.recipient = userId;
    const certCount = await DonationCertificate.countDocuments(certQuery);

    res.status(200).json({
      success: true,
      report: {
        reportCode,
        month: targetMonth,
        year: targetYear,
        monthLabel,
        organizationName: user.role === 'VENDOR' ? (user.outletName || user.name) : user.name,
        role: user.role,
        district: user.district || 'Colombo',
        issuedAt: new Date().toISOString(),
        metrics: {
          totalRescuedKg: Math.round(monthlyRescuedKg * 10) / 10,
          mealsServed: monthlyMealsServed,
          co2SavedKg: monthlyCo2SavedKg,
          waterSavedLiters: monthlyWaterSavedLiters,
          treesEquivalent,
          carKmAvoided,
          totalRescuesCount: monthlyOrders.length,
          csrCertificatesCount: certCount,
        },
        categoryBreakdown,
        ordersLog: monthlyOrders.map((o) => ({
          orderId: o._id,
          title: o.listing?.title || 'Surplus Food Batch',
          category: o.listing?.category || 'general',
          quantityKg: o.quantityReservedKg,
          collectedAt: o.collectedAt || o.updatedAt,
          partnerName: user.role === 'VENDOR' ? (o.customer?.name || o.customerName) : (o.vendor?.outletName || o.vendor?.name),
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

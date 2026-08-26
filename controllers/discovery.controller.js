import Listing from '../models/Listing.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import DailyNotificationTracking from '../models/DailyNotificationTracking.js';
import { calculateDistanceKm } from '../services/notificationEngine.js';

/**
 * @desc    Consumer Food Discovery Endpoint (District-Based Proximity, Search, Filters, Sorting)
 * @route   GET /api/v1/discovery/listings
 * @access  Private (Consumer)
 */
export const getNearbyConsumerListings = async (req, res) => {
  try {
    const consumer = await User.findById(req.user.id);
    const consumerLat = consumer?.latitude || 6.9271;
    const consumerLng = consumer?.longitude || 79.8612;

    const {
      search,
      category,
      district,
      distanceMax,
      priceType,
      availability,
      sort = 'newest',
    } = req.query;

    // Base query: Active and unexpired listings (expired listings remain in DB for vendor history but are removed from discovery)
    const query = {
      status: 'ACTIVE',
      collectionEndDate: { $gt: new Date() },
    };

    if (category && category !== 'ALL') {
      query.category = category;
    }
    if (priceType && priceType !== 'ALL') {
      query.priceType = priceType;
    }

    let listings = await Listing.find(query)
      .populate('vendor', 'name outletName phone district reliabilityScore vendorRating')
      .lean();

    // 1. Attach vendor District & calculate Haversine distance
    listings = listings.map((l) => {
      const vendorLat = l.latitude || l.vendor?.latitude || 6.9271;
      const vendorLng = l.longitude || l.vendor?.longitude || 79.8612;
      const dist = calculateDistanceKm(consumerLat, consumerLng, vendorLat, vendorLng);
      const vendorDist = l.vendor?.district || consumer?.district || 'Colombo';
      return {
        ...l,
        distanceKm: dist,
        district: vendorDist,
        vendorName: l.vendor?.outletName || l.vendor?.name || 'Local Vendor',
        vendorRating: l.vendor?.vendorRating || 4.8,
      };
    });

    // 2. Filter by District if specified (default to consumer's district if passed or 'ALL')
    if (district && district !== 'ALL') {
      listings = listings.filter((l) => {
        const dMatch = l.district.toLowerCase() === district.toLowerCase();
        const locMatch = l.outletLocation ? l.outletLocation.toLowerCase().includes(district.toLowerCase()) : false;
        return dMatch || locMatch;
      });
    }

    // 3. Optional Distance Filter (only if distanceMax is explicitly specified and not 'ALL')
    if (distanceMax && distanceMax !== 'ALL') {
      const maxRadius = Number(distanceMax);
      listings = listings.filter((l) => l.distanceKm <= maxRadius);
    }

    // 4. Search Filter (by food name, category, vendor name, description, district, location)
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      listings = listings.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.category.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.vendorName.toLowerCase().includes(q) ||
          l.district.toLowerCase().includes(q) ||
          (l.outletLocation && l.outletLocation.toLowerCase().includes(q))
      );
    }

    // 5. Availability Filter
    if (availability === 'NOW') {
      listings = listings.filter((l) => l.remainingQuantityKg > 0);
    } else if (availability === 'ALMOST_SOLD_OUT') {
      listings = listings.filter((l) => l.remainingQuantityKg > 0 && l.remainingQuantityKg <= 2);
    }

    // 6. Sorting
    if (sort === 'nearest') {
      listings.sort((a, b) => a.distanceKm - b.distanceKm);
    } else if (sort === 'newest') {
      listings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sort === 'expiring_soon') {
      listings.sort((a, b) => new Date(a.collectionEndDate) - new Date(b.collectionEndDate));
    } else if (sort === 'lowest_price') {
      listings.sort((a, b) => a.price - b.price);
    } else if (sort === 'highest_rated') {
      listings.sort((a, b) => b.vendorRating - a.vendorRating);
    }

    res.status(200).json({
      success: true,
      count: listings.length,
      consumerLocation: {
        latitude: consumerLat,
        longitude: consumerLng,
        district: consumer?.district || 'Colombo',
        locationName: `${consumer?.district || 'Colombo'} District, Sri Lanka`,
      },
      listings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get Consumer Notification Preferences & Daily Limit Stats
 * @route   GET /api/v1/discovery/preferences
 * @access  Private (Consumer)
 */
export const getConsumerPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const todayDateString = new Date().toISOString().split('T')[0];

    const tracker = await DailyNotificationTracking.findOne({
      consumer: user._id,
      dateString: todayDateString,
    });

    const usedToday = tracker ? tracker.count : 0;
    const dailyLimit = user.notificationPreferences?.dailyNotificationLimit || 10;

    res.status(200).json({
      success: true,
      preferences: user.notificationPreferences || {
        nearbyNotificationsEnabled: true,
        categoryNotificationsEnabled: true,
        dailyNotificationLimit: 10,
        maxRadiusKm: 5,
      },
      subscribedCategories: user.subscribedCategories || ['bakery', 'meals', 'vegetables', 'donations', 'dairy', 'groceries'],
      location: {
        latitude: user.latitude || 6.9271,
        longitude: user.longitude || 79.8612,
        locationName: user.locationName || 'Colombo, Sri Lanka',
      },
      dailyLimitStats: {
        limit: dailyLimit,
        usedToday,
        remainingToday: Math.max(0, dailyLimit - usedToday),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update Consumer Notification Settings & Daily Limits
 * @route   PUT /api/v1/discovery/preferences
 * @access  Private (Consumer)
 */
export const updateConsumerPreferences = async (req, res) => {
  try {
    const { nearbyNotificationsEnabled, categoryNotificationsEnabled, dailyNotificationLimit, maxRadiusKm } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.notificationPreferences = {
      nearbyNotificationsEnabled: nearbyNotificationsEnabled !== undefined ? nearbyNotificationsEnabled : user.notificationPreferences.nearbyNotificationsEnabled,
      categoryNotificationsEnabled: categoryNotificationsEnabled !== undefined ? categoryNotificationsEnabled : user.notificationPreferences.categoryNotificationsEnabled,
      dailyNotificationLimit: dailyNotificationLimit !== undefined ? Number(dailyNotificationLimit) : user.notificationPreferences.dailyNotificationLimit,
      maxRadiusKm: maxRadiusKm !== undefined ? Number(maxRadiusKm) : user.notificationPreferences.maxRadiusKm,
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Notification preferences updated successfully',
      preferences: user.notificationPreferences,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update Subscribed Categories for Targeted Alerts
 * @route   PUT /api/v1/discovery/subscriptions
 * @access  Private (Consumer)
 */
export const updateSubscribedCategories = async (req, res) => {
  try {
    const { subscribedCategories } = req.body; // Array of category strings

    if (!Array.isArray(subscribedCategories)) {
      return res.status(400).json({ success: false, message: 'Please provide an array of category strings' });
    }

    const user = await User.findById(req.user.id);
    user.subscribedCategories = subscribedCategories;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Category subscriptions updated successfully',
      subscribedCategories: user.subscribedCategories,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get Consumer Notifications Center (Divided by All, Unread, Alerts, System)
 * @route   GET /api/v1/consumer-notifications
 * @access  Private (Consumer)
 */
export const getConsumerNotifications = async (req, res) => {
  try {
    const { filter = 'all' } = req.query;

    const query = { recipient: req.user.id };

    if (filter === 'unread') query.isRead = false;
    else if (filter === 'alerts') query.type = { $in: ['EXPIRING_SOON', 'NEW_RESERVATION'] };
    else if (filter === 'system') query.type = 'SYSTEM';

    const notifications = await Notification.find(query)
      .populate({
        path: 'relatedListing',
        select: 'title category price priceType imageUrl outletLocation remainingQuantityKg collectionWindow',
        populate: { path: 'vendor', select: 'name outletName' },
      })
      .sort({ createdAt: -1 });

    const unreadCount = await Notification.countDocuments({
      recipient: req.user.id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      unreadCount,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Mark notification as read
 * @route   PUT /api/v1/consumer-notifications/read/:id
 * @access  Private (Consumer)
 */
export const markConsumerNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({ _id: req.params.id, recipient: req.user.id });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });

    notification.isRead = true;
    await notification.save();

    res.status(200).json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Mark all consumer notifications as read
 * @route   PUT /api/v1/consumer-notifications/read-all
 * @access  Private (Consumer)
 */
export const markAllConsumerNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete consumer notification
 * @route   DELETE /api/v1/consumer-notifications/:id
 * @access  Private (Consumer)
 */
export const deleteConsumerNotification = async (req, res) => {
  try {
    await Notification.deleteOne({ _id: req.params.id, recipient: req.user.id });
    res.status(200).json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

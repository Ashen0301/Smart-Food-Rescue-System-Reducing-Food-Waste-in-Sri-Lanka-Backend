import User from '../models/User.js';
import Notification from '../models/Notification.js';
import NotificationDelivery from '../models/NotificationDelivery.js';
import DailyNotificationTracking from '../models/DailyNotificationTracking.js';

/**
 * Haversine formula to calculate geographic distance between two coordinates in kilometers
 */
export const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 2.5; // Default fallback distance
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
};

/**
 * Automated Notification Engine:
 * When a vendor publishes an active listing:
 * 1. Find all consumers within 5km radius.
 * 2. Check preferred food category subscriptions.
 * 3. Check notification settings (nearby & category alerts toggles).
 * 4. Check daily notification limit (e.g. 10/day max).
 * 5. Check duplicate delivery records.
 * 6. Create Notification & emit real-time Socket.IO alert.
 */
export const processNewListingNotifications = async (listing, ioInstance = null) => {
  try {
    if (!listing || listing.status !== 'ACTIVE') return;

    // Fetch vendor details
    const vendor = await User.findById(listing.vendor);
    const vendorName = vendor?.outletName || vendor?.name || 'Nearby Vendor';
    const vendorLat = listing.latitude || vendor?.latitude || 6.9271;
    const vendorLng = listing.longitude || vendor?.longitude || 79.8612;

    const todayDateString = new Date().toISOString().split('T')[0];

    // Find all consumer users
    const consumers = await User.find({ role: 'CONSUMER' });

    let sentCount = 0;

    for (const consumer of consumers) {
      const prefs = consumer.notificationPreferences || {};
      const maxRadius = prefs.maxRadiusKm || 5;
      const dailyLimit = prefs.dailyNotificationLimit !== undefined ? prefs.dailyNotificationLimit : 10;

      // 1. Calculate distance
      const consumerLat = consumer.latitude || 6.9271;
      const consumerLng = consumer.longitude || 79.8612;
      const distanceKm = calculateDistanceKm(consumerLat, consumerLng, vendorLat, vendorLng);

      // Check 5 km radius
      if (distanceKm > maxRadius) continue;

      // Check if nearby notifications enabled
      if (prefs.nearbyNotificationsEnabled === false) continue;

      // 2. Check Category Subscription Matching
      const subscribed = (consumer.subscribedCategories && consumer.subscribedCategories.length > 0)
        ? consumer.subscribedCategories
        : ['bakery', 'meals', 'vegetables', 'donations', 'dairy', 'groceries', 'other'];

      if (prefs.categoryNotificationsEnabled !== false && !subscribed.includes(listing.category)) {
        continue; // Skip if consumer unsubscribed from this food category
      }

      // 3. Duplicate Prevention Check
      const alreadySent = await NotificationDelivery.findOne({
        consumer: consumer._id,
        listing: listing._id,
      });
      if (alreadySent) continue;

      // 4. Daily Notification Limit Check
      let dailyTracker = await DailyNotificationTracking.findOne({
        consumer: consumer._id,
        dateString: todayDateString,
      });

      if (!dailyTracker) {
        dailyTracker = new DailyNotificationTracking({
          consumer: consumer._id,
          dateString: todayDateString,
          count: 0,
        });
      }

      if (dailyTracker.count >= dailyLimit) {
        console.log(`⚠️ Daily alert limit reached (${dailyTracker.count}/${dailyLimit}) for consumer ${consumer.name}`);
        continue; // Daily limit reached
      }

      // 5. Create Notification Record
      const notifMessage = `New ${listing.category} surplus food available near you! "${listing.title}" is now available at ${vendorName}, ${distanceKm} km away. (${listing.quantityKg} kg available, ${listing.collectionWindow || 'Collection open'})`;

      const newNotif = await Notification.create({
        recipient: consumer._id,
        title: `New Food Available (${distanceKm} km away)`,
        message: notifMessage,
        type: 'EXPIRING_SOON',
        relatedListing: listing._id,
      });

      // 6. Record Delivery & Increment Counter
      await NotificationDelivery.create({
        consumer: consumer._id,
        listing: listing._id,
        notificationType: 'FOOD_DISCOVERY_ALERT',
      });

      dailyTracker.count += 1;
      await dailyTracker.save();

      sentCount++;

      // 7. Emit Real-time Socket.IO Alert if socket instance available
      if (ioInstance) {
        ioInstance.to(consumer._id.toString()).emit('new_food_alert', {
          notification: newNotif,
          listing,
          distanceKm,
          vendorName,
        });
      }
    }

    console.log(`🔔 [NotificationEngine] Processed listing "${listing.title}": Sent ${sentCount} targeted 5km alerts.`);
  } catch (error) {
    console.error('❌ Error processing real-time notifications:', error.message);
  }
};

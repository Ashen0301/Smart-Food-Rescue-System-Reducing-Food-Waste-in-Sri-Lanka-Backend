import Listing from '../models/Listing.js';
import Notification from '../models/Notification.js';

/**
 * Background Service: Check and update expired food listings
 * Changes status to 'EXPIRED' when collectionEndDate <= now
 */
export const checkAndExpireListings = async () => {
  try {
    const now = new Date();

    // Find active or reserved listings whose collection end window has passed
    const expiredListings = await Listing.find({
      status: { $in: ['ACTIVE', 'RESERVED'] },
      collectionEndDate: { $lte: now },
    });

    if (expiredListings.length === 0) return;

    for (const listing of expiredListings) {
      listing.status = 'EXPIRED';
      await listing.save();

      // Create notification for vendor
      await Notification.create({
        recipient: listing.vendor,
        title: 'Listing Expired',
        message: `Your listing "${listing.title}" (${listing.quantityKg} kg) collection window has ended and is now marked as Expired.`,
        type: 'LISTING_EXPIRED',
        relatedListing: listing._id,
      });

      console.log(`⏰ [Auto-Expiry] Listing "${listing.title}" (${listing._id}) marked as EXPIRED.`);
    }
  } catch (error) {
    console.error('❌ Error during automatic listing expiration check:', error.message);
  }
};

/**
 * Start background timer to run every 1 minute
 */
export const startExpiryService = () => {
  console.log('⏱️ Automatic Listing Expiration Service initialized (Interval: 1 min)');
  // Run once immediately on server start
  checkAndExpireListings();
  // Run every 60 seconds
  setInterval(checkAndExpireListings, 60000);
};

export default startExpiryService;

import Order from '../models/Order.js';
import Listing from '../models/Listing.js';
import Waitlist from '../models/Waitlist.js';
import Notification from '../models/Notification.js';

/**
 * Background Service: Check and process expired uncollected reservations
 * Automatically cancels reservations where expiresAt <= now and transfers food to waitlist queue
 */
export const checkAndExpireReservations = async () => {
  try {
    const now = new Date();

    // Find uncollected orders where collection window / expiry has passed
    const expiredOrders = await Order.find({
      status: { $in: ['PENDING', 'CONFIRMED', 'READY_FOR_COLLECTION'] },
      expiresAt: { $lte: now },
    });

    if (expiredOrders.length === 0) return;

    for (const order of expiredOrders) {
      order.status = 'CANCELLED';
      await order.save();

      const listing = await Listing.findById(order.listing);
      if (listing) {
        // Revert reserved quantity back to listing inventory
        listing.reservedQuantityKg = Math.max(0, (listing.reservedQuantityKg || 0) - order.quantityReservedKg);
        if (listing.status === 'RESERVED') listing.status = 'ACTIVE';
        await listing.save();
      }

      // Create notification for consumer regarding uncollected expiry
      await Notification.create({
        recipient: order.customer,
        title: 'Reservation Expired (Uncollected)',
        message: `Your reservation for "${listing?.title || 'food item'}" (PIN: #${order.collectionCode}) expired because it was not collected within the allowed time window.`,
        type: 'ORDER_CANCELLED',
        relatedOrder: order._id,
      });

      console.log(`⏰ [ReservationService] Order #${order.collectionCode} expired uncollected. Restored ${order.quantityReservedKg} kg to listing inventory.`);

      // Check Waitlist Queue for next consumer
      if (listing) {
        const nextWaitlistEntry = await Waitlist.findOne({
          listing: listing._id,
          status: 'WAITING',
        }).sort({ queuePosition: 1, createdAt: 1 });

        if (nextWaitlistEntry && listing.remainingQuantityKg >= nextWaitlistEntry.quantityRequestedKg) {
          // Convert waitlist entry to active reservation
          const newOrder = await Order.create({
            listing: listing._id,
            vendor: listing.vendor,
            customer: nextWaitlistEntry.customer,
            customerName: nextWaitlistEntry.customerName,
            quantityReservedKg: nextWaitlistEntry.quantityRequestedKg,
            totalPrice: listing.priceType === 'FREE' ? 0 : listing.price * nextWaitlistEntry.quantityRequestedKg,
            status: 'PENDING',
            paymentStatus: listing.priceType === 'FREE' ? 'FREE' : 'UNPAID',
            expiresAt: listing.collectionEndDate,
            qrCodeData: JSON.stringify({
              orderId: listing._id,
              customer: nextWaitlistEntry.customer,
              quantityKg: nextWaitlistEntry.quantityRequestedKg,
            }),
          });

          // Reserve inventory
          listing.reservedQuantityKg = (listing.reservedQuantityKg || 0) + nextWaitlistEntry.quantityRequestedKg;
          await listing.save();

          nextWaitlistEntry.status = 'CONVERTED';
          await nextWaitlistEntry.save();

          // Notify waitlisted consumer
          await Notification.create({
            recipient: nextWaitlistEntry.customer,
            title: 'Waitlist Offered! Reservation Active',
            message: `Great news! Surplus food "${listing.title}" is now reserved for you from the waitlist queue. (PIN: #${newOrder.collectionCode}).`,
            type: 'NEW_RESERVATION',
            relatedListing: listing._id,
            relatedOrder: newOrder._id,
          });

          console.log(`🎉 [ReservationService] Waitlisted consumer ${nextWaitlistEntry.customerName} converted to active reservation (PIN: #${newOrder.collectionCode}).`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error during automatic reservation expiration check:', error.message);
  }
};

/**
 * Start background timer to run every 1 minute
 */
export const startReservationService = () => {
  console.log('⏱️ Automatic Reservation & Waitlist Queue Service initialized (Interval: 1 min)');
  checkAndExpireReservations();
  setInterval(checkAndExpireReservations, 60000);
};

export default startReservationService;

import Order from '../models/Order.js';
import Listing from '../models/Listing.js';
import Notification from '../models/Notification.js';
import Waitlist from '../models/Waitlist.js';

/**
 * @desc    Create a new food reservation/order (Consumer)
 * @route   POST /api/v1/orders
 * @access  Private (Consumer)
 */
export const createOrder = async (req, res) => {
  try {
    const { listingId, quantityReservedKg } = req.body;

    if (!listingId || !quantityReservedKg) {
      return res.status(400).json({ success: false, message: 'Please specify listing ID and reserved quantity (kg)' });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Food listing not found' });
    }

    // Prevent reservations on expired, sold, or cancelled listings
    if (listing.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: `Cannot reserve food item with status '${listing.status}'`,
      });
    }

    // Check if collection window has expired
    if (new Date() >= new Date(listing.collectionEndDate)) {
      listing.status = 'EXPIRED';
      await listing.save();
      return res.status(400).json({ success: false, message: 'Collection window has expired. Ordering is disabled.' });
    }

    const requestedQty = Number(quantityReservedKg);

    // Prevent reserving more food than available remaining quantity
    if (requestedQty > listing.remainingQuantityKg) {
      return res.status(400).json({
        success: false,
        message: `Only ${listing.remainingQuantityKg} kg available. You requested ${requestedQty} kg.`,
      });
    }

    const totalPrice = listing.priceType === 'FREE' ? 0 : listing.price * requestedQty;
    const pinCode = Math.floor(1000 + Math.random() * 9000).toString();

    const order = await Order.create({
      listing: listing._id,
      vendor: listing.vendor,
      customer: req.user.id,
      customerName: req.user.name,
      quantityReservedKg: requestedQty,
      totalPrice,
      collectionCode: pinCode,
      qrCodeData: JSON.stringify({
        orderId: listing._id,
        pinCode,
        customerName: req.user.name,
        quantityKg: requestedQty,
      }),
      status: 'PENDING',
      paymentStatus: listing.priceType === 'FREE' ? 'FREE' : 'UNPAID',
      expiresAt: listing.collectionEndDate,
    });

    // Update listing inventory (increment reserved quantity)
    listing.reservedQuantityKg = (listing.reservedQuantityKg || 0) + requestedQty;
    await listing.save();

    // Create notification for vendor
    await Notification.create({
      recipient: listing.vendor,
      title: 'New Reservation Received',
      message: `${req.user.name} reserved ${requestedQty} kg of "${listing.title}". (PIN: #${order.collectionCode})`,
      type: 'NEW_RESERVATION',
      relatedListing: listing._id,
      relatedOrder: order._id,
    });

    res.status(201).json({
      success: true,
      message: 'Food reservation placed successfully!',
      order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get active & completed food reservations for logged in consumer
 * @route   GET /api/v1/orders/consumer/me
 * @access  Private (Consumer)
 */
export const getCustomerOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user.id })
      .populate({
        path: 'listing',
        select: 'title category priceType price imageUrl collectionWindow outletLocation collectionEndDate',
        populate: { path: 'vendor', select: 'name outletName phone district reliabilityScore vendorRating' },
      })
      .sort({ createdAt: -1 });

    const waitlists = await Waitlist.find({ customer: req.user.id, status: 'WAITING' })
      .populate('listing', 'title category priceType price outletLocation')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
      waitlists,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    On-Site PIN or QR Code Verification by Vendor
 * @route   POST /api/v1/orders/verify-pin
 * @access  Private (Vendor / Admin)
 */
export const verifyCollectionPinOrQr = async (req, res) => {
  try {
    const { collectionCode } = req.body;

    if (!collectionCode) {
      return res.status(400).json({ success: false, message: 'Please enter a 4-digit collection PIN code' });
    }

    const cleanPin = collectionCode.toString().replace('#', '').trim();

    // Find order belonging to this vendor with matching PIN
    const order = await Order.findOne({
      vendor: req.user.id,
      collectionCode: cleanPin,
      status: { $ne: 'COLLECTED' },
    }).populate('listing customer');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `No active reservation found with PIN #${cleanPin} for your outlet.`,
      });
    }

    order.status = 'COLLECTED';
    order.collectedAt = new Date();
    if (order.paymentStatus === 'UNPAID') {
      order.paymentStatus = 'PAID_OFFLINE';
    }

    const listing = await Listing.findById(order.listing._id);
    if (listing) {
      listing.reservedQuantityKg = Math.max(0, (listing.reservedQuantityKg || 0) - order.quantityReservedKg);
      listing.collectedQuantityKg = (listing.collectedQuantityKg || 0) + order.quantityReservedKg;
      await listing.save();
    }

    await order.save();

    // Notify customer of successful collection
    await Notification.create({
      recipient: order.customer._id,
      title: 'Food Collection Confirmed!',
      message: `On-site collection confirmed for order PIN #${order.collectionCode}. Thank you for rescuing food with FoodSave LK!`,
      type: 'FOOD_COLLECTED',
      relatedOrder: order._id,
    });

    res.status(200).json({
      success: true,
      message: `Collection verified successfully for ${order.customerName}! (${order.quantityReservedKg} kg)`,
      order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Early Cancellation of Food Reservation by Consumer
 * @route   PUT /api/v1/orders/:id/cancel
 * @access  Private (Consumer)
 */
export const cancelConsumerOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Reservation not found' });
    }

    if (order.customer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this reservation' });
    }

    if (order.status === 'COLLECTED') {
      return res.status(400).json({ success: false, message: 'Cannot cancel an order that has already been collected' });
    }

    order.status = 'CANCELLED';
    await order.save();

    // Restore inventory quantity
    const listing = await Listing.findById(order.listing);
    if (listing) {
      listing.reservedQuantityKg = Math.max(0, (listing.reservedQuantityKg || 0) - order.quantityReservedKg);
      if (listing.status === 'RESERVED') listing.status = 'ACTIVE';
      await listing.save();
    }

    // Check Waitlist Queue for next consumer
    if (listing) {
      const nextWaitlistEntry = await Waitlist.findOne({
        listing: listing._id,
        status: 'WAITING',
      }).sort({ queuePosition: 1, createdAt: 1 });

      if (nextWaitlistEntry && listing.remainingQuantityKg >= nextWaitlistEntry.quantityRequestedKg) {
        const pinCode = Math.floor(1000 + Math.random() * 9000).toString();
        const newOrder = await Order.create({
          listing: listing._id,
          vendor: listing.vendor,
          customer: nextWaitlistEntry.customer,
          customerName: nextWaitlistEntry.customerName,
          quantityReservedKg: nextWaitlistEntry.quantityRequestedKg,
          totalPrice: listing.priceType === 'FREE' ? 0 : listing.price * nextWaitlistEntry.quantityRequestedKg,
          collectionCode: pinCode,
          qrCodeData: JSON.stringify({
            orderId: listing._id,
            pinCode,
            customerName: nextWaitlistEntry.customerName,
            quantityKg: nextWaitlistEntry.quantityRequestedKg,
          }),
          status: 'PENDING',
          paymentStatus: listing.priceType === 'FREE' ? 'FREE' : 'UNPAID',
          expiresAt: listing.collectionEndDate,
        });

        listing.reservedQuantityKg = (listing.reservedQuantityKg || 0) + nextWaitlistEntry.quantityRequestedKg;
        await listing.save();

        nextWaitlistEntry.status = 'CONVERTED';
        await nextWaitlistEntry.save();

        await Notification.create({
          recipient: nextWaitlistEntry.customer,
          title: 'Waitlist Offered! Reservation Active',
          message: `Surplus food "${listing.title}" is now reserved for you from the waitlist queue! (PIN: #${newOrder.collectionCode}).`,
          type: 'NEW_RESERVATION',
          relatedListing: listing._id,
          relatedOrder: newOrder._id,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Reservation cancelled successfully. Food released back to community.',
      order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Join Waitlist Queue when food listing is fully reserved
 * @route   POST /api/v1/orders/waitlist
 * @access  Private (Consumer)
 */
export const joinWaitlist = async (req, res) => {
  try {
    const { listingId, quantityRequestedKg } = req.body;

    const listing = await Listing.findById(listingId);
    if (!listing) return res.status(404).json({ success: false, message: 'Food listing not found' });

    const existingWaitlistCount = await Waitlist.countDocuments({ listing: listingId, status: 'WAITING' });

    const entry = await Waitlist.create({
      listing: listing._id,
      customer: req.user.id,
      customerName: req.user.name,
      quantityRequestedKg: Number(quantityRequestedKg) || 1,
      queuePosition: existingWaitlistCount + 1,
      status: 'WAITING',
    });

    res.status(201).json({
      success: true,
      message: `You joined the waitlist queue at position #${entry.queuePosition}. You will be notified if food becomes available!`,
      waitlist: entry,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get orders received by vendor
 * @route   GET /api/v1/orders/vendor/me
 * @access  Private (Vendor Only)
 */
export const getVendorOrders = async (req, res) => {
  try {
    const { status } = req.query;

    const query = { vendor: req.user.id };
    if (status && status !== 'ALL') {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('listing', 'title category quantityKg priceType price collectionWindow outletLocation')
      .populate('customer', 'name email phone reliabilityScore')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: orders.length, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update order status (Vendor / Admin)
 * @route   PUT /api/v1/orders/:id/status
 * @access  Private (Vendor Owner / Admin)
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.vendor.toString() !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this order' });
    }

    const listing = await Listing.findById(order.listing);
    const oldStatus = order.status;
    order.status = status;

    if (status === 'COLLECTED' && oldStatus !== 'COLLECTED') {
      order.collectedAt = new Date();
      if (order.paymentStatus === 'UNPAID') {
        order.paymentStatus = 'PAID_OFFLINE';
      }

      if (listing) {
        listing.reservedQuantityKg = Math.max(0, (listing.reservedQuantityKg || 0) - order.quantityReservedKg);
        listing.collectedQuantityKg = (listing.collectedQuantityKg || 0) + order.quantityReservedKg;
        await listing.save();
      }

      await Notification.create({
        recipient: order.customer,
        title: 'Food Collected',
        message: `Collection confirmed for order PIN #${order.collectionCode}. Thank you for rescuing food!`,
        type: 'FOOD_COLLECTED',
        relatedOrder: order._id,
      });
    } else if (status === 'CANCELLED' && oldStatus !== 'CANCELLED') {
      if (listing) {
        listing.reservedQuantityKg = Math.max(0, (listing.reservedQuantityKg || 0) - order.quantityReservedKg);
        if (listing.status === 'RESERVED') listing.status = 'ACTIVE';
        await listing.save();
      }

      await Notification.create({
        recipient: order.customer,
        title: 'Order Cancelled',
        message: `Your food reservation PIN #${order.collectionCode} was cancelled by the vendor.`,
        type: 'ORDER_CANCELLED',
        relatedOrder: order._id,
      });
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

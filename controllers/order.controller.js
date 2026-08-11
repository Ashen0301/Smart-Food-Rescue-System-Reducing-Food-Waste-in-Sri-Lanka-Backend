import Order from '../models/Order.js';
import Listing from '../models/Listing.js';
import Notification from '../models/Notification.js';

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

    const order = await Order.create({
      listing: listing._id,
      vendor: listing.vendor,
      customer: req.user.id,
      customerName: req.user.name,
      quantityReservedKg: requestedQty,
      totalPrice,
      status: 'PENDING',
      paymentStatus: listing.priceType === 'FREE' ? 'FREE' : 'UNPAID',
    });

    // Update listing inventory (increment reserved quantity)
    listing.reservedQuantityKg = (listing.reservedQuantityKg || 0) + requestedQty;
    await listing.save();

    // Create notification for vendor
    await Notification.create({
      recipient: listing.vendor,
      title: 'New Reservation Received',
      message: `${req.user.name} reserved ${requestedQty} kg of "${listing.title}". (PIN: ${order.collectionCode})`,
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
    const { status } = req.body; // PENDING -> CONFIRMED -> READY_FOR_COLLECTION -> COLLECTED / CANCELLED

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

      // Update listing inventory: move quantity from reserved -> collected
      if (listing) {
        listing.reservedQuantityKg = Math.max(0, (listing.reservedQuantityKg || 0) - order.quantityReservedKg);
        listing.collectedQuantityKg = (listing.collectedQuantityKg || 0) + order.quantityReservedKg;
        await listing.save();
      }

      // Notify customer
      await Notification.create({
        recipient: order.customer,
        title: 'Food Collected',
        message: `Collection confirmed for order PIN #${order.collectionCode}. Thank you for rescuing food!`,
        type: 'FOOD_COLLECTED',
        relatedOrder: order._id,
      });
    } else if (status === 'CANCELLED' && oldStatus !== 'CANCELLED') {
      // Revert reserved quantity back to available listing inventory
      if (listing) {
        listing.reservedQuantityKg = Math.max(0, (listing.reservedQuantityKg || 0) - order.quantityReservedKg);
        if (listing.status === 'RESERVED') listing.status = 'ACTIVE';
        await listing.save();
      }

      // Notify customer
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

import Review from '../models/Review.js';
import User from '../models/User.js';
import Order from '../models/Order.js';

/**
 * @desc    Submit a Vendor Rating & Review (Consumer)
 * @route   POST /api/v1/reviews
 * @access  Private (Consumer)
 */
export const submitVendorReview = async (req, res) => {
  try {
    const { vendorId, orderId, listingId, rating, comment } = req.body;

    if (!vendorId || !rating) {
      return res.status(400).json({ success: false, message: 'Vendor ID and rating (1-5 stars) are required' });
    }

    const numericRating = Number(rating);
    if (numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5 stars' });
    }

    const vendor = await User.findById(vendorId);
    if (!vendor || vendor.role !== 'VENDOR') {
      return res.status(404).json({ success: false, message: 'Vendor account not found' });
    }

    // Check if user already reviewed this order
    if (orderId) {
      const existingReview = await Review.findOne({ customer: req.user.id, order: orderId });
      if (existingReview) {
        return res.status(400).json({ success: false, message: 'You have already submitted a review for this order' });
      }
    }

    const review = await Review.create({
      vendor: vendorId,
      customer: req.user.id,
      customerName: req.user.name,
      order: orderId || null,
      listing: listingId || null,
      rating: numericRating,
      comment: comment || '',
    });

    // Recalculate Vendor Rating Average
    const allReviews = await Review.find({ vendor: vendorId });
    const totalRatingSum = allReviews.reduce((sum, r) => sum + r.rating, 0);
    const newAverageRating = Math.round((totalRatingSum / allReviews.length) * 10) / 10;

    vendor.vendorRating = newAverageRating;
    await vendor.save();

    res.status(201).json({
      success: true,
      message: `Thank you! Your ${numericRating}-star review for ${vendor.outletName || vendor.name} has been published!`,
      review,
      newVendorRating: newAverageRating,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get all reviews for a specific vendor
 * @route   GET /api/v1/reviews/vendor/:vendorId
 * @access  Public
 */
export const getVendorReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ vendor: req.params.vendorId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

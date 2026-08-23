import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
    },
    rating: {
      type: Number,
      required: [true, 'Please select a star rating between 1 and 5'],
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Prevent multiple reviews by the same customer for the same order
reviewSchema.index({ customer: 1, order: 1 }, { unique: true, sparse: true });

const Review = mongoose.model('Review', reviewSchema);
export default Review;

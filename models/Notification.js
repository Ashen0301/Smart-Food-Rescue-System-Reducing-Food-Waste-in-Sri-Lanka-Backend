import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        'NEW_RESERVATION',
        'ORDER_CONFIRMED',
        'EXPIRING_SOON',
        'LISTING_EXPIRED',
        'FULLY_RESERVED',
        'FOOD_COLLECTED',
        'ORDER_CANCELLED',
        'SYSTEM',
      ],
      default: 'SYSTEM',
    },
    relatedListing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
    },
    relatedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;

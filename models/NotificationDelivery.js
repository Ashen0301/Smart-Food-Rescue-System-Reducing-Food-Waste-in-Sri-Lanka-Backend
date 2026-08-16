import mongoose from 'mongoose';

const notificationDeliverySchema = new mongoose.Schema(
  {
    consumer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
    },
    notificationType: {
      type: String,
      default: 'FOOD_DISCOVERY_ALERT',
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Prevent duplicate alert delivery to the same consumer for the same listing
notificationDeliverySchema.index({ consumer: 1, listing: 1 }, { unique: true });

const NotificationDelivery = mongoose.model('NotificationDelivery', notificationDeliverySchema);
export default NotificationDelivery;

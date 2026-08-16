import mongoose from 'mongoose';

const dailyNotificationTrackingSchema = new mongoose.Schema(
  {
    consumer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    dateString: {
      type: String,
      required: true, // e.g. "2026-08-16"
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Unique index per consumer and date string
dailyNotificationTrackingSchema.index({ consumer: 1, dateString: 1 }, { unique: true });

const DailyNotificationTracking = mongoose.model('DailyNotificationTracking', dailyNotificationTrackingSchema);
export default DailyNotificationTracking;

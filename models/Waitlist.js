import mongoose from 'mongoose';

const waitlistSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
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
    quantityRequestedKg: {
      type: Number,
      required: true,
      min: 0.1,
    },
    queuePosition: {
      type: Number,
      required: true,
      default: 1,
    },
    status: {
      type: String,
      enum: ['WAITING', 'NOTIFIED', 'CANCELLED', 'CONVERTED'],
      default: 'WAITING',
    },
  },
  { timestamps: true }
);

const Waitlist = mongoose.model('Waitlist', waitlistSchema);
export default Waitlist;

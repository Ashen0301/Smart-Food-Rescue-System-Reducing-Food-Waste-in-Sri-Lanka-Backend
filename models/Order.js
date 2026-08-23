import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
    },
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
    quantityReservedKg: {
      type: Number,
      required: [true, 'Please specify reserved quantity in kg'],
      min: [0.1, 'Reserved quantity must be greater than 0 kg'],
    },
    totalPrice: {
      type: Number,
      default: 0,
    },
    collectionCode: {
      type: String,
      required: true,
      default: () => Math.floor(1000 + Math.random() * 9000).toString(), // 4-digit PIN
    },
    qrCodeData: {
      type: String,
    },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'READY_FOR_COLLECTION', 'COLLECTED', 'CANCELLED'],
      default: 'PENDING',
    },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PAID_OFFLINE', 'FREE'],
      default: 'UNPAID',
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isWaitlist: {
      type: Boolean,
      default: false,
    },
    collectedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

const Order = mongoose.model('Order', orderSchema);
export default Order;

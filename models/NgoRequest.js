import mongoose from 'mongoose';

const pledgeSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    vendorName: {
      type: String,
      required: true,
    },
    outletName: {
      type: String,
    },
    pledgedQuantityKg: {
      type: Number,
      required: true,
      min: 0.1,
    },
    pledgedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const ngoRequestSchema = new mongoose.Schema(
  {
    ngo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ngoName: {
      type: String,
      required: true,
    },
    district: {
      type: String,
      required: true,
      default: 'Colombo',
    },
    foodCategory: {
      type: String,
      default: 'bakery',
    },
    quantityNeededKg: {
      type: Number,
      required: [true, 'Please specify quantity needed in kg'],
      min: [0.5, 'Quantity must be at least 0.5 kg'],
    },
    fulfilledQuantityKg: {
      type: Number,
      default: 0,
    },
    neededDate: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      required: [true, 'Please add a brief description or shelter notes'],
    },
    status: {
      type: String,
      enum: ['OPEN', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED'],
      default: 'OPEN',
    },
    pledges: [pledgeSchema],
  },
  { timestamps: true }
);

const NgoRequest = mongoose.model('NgoRequest', ngoRequestSchema);
export default NgoRequest;

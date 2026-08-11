import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide a food title/name'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Please select a food category'],
      enum: ['bakery', 'vegetables', 'meals', 'dairy', 'groceries', 'donations', 'other'],
      default: 'bakery',
    },
    description: {
      type: String,
      required: [true, 'Please provide a detailed food description'],
      trim: true,
    },
    quantityKg: {
      type: Number,
      required: [true, 'Please specify quantity in kilograms (kg)'],
      min: [0.1, 'Quantity must be greater than 0 kg'],
    },
    reservedQuantityKg: {
      type: Number,
      default: 0,
      min: 0,
    },
    collectedQuantityKg: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingQuantityKg: {
      type: Number,
      min: 0,
      default: function () {
        return this.quantityKg;
      },
    },
    priceType: {
      type: String,
      enum: ['FREE', 'PAID'],
      default: 'PAID',
    },
    price: {
      type: Number,
      default: 0,
      min: [0, 'Price cannot be negative'],
    },
    collectionStartDate: {
      type: Date,
      required: [true, 'Please specify collection start date and time'],
    },
    collectionEndDate: {
      type: Date,
      required: [true, 'Please specify collection end date and time'],
    },
    collectionWindow: {
      type: String,
    },
    outletLocation: {
      type: String,
      required: [true, 'Please specify outlet/collection location'],
      trim: true,
    },
    freshnessInfo: {
      type: String,
      trim: true,
      default: 'Fresh surplus food from today',
    },
    imageUrl: {
      type: String,
      default: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    },
    allergens: [{
      type: String,
      enum: ['Nuts', 'Gluten', 'Dairy', 'Eggs', 'Soy', 'Other'],
    }],
    additionalNotes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'RESERVED', 'SOLD', 'EXPIRED', 'CANCELLED'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true }
);

// Pre-save middleware to compute remaining quantity & formatted collection window string
listingSchema.pre('save', function (next) {
  // Ensure remaining quantity is accurately calculated: Original - Reserved - Collected
  this.remainingQuantityKg = Math.max(0, this.quantityKg - (this.reservedQuantityKg || 0) - (this.collectedQuantityKg || 0));

  // Compute status if remaining quantity reaches 0 and status is ACTIVE
  if (this.remainingQuantityKg <= 0 && this.status === 'ACTIVE') {
    this.status = this.collectedQuantityKg >= this.quantityKg ? 'SOLD' : 'RESERVED';
  }

  // Format collection window string (e.g., "5:00 PM - 8:00 PM Today")
  if (this.collectionStartDate && this.collectionEndDate) {
    const startStr = new Date(this.collectionStartDate).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' });
    const endStr = new Date(this.collectionEndDate).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' });
    this.collectionWindow = `${startStr} - ${endStr}`;
  }

  next();
});

const Listing = mongoose.model('Listing', listingSchema);
export default Listing;

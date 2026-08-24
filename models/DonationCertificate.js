import mongoose from 'mongoose';

const donationCertificateSchema = new mongoose.Schema(
  {
    certificateNumber: {
      type: String,
      required: true,
      unique: true,
      default: () => `CSR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
    },
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
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipientName: {
      type: String,
      required: true,
    },
    recipientRole: {
      type: String,
      enum: ['NGO', 'CONSUMER'],
      default: 'NGO',
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
    },
    foodTitle: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      default: 'bakery',
    },
    quantityKg: {
      type: Number,
      required: true,
    },
    estimatedMeals: {
      type: Number,
      required: true,
    },
    co2SavedKg: {
      type: Number,
      required: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const DonationCertificate = mongoose.model('DonationCertificate', donationCertificateSchema);
export default DonationCertificate;

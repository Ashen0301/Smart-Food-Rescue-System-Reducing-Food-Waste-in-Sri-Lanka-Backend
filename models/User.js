import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false,
    },
    role: {
      type: String,
      enum: ['CONSUMER', 'VENDOR', 'NGO', 'ADMIN'],
      default: 'CONSUMER',
    },
    phone: {
      type: String,
      trim: true,
    },
    outletName: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    district: {
      type: String,
      default: 'Colombo',
    },
    // Location Coordinates (Default: Colombo, Sri Lanka)
    latitude: {
      type: Number,
      default: 6.9271,
    },
    longitude: {
      type: Number,
      default: 79.8612,
    },
    locationName: {
      type: String,
      default: 'Colombo, Sri Lanka',
    },
    isVerified: {
      type: Boolean,
      default: function () {
        return this.role !== 'VENDOR'; // Vendors require Admin verification before posting listings
      },
    },
    verifiedAt: {
      type: Date,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reliabilityScore: {
      type: Number,
      default: 100,
    },
    vendorRating: {
      type: Number,
      default: 4.8,
    },
    // Gamification & Engagement Fields
    points: {
      type: Number,
      default: 0,
    },
    totalRescuedKg: {
      type: Number,
      default: 0,
    },
    totalCompletedOrders: {
      type: Number,
      default: 0,
    },
    totalExpiredOrders: {
      type: Number,
      default: 0,
    },
    collectionRate: {
      type: Number,
      default: 100,
    },
    badges: [
      {
        badgeId: { type: String, required: true },
        name: { type: String, required: true },
        icon: { type: String, required: true },
        description: { type: String, required: true },
        earnedAt: { type: Date, default: Date.now },
      },
    ],
    // Consumer Notification Preferences
    notificationPreferences: {
      nearbyNotificationsEnabled: { type: Boolean, default: true },
      categoryNotificationsEnabled: { type: Boolean, default: true },
      dailyNotificationLimit: { type: Number, default: 10 },
      maxRadiusKm: { type: Number, default: 5 },
    },
    // Subscribed Food Categories for Targeted Alerts
    subscribedCategories: [{
      type: String,
      default: ['bakery', 'meals', 'vegetables', 'donations', 'dairy', 'groceries'],
    }],
    // Dietary Preferences for Consumers
    dietaryPreferences: [{ type: String }],
  },
  { timestamps: true }
);

// Hash password before saving to MongoDB Atlas
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password entered by user with hashed password in database
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;

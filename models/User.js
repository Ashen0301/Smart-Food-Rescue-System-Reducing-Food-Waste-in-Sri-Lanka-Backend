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
    district: {
      type: String,
      default: 'Colombo',
    },
    isVerified: {
      type: Boolean,
      default: function () {
        return this.role !== 'VENDOR'; // Vendors require admin approval
      },
    },
    reliabilityScore: {
      type: Number,
      default: 100,
    },
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

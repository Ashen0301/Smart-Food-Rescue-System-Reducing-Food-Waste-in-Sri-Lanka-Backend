import Listing from '../models/Listing.js';
import Notification from '../models/Notification.js';
import { processNewListingNotifications } from '../services/notificationEngine.js';

/**
 * @desc    Create a new surplus food listing
 * @route   POST /api/v1/listings
 * @access  Private (Verified Vendor Only)
 */
export const createListing = async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      quantityKg,
      priceType,
      price,
      collectionStartDate,
      collectionEndDate,
      outletLocation,
      freshnessInfo,
      imageUrl,
      allergens,
      additionalNotes,
    } = req.body;

    // Validate required fields
    if (!title || !description || !quantityKg || !collectionStartDate || !collectionEndDate || !outletLocation) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required listing details (title, description, quantity, collection dates, location)',
      });
    }

    // Date/time validation: collection end date must be in the future
    const startDate = new Date(collectionStartDate);
    const endDate = new Date(collectionEndDate);
    const now = new Date();

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid collection start or end date format' });
    }

    if (endDate <= now) {
      return res.status(400).json({ success: false, message: 'Collection end date/time must be in the future' });
    }

    if (endDate <= startDate) {
      return res.status(400).json({ success: false, message: 'Collection end time must be after start time' });
    }

    // Price validation
    const parsedPrice = priceType === 'FREE' ? 0 : Number(price) || 0;
    if (priceType === 'PAID' && parsedPrice <= 0) {
      return res.status(400).json({ success: false, message: 'Please specify a valid price greater than 0 LKR for paid listings' });
    }

    const listing = await Listing.create({
      vendor: req.user.id,
      title,
      category: category || 'bakery',
      description,
      quantityKg: Number(quantityKg),
      priceType: priceType || 'PAID',
      price: parsedPrice,
      collectionStartDate: startDate,
      collectionEndDate: endDate,
      outletLocation,
      freshnessInfo: freshnessInfo || 'Fresh surplus food from today',
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
      allergens: allergens || [],
      additionalNotes,
      status: 'ACTIVE',
    });

    // Asynchronously trigger notification pipeline to nearby consumers within 5 km
    processNewListingNotifications(listing, req.app.get('io')).catch((err) => {
      console.error('❌ Failed to process listing notifications:', err.message);
    });

    res.status(201).json({
      success: true,
      message: 'Surplus food listing published successfully',
      listing,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get all listings for current vendor with filters & search
 * @route   GET /api/v1/listings/vendor/me
 * @access  Private (Vendor Only)
 */
export const getVendorListings = async (req, res) => {
  try {
    const { status, category, priceType, search } = req.query;

    const query = { vendor: req.user.id };

    if (status && status !== 'ALL') {
      query.status = status;
    }
    if (category && category !== 'ALL') {
      query.category = category;
    }
    if (priceType && priceType !== 'ALL') {
      query.priceType = priceType;
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { outletLocation: { $regex: search, $options: 'i' } },
      ];
    }

    const listings = await Listing.find(query).sort({ createdAt: -1 });

    // Compute inventory summary metrics for vendor dashboard
    const allVendorListings = await Listing.find({ vendor: req.user.id });
    
    const activeCount = allVendorListings.filter((l) => l.status === 'ACTIVE').length;
    const reservedCount = allVendorListings.filter((l) => l.status === 'RESERVED').length;
    const soldCount = allVendorListings.filter((l) => l.status === 'SOLD').length;
    const expiredCount = allVendorListings.filter((l) => l.status === 'EXPIRED').length;

    const totalListedKg = allVendorListings.reduce((sum, l) => sum + (l.quantityKg || 0), 0);
    const totalCollectedKg = allVendorListings.reduce((sum, l) => sum + (l.collectedQuantityKg || 0), 0);
    const totalReservedKg = allVendorListings.reduce((sum, l) => sum + (l.reservedQuantityKg || 0), 0);

    res.status(200).json({
      success: true,
      count: listings.length,
      listings,
      stats: {
        totalListings: allVendorListings.length,
        activeCount,
        reservedCount,
        soldCount,
        expiredCount,
        totalListedKg: Math.round(totalListedKg * 10) / 10,
        totalCollectedKg: Math.round(totalCollectedKg * 10) / 10,
        totalReservedKg: Math.round(totalReservedKg * 10) / 10,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get all active public food listings (Consumer discovery)
 * @route   GET /api/v1/listings
 * @access  Public
 */
export const getAllListings = async (req, res) => {
  try {
    const { category, priceType, search } = req.query;

    const query = {
      status: 'ACTIVE',
      collectionEndDate: { $gt: new Date() },
    };

    if (category && category !== 'ALL') query.category = category;
    if (priceType && priceType !== 'ALL') query.priceType = priceType;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const listings = await Listing.find(query)
      .populate('vendor', 'name outletName phone district reliabilityScore')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: listings.length, listings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get single food listing by ID
 * @route   GET /api/v1/listings/:id
 * @access  Public
 */
export const getListingById = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id).populate('vendor', 'name outletName phone district reliabilityScore');
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Food listing not found' });
    }
    res.status(200).json({ success: true, listing });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update existing food listing
 * @route   PUT /api/v1/listings/:id
 * @access  Private (Vendor Owner Only)
 */
export const updateListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ success: false, message: 'Food listing not found' });
    }

    // Ensure vendor owns this listing
    if (listing.vendor.toString() !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this listing' });
    }

    const {
      title,
      category,
      description,
      quantityKg,
      priceType,
      price,
      collectionStartDate,
      collectionEndDate,
      outletLocation,
      freshnessInfo,
      imageUrl,
      allergens,
      additionalNotes,
      status,
    } = req.body;

    if (title) listing.title = title;
    if (category) listing.category = category;
    if (description) listing.description = description;
    if (quantityKg) listing.quantityKg = Number(quantityKg);
    if (priceType) listing.priceType = priceType;
    if (price !== undefined) listing.price = priceType === 'FREE' ? 0 : Number(price);
    if (collectionStartDate) listing.collectionStartDate = new Date(collectionStartDate);
    if (collectionEndDate) listing.collectionEndDate = new Date(collectionEndDate);
    if (outletLocation) listing.outletLocation = outletLocation;
    if (freshnessInfo) listing.freshnessInfo = freshnessInfo;
    if (imageUrl) listing.imageUrl = imageUrl;
    if (allergens) listing.allergens = allergens;
    if (additionalNotes !== undefined) listing.additionalNotes = additionalNotes;
    if (status) listing.status = status;

    await listing.save();

    res.status(200).json({
      success: true,
      message: 'Food listing updated successfully',
      listing,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete food listing
 * @route   DELETE /api/v1/listings/:id
 * @access  Private (Vendor Owner Only)
 */
export const deleteListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ success: false, message: 'Food listing not found' });
    }

    if (listing.vendor.toString() !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this listing' });
    }

    await listing.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Food listing deleted successfully',
      id: req.params.id,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Duplicate an existing food listing to quickly create a similar listing
 * @route   POST /api/v1/listings/:id/duplicate
 * @access  Private (Vendor Owner Only)
 */
export const duplicateListing = async (req, res) => {
  try {
    const original = await Listing.findById(req.params.id);

    if (!original) {
      return res.status(404).json({ success: false, message: 'Original food listing not found' });
    }

    if (original.vendor.toString() !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized to duplicate this listing' });
    }

    // Set new collection window (start: now, end: now + 4 hours)
    const now = new Date();
    const end = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    const duplicate = await Listing.create({
      vendor: req.user.id,
      title: `${original.title} (Copy)`,
      category: original.category,
      description: original.description,
      quantityKg: original.quantityKg,
      priceType: original.priceType,
      price: original.price,
      collectionStartDate: now,
      collectionEndDate: end,
      outletLocation: original.outletLocation,
      freshnessInfo: original.freshnessInfo,
      imageUrl: original.imageUrl,
      allergens: original.allergens,
      additionalNotes: original.additionalNotes,
      status: 'ACTIVE',
    });

    res.status(201).json({
      success: true,
      message: 'Listing duplicated successfully',
      listing: duplicate,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Cancel an active food listing
 * @route   POST /api/v1/listings/:id/cancel
 * @access  Private (Vendor Owner Only)
 */
export const cancelListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ success: false, message: 'Food listing not found' });
    }

    if (listing.vendor.toString() !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this listing' });
    }

    listing.status = 'CANCELLED';
    await listing.save();

    res.status(200).json({
      success: true,
      message: 'Listing cancelled successfully',
      listing,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

import Anthropic from '@anthropic-ai/sdk';
import Listing from '../models/Listing.js';
import User from '../models/User.js';
import Order from '../models/Order.js';

// Initialize Anthropic SDK Client (if key provided in .env)
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

/**
 * Helper: Extract query parameters from natural language text
 */
const parseConsumerQuery = (text) => {
  const q = text.toLowerCase();

  // Price type
  let priceType = 'ALL';
  if (q.includes('free') || q.includes('lkr 0') || q.includes('donation')) priceType = 'FREE';
  else if (q.includes('paid') || q.includes('discount') || q.includes('lkr')) priceType = 'PAID';

  // Categories
  let category = 'ALL';
  if (q.includes('bread') || q.includes('bakery') || q.includes('pastry') || q.includes('cake') || q.includes('bun')) category = 'bakery';
  else if (q.includes('rice') || q.includes('meal') || q.includes('curry') || q.includes('lunch') || q.includes('dinner')) category = 'meals';
  else if (q.includes('vegetable') || q.includes('fruit') || q.includes('produce')) category = 'vegetables';
  else if (q.includes('milk') || q.includes('dairy') || q.includes('drink') || q.includes('beverage')) category = 'dairy';
  else if (q.includes('grocery') || q.includes('supermarket')) category = 'groceries';

  // Sri Lankan Districts
  const districts = ['colombo', 'gampaha', 'kandy', 'galle', 'matara', 'jaffna', 'kurunegala', 'kalutara', 'nuwara eliya'];
  let district = null;
  for (const d of districts) {
    if (q.includes(d)) {
      district = d.charAt(0).toUpperCase() + d.slice(1);
      break;
    }
  }

  return { priceType, category, district, search: q };
};

/**
 * Helper: Parse natural language command for Vendor food listing creation
 */
const parseVendorCreateCommand = (text, user) => {
  const q = text.toLowerCase();

  // Extract title
  let title = 'Surplus Food Batch';
  if (q.includes('bread')) title = 'Fresh Surplus Bread';
  else if (q.includes('muffin')) title = 'Assorted Fresh Muffins';
  else if (q.includes('cake')) title = 'Surplus Chocolate Cake';
  else if (q.includes('rice') || q.includes('meal')) title = 'Prepared Rice & Curry Meals';
  else if (q.includes('pastry')) title = 'Fresh Bakery Pastries';

  // Extract quantity in kg
  const qtyMatch = text.match(/(\d+(\.\d+)?)\s*(kg|kilogram|portion|pack)/i) || text.match(/(\d+)\s*kg/i);
  const quantityKg = qtyMatch ? parseFloat(qtyMatch[1]) : 5;

  // Extract price
  const priceMatch = text.match(/(lkr|rs\.?|price)?\s*(\d+)/i);
  let priceType = 'FREE';
  let price = 0;
  if (q.includes('free') || q.includes('donation')) {
    priceType = 'FREE';
    price = 0;
  } else if (priceMatch && parseFloat(priceMatch[2]) > 0) {
    priceType = 'PAID';
    price = parseFloat(priceMatch[2]);
  }

  // Extract category
  let category = 'bakery';
  if (q.includes('meal') || q.includes('rice')) category = 'meals';
  else if (q.includes('vegetable')) category = 'vegetables';

  // Collection End Date (default 4 hours from now)
  const collectionStartDate = new Date();
  const collectionEndDate = new Date(Date.now() + 4 * 3600 * 1000);

  return {
    title,
    category,
    description: `Fresh surplus food batch listed via AI Assistant command. High quality, prepared today.`,
    quantityKg,
    priceType,
    price,
    collectionStartDate,
    collectionEndDate,
    outletLocation: user.outletName ? `${user.outletName}, ${user.district || 'Colombo'}` : 'Colombo Outlet',
    freshnessInfo: 'Fresh surplus food prepared today',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    allergens: ['Gluten'],
  };
};

/**
 * @desc    Process AI Chat message and execute role-based intent handler
 * @route   POST /api/v1/ai/chat
 * @access  Private (All Roles)
 */
export const chatWithAI = async (req, res) => {
  try {
    const { message } = req.body;
    const user = req.user;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    const role = user.role || 'CONSUMER';
    const cleanMsg = message.trim();

    // -------------------------------------------------------------
    // ROLE 1: CONSUMER INTENT HANDLER (Natural Language Food Search)
    // -------------------------------------------------------------
    if (role === 'CONSUMER') {
      const parsed = parseConsumerQuery(cleanMsg);
      const query = {
        status: 'ACTIVE',
        collectionEndDate: { $gt: new Date() },
      };

      if (parsed.priceType !== 'ALL') query.priceType = parsed.priceType;
      if (parsed.category !== 'ALL') query.category = parsed.category;

      let listings = await Listing.find(query)
        .populate('vendor', 'name outletName email phone district vendorRating')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      if (parsed.district) {
        listings = listings.filter((l) => {
          const vDist = l.vendor?.district || '';
          const loc = l.outletLocation || '';
          return vDist.toLowerCase() === parsed.district.toLowerCase() || loc.toLowerCase().includes(parsed.district.toLowerCase());
        });
      }

      let textReply = `I searched for food matching "${cleanMsg}". Here are the top available surplus food listings found in Sri Lanka!`;
      if (listings.length === 0) {
        textReply = `I couldn't find any active listings matching "${cleanMsg}" right now. Try searching for "free bakery food in Colombo" or "discounted meals".`;
      }

      return res.status(200).json({
        success: true,
        intent: 'CONSUMER_SEARCH',
        reply: textReply,
        parsedFilters: parsed,
        listings,
      });
    }

    // -------------------------------------------------------------
    // ROLE 2: VENDOR INTENT HANDLER (Conversational Listing Creation)
    // -------------------------------------------------------------
    if (role === 'VENDOR') {
      if (!user.isVerified) {
        return res.status(200).json({
          success: true,
          intent: 'VENDOR_UNVERIFIED',
          reply: '⚠️ Your vendor account is currently pending verification by Administrators. Once verified, you can create listings via chat commands!',
        });
      }

      // Check if message is a create command
      if (cleanMsg.toLowerCase().includes('create') || cleanMsg.toLowerCase().includes('list') || cleanMsg.toLowerCase().includes('add')) {
        const listingData = parseVendorCreateCommand(cleanMsg, user);

        const newListing = await Listing.create({
          ...listingData,
          vendor: user._id,
          vendorName: user.outletName || user.name,
          district: user.district || 'Colombo',
        });

        return res.status(201).json({
          success: true,
          intent: 'VENDOR_LISTING_CREATED',
          reply: `🎉 Success! I published your surplus food listing "${newListing.title}" (${newListing.quantityKg} kg, ${newListing.priceType === 'FREE' ? 'FREE' : 'LKR ' + newListing.price}) to MongoDB Atlas!`,
          createdListing: newListing,
        });
      }

      return res.status(200).json({
        success: true,
        intent: 'VENDOR_HELP',
        reply: `Hi ${user.name}! You can create a new surplus food listing instantly by typing commands like: "Create listing: 10 kg fresh muffins for 500 LKR in Colombo outlet" or "List 5 kg free bread".`,
      });
    }

    // -------------------------------------------------------------
    // ROLE 3: ADMIN INTENT HANDLER (System Reports & Activity Queries)
    // -------------------------------------------------------------
    if (role === 'ADMIN') {
      const totalUsers = await User.countDocuments();
      const pendingVendors = await User.countDocuments({ role: 'VENDOR', isVerified: false });
      const activeListings = await Listing.countDocuments({ status: 'ACTIVE' });
      const totalOrders = await Order.countDocuments();
      const allListings = await Listing.find().select('collectedQuantityKg');
      const totalRescuedKg = allListings.reduce((sum, l) => sum + (l.collectedQuantityKg || 0), 0);

      const reportReply = `📊 Executive System Audit Report:\n\n• Total Platform Users: ${totalUsers}\n• Pending Vendor Approvals: ${pendingVendors}\n• Active Surplus Listings: ${activeListings}\n• Total Rescued Food: ${Math.round(totalRescuedKg * 10) / 10} kg\n• Total Food Rescue Orders: ${totalOrders}`;

      return res.status(200).json({
        success: true,
        intent: 'ADMIN_REPORT',
        reply: reportReply,
        adminMetrics: {
          totalUsers,
          pendingVendors,
          activeListings,
          totalRescuedKg,
          totalOrders,
        },
      });
    }

    res.status(200).json({
      success: true,
      intent: 'GENERAL',
      reply: 'Hello! I am your FoodSave LK AI Assistant. How can I help you reduce food waste today?',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

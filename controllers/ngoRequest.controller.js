import NgoRequest from '../models/NgoRequest.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

/**
 * @desc    Create a new Food Need Request (NGO Only)
 * @route   POST /api/v1/ngo-requests
 * @access  Private (NGO Only)
 */
export const createNgoRequest = async (req, res) => {
  try {
    const { foodCategory, quantityNeededKg, neededDate, description, district } = req.body;

    if (!quantityNeededKg || !neededDate || !description) {
      return res.status(400).json({ success: false, message: 'Quantity needed (kg), date, and description are required' });
    }

    const request = await NgoRequest.create({
      ngo: req.user.id,
      ngoName: req.user.name,
      district: district || req.user.district || 'Colombo',
      foodCategory: foodCategory || 'bakery',
      quantityNeededKg: Number(quantityNeededKg),
      fulfilledQuantityKg: 0,
      neededDate: new Date(neededDate),
      description,
      status: 'OPEN',
    });

    res.status(201).json({
      success: true,
      message: `Food need request for ${request.quantityNeededKg} kg created successfully! Vendors in ${request.district} have been notified.`,
      request,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get Food Need Requests (NGOs see own requests; Vendors see open requests in district)
 * @route   GET /api/v1/ngo-requests
 * @access  Private (All Roles)
 */
export const getNgoRequests = async (req, res) => {
  try {
    const { district, status } = req.query;
    const role = req.user.role;

    const query = {};

    if (role === 'NGO') {
      query.ngo = req.user.id;
    } else {
      // Vendors & Admins see active requests
      if (status && status !== 'ALL') {
        query.status = status;
      } else {
        query.status = { $in: ['OPEN', 'PARTIALLY_FULFILLED'] };
      }
    }

    let requests = await NgoRequest.find(query)
      .populate('ngo', 'name email phone district')
      .sort({ createdAt: -1 })
      .lean();

    if (district && district !== 'ALL') {
      requests = requests.filter((r) => r.district?.toLowerCase() === district.toLowerCase());
    }

    res.status(200).json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Vendor Fulfills / Pledges Food Donation to NGO Need Request
 * @route   POST /api/v1/ngo-requests/:id/fulfill
 * @access  Private (Vendor / Admin)
 */
export const fulfillNgoRequest = async (req, res) => {
  try {
    const { pledgedQuantityKg } = req.body;
    const requestId = req.params.id;

    if (!pledgedQuantityKg || Number(pledgedQuantityKg) <= 0) {
      return res.status(400).json({ success: false, message: 'Please specify a valid pledged quantity in kg' });
    }

    const request = await NgoRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'NGO Food Request not found' });
    }

    if (request.status === 'FULFILLED' || request.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: `Cannot pledge to request with status '${request.status}'` });
    }

    const qtyPledged = Number(pledgedQuantityKg);
    const newFulfilledQty = request.fulfilledQuantityKg + qtyPledged;

    request.fulfilledQuantityKg = Math.min(request.quantityNeededKg, newFulfilledQty);
    if (request.fulfilledQuantityKg >= request.quantityNeededKg) {
      request.status = 'FULFILLED';
    } else {
      request.status = 'PARTIALLY_FULFILLED';
    }

    // Add pledge log
    request.pledges.push({
      vendor: req.user.id,
      vendorName: req.user.name,
      outletName: req.user.outletName || req.user.name,
      pledgedQuantityKg: qtyPledged,
      pledgedAt: new Date(),
    });

    await request.save();

    // Create Notification for the NGO
    await Notification.create({
      recipient: request.ngo,
      title: 'Food Donation Pledged!',
      message: `${req.user.outletName || req.user.name} pledged ${qtyPledged} kg of food to fulfill your request for "${request.description}". (${request.fulfilledQuantityKg}/${request.quantityNeededKg} kg fulfilled).`,
      type: 'FOOD_COLLECTED',
      relatedUser: req.user.id,
    });

    res.status(200).json({
      success: true,
      message: `Thank you ${req.user.name}! Your donation pledge of ${qtyPledged} kg has been sent to ${request.ngoName}!`,
      request,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Cancel NGO Food Request
 * @route   PUT /api/v1/ngo-requests/:id/cancel
 * @access  Private (NGO Owner / Admin)
 */
export const cancelNgoRequest = async (req, res) => {
  try {
    const request = await NgoRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (request.ngo.toString() !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this request' });
    }

    request.status = 'CANCELLED';
    await request.save();

    res.status(200).json({
      success: true,
      message: 'NGO food need request cancelled',
      request,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

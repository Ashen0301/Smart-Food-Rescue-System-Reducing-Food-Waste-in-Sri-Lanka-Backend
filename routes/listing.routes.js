import express from 'express';
import {
  createListing,
  getVendorListings,
  getAllListings,
  getListingById,
  updateListing,
  deleteListing,
  duplicateListing,
  cancelListing,
} from '../controllers/listing.controller.js';
import { protect, authorizeRoles, requireVendorVerification } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.get('/', getAllListings);
router.get('/:id', getListingById);

// Protected Vendor routes
router.get('/vendor/me', protect, authorizeRoles('VENDOR', 'ADMIN'), getVendorListings);
router.post('/', protect, authorizeRoles('VENDOR', 'ADMIN'), requireVendorVerification, createListing);
router.put('/:id', protect, authorizeRoles('VENDOR', 'ADMIN'), updateListing);
router.delete('/:id', protect, authorizeRoles('VENDOR', 'ADMIN'), deleteListing);
router.post('/:id/duplicate', protect, authorizeRoles('VENDOR', 'ADMIN'), duplicateListing);
router.post('/:id/cancel', protect, authorizeRoles('VENDOR', 'ADMIN'), cancelListing);

export default router;

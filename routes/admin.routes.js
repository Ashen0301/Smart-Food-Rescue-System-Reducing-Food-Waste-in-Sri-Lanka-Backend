import express from 'express';
import {
  getAdminStats,
  getAllSystemListings,
  deleteSystemListing,
  getAllSystemOrders,
  toggleUserVerification,
} from '../controllers/admin.controller.js';
import { protect, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();

// Guard all admin routes with JWT protection and ADMIN role requirement
router.use(protect);
router.use(authorizeRoles('ADMIN'));

router.get('/stats', getAdminStats);
router.get('/listings', getAllSystemListings);
router.delete('/listings/:id', deleteSystemListing);
router.get('/orders', getAllSystemOrders);
router.put('/users/:id/toggle-verify', toggleUserVerification);

export default router;

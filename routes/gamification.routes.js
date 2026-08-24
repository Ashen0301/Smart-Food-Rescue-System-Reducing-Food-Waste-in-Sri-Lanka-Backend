import express from 'express';
import { getUserGamificationStats, getPublicLeaderboard } from '../controllers/gamification.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public Leaderboard API
router.get('/leaderboard', getPublicLeaderboard);

// Private User Gamification Stats API
router.get('/stats', protect, getUserGamificationStats);

export default router;

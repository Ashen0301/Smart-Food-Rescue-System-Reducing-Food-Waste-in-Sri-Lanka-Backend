import User from '../models/User.js';

// CATALOG OF ALL PLATFORM BADGES
export const BADGE_CATALOG = {
  // Vendor Badges
  v_pioneer: { badgeId: 'v_pioneer', name: 'Food Rescue Pioneer', icon: '🌱', description: 'Redistributed first 10 kg of surplus food' },
  v_bronze: { badgeId: 'v_bronze', name: 'Bronze Surplus Savior', icon: '🥉', description: 'Redistributed 50 kg of surplus food' },
  v_silver: { badgeId: 'v_silver', name: 'Silver Eco Champion', icon: '🥈', description: 'Redistributed 100 kg of surplus food' },
  v_gold: { badgeId: 'v_gold', name: 'Gold Waste Zero Hero', icon: '🥇', description: 'Redistributed 250 kg of surplus food' },
  v_legendary: { badgeId: 'v_legendary', name: 'Legendary Food Hero', icon: '👑', description: 'Redistributed 500+ kg of surplus food' },

  // Consumer Badges
  c_reliable: { badgeId: 'c_reliable', name: '100% Reliable Rescuer', icon: '⚡', description: 'Maintained 100% collection rate across 3+ rescues' },
  c_guardian: { badgeId: 'c_guardian', name: 'Star Food Guardian', icon: '🌟', description: 'Completed 5 successful food rescue collections' },
  c_punctual: { badgeId: 'c_punctual', name: 'Punctual Picker', icon: '🛡️', description: 'Completed 10 rescues with zero expired reservations' },
  c_hero: { badgeId: 'c_hero', name: 'Community Eco Hero', icon: '🦸', description: 'Rescued food 20+ times to reduce Sri Lankan food waste' },
};

/**
 * Helper: Evaluate and award new milestone badges to a user
 */
export const checkAndAwardBadges = async (user) => {
  if (!user) return;

  const existingBadgeIds = new Set((user.badges || []).map((b) => b.badgeId));
  const newBadges = [];

  if (user.role === 'VENDOR') {
    const kg = user.totalRescuedKg || 0;
    if (kg >= 10 && !existingBadgeIds.has('v_pioneer')) newBadges.push(BADGE_CATALOG.v_pioneer);
    if (kg >= 50 && !existingBadgeIds.has('v_bronze')) newBadges.push(BADGE_CATALOG.v_bronze);
    if (kg >= 100 && !existingBadgeIds.has('v_silver')) newBadges.push(BADGE_CATALOG.v_silver);
    if (kg >= 250 && !existingBadgeIds.has('v_gold')) newBadges.push(BADGE_CATALOG.v_gold);
    if (kg >= 500 && !existingBadgeIds.has('v_legendary')) newBadges.push(BADGE_CATALOG.v_legendary);
  } else if (user.role === 'CONSUMER' || user.role === 'NGO') {
    const completed = user.totalCompletedOrders || 0;
    const expired = user.totalExpiredOrders || 0;
    const rate = user.collectionRate || 100;

    if (rate >= 100 && completed >= 3 && !existingBadgeIds.has('c_reliable')) newBadges.push(BADGE_CATALOG.c_reliable);
    if (completed >= 5 && !existingBadgeIds.has('c_guardian')) newBadges.push(BADGE_CATALOG.c_guardian);
    if (completed >= 10 && expired === 0 && !existingBadgeIds.has('c_punctual')) newBadges.push(BADGE_CATALOG.c_punctual);
    if (completed >= 20 && !existingBadgeIds.has('c_hero')) newBadges.push(BADGE_CATALOG.c_hero);
  }

  if (newBadges.length > 0) {
    user.badges = [...(user.badges || []), ...newBadges];
    await user.save();
    console.log(`🏅 [Gamification] User ${user.name} earned ${newBadges.length} new badges:`, newBadges.map((b) => b.name));
  }
};

/**
 * @desc    Get Gamification Statistics & Badges for Logged-In User
 * @route   GET /api/v1/gamification/stats
 * @access  Private
 */
export const getUserGamificationStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Ensure badge evaluation runs
    await checkAndAwardBadges(user);

    // Calculate milestone progress
    let nextMilestone = null;
    if (user.role === 'VENDOR') {
      const kg = user.totalRescuedKg || 0;
      if (kg < 10) nextMilestone = { targetKg: 10, remainingKg: 10 - kg, name: 'Food Rescue Pioneer (🌱)' };
      else if (kg < 50) nextMilestone = { targetKg: 50, remainingKg: 50 - kg, name: 'Bronze Surplus Savior (🥉)' };
      else if (kg < 100) nextMilestone = { targetKg: 100, remainingKg: 100 - kg, name: 'Silver Eco Champion (🥈)' };
      else if (kg < 250) nextMilestone = { targetKg: 250, remainingKg: 250 - kg, name: 'Gold Waste Zero Hero (🥇)' };
      else if (kg < 500) nextMilestone = { targetKg: 500, remainingKg: 500 - kg, name: 'Legendary Food Hero (👑)' };
    } else {
      const completed = user.totalCompletedOrders || 0;
      if (completed < 5) nextMilestone = { targetCompleted: 5, remaining: 5 - completed, name: 'Star Food Guardian (🌟)' };
      else if (completed < 10) nextMilestone = { targetCompleted: 10, remaining: 10 - completed, name: 'Punctual Picker (🛡️)' };
      else if (completed < 20) nextMilestone = { targetCompleted: 20, remaining: 20 - completed, name: 'Community Eco Hero (🦸)' };
    }

    res.status(200).json({
      success: true,
      stats: {
        points: user.points || 0,
        totalRescuedKg: Math.round((user.totalRescuedKg || 0) * 10) / 10,
        totalCompletedOrders: user.totalCompletedOrders || 0,
        totalExpiredOrders: user.totalExpiredOrders || 0,
        collectionRate: Math.round(user.collectionRate || 100),
        reliabilityScore: user.reliabilityScore || 100,
        badges: user.badges || [],
        nextMilestone,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get Public Monthly / All-Time Contributor Leaderboard by District
 * @route   GET /api/v1/gamification/leaderboard
 * @access  Public
 */
export const getPublicLeaderboard = async (req, res) => {
  try {
    const { district, role } = req.query;

    const query = {};
    if (role && role !== 'ALL') {
      query.role = role;
    } else {
      query.role = { $in: ['CONSUMER', 'VENDOR', 'NGO'] };
    }

    if (district && district !== 'ALL') {
      query.district = { $regex: new RegExp(`^${district}$`, 'i') };
    }

    const topUsers = await User.find(query)
      .select('name outletName role district points totalRescuedKg collectionRate reliabilityScore vendorRating badges')
      .sort({ points: -1, totalRescuedKg: -1 })
      .limit(20)
      .lean();

    // Map ranks (1st: Gold, 2nd: Silver, 3rd: Bronze)
    const leaderboard = topUsers.map((u, index) => {
      let rankBadge = `#${index + 1}`;
      if (index === 0) rankBadge = '🥇 #1';
      else if (index === 1) rankBadge = '🥈 #2';
      else if (index === 2) rankBadge = '🥉 #3';

      return {
        rank: index + 1,
        rankBadge,
        id: u._id,
        name: u.role === 'VENDOR' ? (u.outletName || u.name) : u.name,
        role: u.role,
        district: u.district || 'Colombo',
        points: u.points || 0,
        totalRescuedKg: Math.round((u.totalRescuedKg || 0) * 10) / 10,
        collectionRate: Math.round(u.collectionRate || 100),
        badgesCount: u.badges?.length || 0,
        badges: u.badges || [],
      };
    });

    res.status(200).json({
      success: true,
      count: leaderboard.length,
      leaderboard,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

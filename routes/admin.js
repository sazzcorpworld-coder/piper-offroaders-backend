const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Drive = require('../models/Drive');
const ForumPost = require('../models/ForumPost');
const MarketplaceItem = require('../models/MarketplaceItem');
const Vote = require('../models/Vote');
const { auth, authorize } = require('../middleware/auth');

// Get all users (admin only)
router.get('/users', auth, authorize('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user role (admin only)
router.patch('/users/:id/role', 
  auth, 
  authorize('admin'),
  [
    body('role').isIn(['newbie', 'intermediate', 'advanced', 'marshal', 'admin']).withMessage('Invalid role')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findById(req.params.id);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      user.role = req.body.role;
      await user.save();

      res.json(user);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Ban/unban user (admin only)
router.patch('/users/:id/ban', auth, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isBanned = !user.isBanned;
    await user.save();

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get dashboard stats (admin only)
router.get('/dashboard', auth, authorize('admin'), async (req, res) => {
  try {
    const stats = {
      totalUsers: await User.countDocuments(),
      totalDrives: await Drive.countDocuments(),
      totalMarketplaceItems: await MarketplaceItem.countDocuments(),
      totalForumPosts: await ForumPost.countDocuments(),
      openVotes: await Vote.countDocuments({ status: 'open' }),
      upcomingDrives: await Drive.countDocuments({ status: 'upcoming' }),
      activeMarketplaceItems: await MarketplaceItem.countDocuments({ status: 'available' })
    };

    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete drive (admin only)
router.delete('/drives/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const drive = await Drive.findById(req.params.id);
    
    if (!drive) {
      return res.status(404).json({ message: 'Drive not found' });
    }

    await Drive.findByIdAndDelete(req.params.id);

    res.json({ message: 'Drive deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get voting history (admin only)
router.get('/votes/history', auth, authorize('admin'), async (req, res) => {
  try {
    const votes = await Vote.find()
      .populate('candidate', 'name role')
      .populate('initiatedBy', 'name')
      .populate('votes.marshal', 'name')
      .sort({ createdAt: -1 });

    res.json(votes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get system logs (placeholder for future implementation)
router.get('/logs', auth, authorize('admin'), async (req, res) => {
  try {
    // Placeholder for system logs
    res.json({ message: 'System logs endpoint - to be implemented' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
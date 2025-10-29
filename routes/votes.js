const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Vote = require('../models/Vote');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

// Get all votes (admin only)
router.get('/', auth, authorize('admin'), async (req, res) => {
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

// Get open votes (for marshals)
router.get('/open', auth, authorize('marshal', 'admin'), async (req, res) => {
  try {
    const votes = await Vote.find({ status: 'open' })
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

// Get user's promotion votes
router.get('/my-votes', auth, async (req, res) => {
  try {
    const votes = await Vote.find({ candidate: req.user.id })
      .populate('initiatedBy', 'name')
      .populate('votes.marshal', 'name')
      .sort({ createdAt: -1 });

    res.json(votes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Initiate promotion vote (marshal/admin only)
router.post('/initiate', 
  auth, 
  authorize('marshal', 'admin'),
  [
    body('candidateId').isMongoId().withMessage('Invalid candidate ID'),
    body('targetLevel').isIn(['intermediate', 'advanced', 'marshal']).withMessage('Invalid target level')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { candidateId, targetLevel } = req.body;

      // Check if candidate exists
      const candidate = await User.findById(candidateId);
      if (!candidate) {
        return res.status(404).json({ message: 'Candidate not found' });
      }

      // Check if promotion is valid
      const levelOrder = { 'newbie': 1, 'intermediate': 2, 'advanced': 3, 'marshal': 4 };
      const currentLevelOrder = levelOrder[candidate.role];
      const targetLevelOrder = levelOrder[targetLevel];

      if (targetLevelOrder <= currentLevelOrder) {
        return res.status(400).json({ message: 'Invalid promotion path' });
      }

      // Check if there's already an open vote for this candidate
      const existingVote = await Vote.findOne({ 
        candidate: candidateId, 
        status: 'open' 
      });

      if (existingVote) {
        return res.status(400).json({ message: 'There is already an open vote for this candidate' });
      }

      const vote = new Vote({
        candidate: candidateId,
        currentLevel: candidate.role,
        targetLevel,
        initiatedBy: req.user.id
      });

      await vote.save();
      await vote.populate('candidate', 'name role');
      await vote.populate('initiatedBy', 'name');

      res.status(201).json(vote);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Cast vote (marshal only)
router.post('/:id/vote', 
  auth, 
  authorize('marshal'),
  [
    body('decision').isIn(['approve', 'reject']).withMessage('Invalid decision')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const vote = await Vote.findById(req.params.id);
      
      if (!vote) {
        return res.status(404).json({ message: 'Vote not found' });
      }

      if (vote.status !== 'open') {
        return res.status(400).json({ message: 'Vote is closed' });
      }

      // Check if user has already voted
      const hasVoted = vote.votes.some(v => v.marshal.toString() === req.user.id);
      if (hasVoted) {
        return res.status(400).json({ message: 'You have already voted' });
      }

      vote.votes.push({
        marshal: req.user.id,
        decision: req.body.decision
      });

      // Check if vote should be closed (simple majority)
      const approveCount = vote.votes.filter(v => v.decision === 'approve').length;
      const rejectCount = vote.votes.filter(v => v.decision === 'reject').length;
      const totalMarshals = await User.countDocuments({ role: 'marshal' });
      const majority = Math.ceil(totalMarshals / 2);

      if (approveCount >= majority || rejectCount >= majority || vote.votes.length >= totalMarshals) {
        vote.status = 'closed';
        vote.finalDecision = approveCount > rejectCount ? 'approved' : 'rejected';
        vote.decidedAt = new Date();

        // If approved, update user's role
        if (vote.finalDecision === 'approved') {
          await User.findByIdAndUpdate(vote.candidate, { role: vote.targetLevel });
        }
      }

      await vote.save();
      await vote.populate('votes.marshal', 'name');

      res.json(vote);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Admin decision on vote
router.post('/:id/decide', 
  auth, 
  authorize('admin'),
  [
    body('decision').isIn(['approve', 'reject']).withMessage('Invalid decision')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const vote = await Vote.findById(req.params.id);
      
      if (!vote) {
        return res.status(404).json({ message: 'Vote not found' });
      }

      if (vote.status !== 'open' && vote.status !== 'closed') {
        return res.status(400).json({ message: 'Vote cannot be decided' });
      }

      vote.status = 'approved';
      vote.finalDecision = req.body.decision;
      vote.decidedAt = new Date();

      // Update user's role if approved
      if (req.body.decision === 'approve') {
        await User.findByIdAndUpdate(vote.candidate, { role: vote.targetLevel });
      }

      await vote.save();
      await vote.populate('votes.marshal', 'name');

      res.json(vote);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;
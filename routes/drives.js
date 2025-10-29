const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Drive = require('../models/Drive');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/drives/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Get all drives
router.get('/', auth, async (req, res) => {
  try {
    const drives = await Drive.find()
      .populate('marshal', 'name')
      .populate('participants.user', 'name role')
      .populate('waitlist.user', 'name role')
      .sort({ dateTime: 1 });

    res.json(drives);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single drive
router.get('/:id', auth, async (req, res) => {
  try {
    const drive = await Drive.findById(req.params.id)
      .populate('marshal', 'name')
      .populate('participants.user', 'name role')
      .populate('waitlist.user', 'name role');

    if (!drive) {
      return res.status(404).json({ message: 'Drive not found' });
    }

    res.json(drive);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new drive (marshals only)
router.post('/', 
  auth, 
  authorize('marshal', 'admin'),
  upload.single('image'),
  [
    body('title').trim().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
    body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
    body('location').trim().isLength({ min: 3 }).withMessage('Location is required'),
    body('requiredLevel').isIn(['newbie', 'intermediate', 'advanced']).withMessage('Invalid required level'),
    body('dateTime').isISO8601().withMessage('Invalid date format'),
    body('maxParticipants').isInt({ min: 1 }).withMessage('Max participants must be at least 1')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, description, location, requiredLevel, dateTime, maxParticipants } = req.body;

      const drive = new Drive({
        title,
        description,
        location,
        requiredLevel,
        dateTime: new Date(dateTime),
        maxParticipants: parseInt(maxParticipants),
        marshal: req.user.id,
        image: req.file ? req.file.path : ''
      });

      await drive.save();
      await drive.populate('marshal', 'name');

      res.status(201).json(drive);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Join drive
router.post('/:id/join', auth, async (req, res) => {
  try {
    const drive = await Drive.findById(req.params.id);
    
    if (!drive) {
      return res.status(404).json({ message: 'Drive not found' });
    }

    // Check if drive is upcoming
    if (drive.status !== 'upcoming') {
      return res.status(400).json({ message: 'Cannot join completed or cancelled drive' });
    }

    // Check if user meets required level
    const userLevelOrder = { 'newbie': 1, 'intermediate': 2, 'advanced': 3, 'marshal': 4, 'admin': 5 };
    const requiredLevelOrder = { 'newbie': 1, 'intermediate': 2, 'advanced': 3 };
    
    if (userLevelOrder[req.user.role] < requiredLevelOrder[drive.requiredLevel]) {
      return res.status(403).json({ message: 'Your level is not high enough for this drive' });
    }

    // Check if user is already participating
    const isParticipant = drive.participants.some(p => p.user.toString() === req.user.id);
    const isInWaitlist = drive.waitlist.some(w => w.user.toString() === req.user.id);
    
    if (isParticipant || isInWaitlist) {
      return res.status(400).json({ message: 'You are already registered for this drive' });
    }

    // Check if there's space available
    if (drive.participants.length < drive.maxParticipants) {
      drive.participants.push({ user: req.user.id });
    } else {
      drive.waitlist.push({ user: req.user.id });
    }

    await drive.save();
    await drive.populate('participants.user', 'name role');
    await drive.populate('waitlist.user', 'name role');

    res.json(drive);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel participation
router.post('/:id/cancel', auth, async (req, res) => {
  try {
    const drive = await Drive.findById(req.params.id);
    
    if (!drive) {
      return res.status(404).json({ message: 'Drive not found' });
    }

    // Find and remove user from participants
    const participantIndex = drive.participants.findIndex(p => p.user.toString() === req.user.id);
    const waitlistIndex = drive.waitlist.findIndex(w => w.user.toString() === req.user.id);

    if (participantIndex === -1 && waitlistIndex === -1) {
      return res.status(400).json({ message: 'You are not registered for this drive' });
    }

    if (participantIndex !== -1) {
      drive.participants.splice(participantIndex, 1);
      
      // Move first person from waitlist to participants if available
      if (drive.waitlist.length > 0) {
        const firstWaitlist = drive.waitlist.shift();
        drive.participants.push({ user: firstWaitlist.user });
      }
    } else {
      drive.waitlist.splice(waitlistIndex, 1);
    }

    await drive.save();
    await drive.populate('participants.user', 'name role');
    await drive.populate('waitlist.user', 'name role');

    res.json(drive);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark attendance (marshal only)
router.post('/:id/attendance', auth, authorize('marshal', 'admin'), async (req, res) => {
  try {
    const { userId, status } = req.body;
    
    const drive = await Drive.findById(req.params.id);
    
    if (!drive) {
      return res.status(404).json({ message: 'Drive not found' });
    }

    // Check if the requesting user is the marshal of this drive
    if (drive.marshal.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the drive marshal can mark attendance' });
    }

    const participant = drive.participants.find(p => p.user.toString() === userId);
    
    if (!participant) {
      return res.status(404).json({ message: 'Participant not found' });
    }

    participant.status = status;
    
    // Update user's drives completed count if attended
    if (status === 'attended') {
      await User.findByIdAndUpdate(userId, { $inc: { drivesCompleted: 1 } });
    }

    // Update drive status to completed if all participants have been marked
    const allMarked = drive.participants.every(p => p.status !== 'joined');
    if (allMarked) {
      drive.status = 'completed';
    }

    await drive.save();

    res.json(drive);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

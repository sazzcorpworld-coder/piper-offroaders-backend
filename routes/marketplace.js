const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const MarketplaceItem = require('../models/MarketplaceItem');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configure multer for multiple image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/marketplace/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit per file
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Get all marketplace items
router.get('/', auth, async (req, res) => {
  try {
    const { category, status } = req.query;
    let query = {};
    
    if (category) query.category = category;
    if (status) query.status = status;

    const items = await MarketplaceItem.find(query)
      .populate('seller', 'name')
      .sort({ createdAt: -1 });

    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single marketplace item
router.get('/:id', auth, async (req, res) => {
  try {
    const item = await MarketplaceItem.findById(req.params.id)
      .populate('seller', 'name');

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new marketplace item
router.post('/', 
  auth,
  upload.array('images', 5),
  [
    body('title').trim().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
    body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('contactMethod').trim().isLength({ min: 3 }).withMessage('Contact method is required'),
    body('category').isIn(['parts', 'accessories', 'vehicles', 'gear', 'other']).withMessage('Invalid category')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, description, price, contactMethod, category } = req.body;

      const item = new MarketplaceItem({
        title,
        description,
        price: parseFloat(price),
        contactMethod,
        category,
        seller: req.user.id,
        images: req.files ? req.files.map(file => file.path) : []
      });

      await item.save();
      await item.populate('seller', 'name');

      res.status(201).json(item);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Update marketplace item
router.put('/:id', 
  auth,
  upload.array('images', 5),
  [
    body('title').trim().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
    body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('contactMethod').trim().isLength({ min: 3 }).withMessage('Contact method is required'),
    body('category').isIn(['parts', 'accessories', 'vehicles', 'gear', 'other']).withMessage('Invalid category')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const item = await MarketplaceItem.findById(req.params.id);
      
      if (!item) {
        return res.status(404).json({ message: 'Item not found' });
      }

      // Check if user is the seller
      if (item.seller.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized to update this item' });
      }

      const { title, description, price, contactMethod, category } = req.body;

      item.title = title;
      item.description = description;
      item.price = parseFloat(price);
      item.contactMethod = contactMethod;
      item.category = category;

      // Add new images if uploaded
      if (req.files && req.files.length > 0) {
        item.images = [...item.images, ...req.files.map(file => file.path)];
      }

      await item.save();
      await item.populate('seller', 'name');

      res.json(item);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Mark item as sold
router.patch('/:id/sold', auth, async (req, res) => {
  try {
    const item = await MarketplaceItem.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Check if user is the seller
    if (item.seller.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to mark this item as sold' });
    }

    item.status = 'sold';
    item.soldAt = new Date();

    await item.save();

    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete marketplace item
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await MarketplaceItem.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Check if user is the seller or admin
    if (item.seller.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this item' });
    }

    await MarketplaceItem.findByIdAndDelete(req.params.id);

    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
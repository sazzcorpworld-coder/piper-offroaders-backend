const mongoose = require('mongoose');

const marketplaceItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  contactMethod: {
    type: String,
    required: true
  },
  images: [{
    type: String
  }],
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['available', 'sold'],
    default: 'available'
  },
  soldAt: {
    type: Date,
    default: null
  },
  category: {
    type: String,
    enum: ['parts', 'accessories', 'vehicles', 'gear', 'other'],
    default: 'other'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MarketplaceItem', marketplaceItemSchema);
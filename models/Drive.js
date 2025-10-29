const mongoose = require('mongoose');

const driveSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  requiredLevel: {
    type: String,
    enum: ['newbie', 'intermediate', 'advanced'],
    required: true
  },
  dateTime: {
    type: Date,
    required: true
  },
  image: {
    type: String,
    default: ''
  },
  maxParticipants: {
    type: Number,
    required: true,
    min: 1
  },
  marshal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['joined', 'attended', 'absent', 'cancelled'],
      default: 'joined'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  waitlist: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
    default: 'upcoming'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Drive', driveSchema);
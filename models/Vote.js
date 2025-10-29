const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  currentLevel: {
    type: String,
    enum: ['newbie', 'intermediate', 'advanced'],
    required: true
  },
  targetLevel: {
    type: String,
    enum: ['intermediate', 'advanced', 'marshal'],
    required: true
  },
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'closed', 'approved', 'rejected'],
    default: 'open'
  },
  votes: [{
    marshal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    decision: {
      type: String,
      enum: ['approve', 'reject'],
      required: true
    },
    votedAt: {
      type: Date,
      default: Date.now
    }
  }],
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    }
  },
  finalDecision: {
    type: String,
    enum: ['approved', 'rejected'],
    default: null
  },
  decidedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Vote', voteSchema);
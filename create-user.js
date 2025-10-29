const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

async function createRegularUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/piper-offroaders-club');
    console.log('Connected to MongoDB');

    // Check if user already exists
    const existingUser = await User.findOne({ email: 'user@piperoffroaders.com' });
    
    if (existingUser) {
      console.log('Regular user account already exists');
      console.log('Email: user@piperoffroaders.com');
      console.log('Password: user123');
      process.exit(0);
    }

    // Create default regular user
    const regularUser = new User({
      name: 'Mike Driver',
      email: 'user@piperoffroaders.com',
      password: 'user123',
      phone: '+1-555-DRIVER',
      role: 'intermediate',
      drivesCompleted: 8,
      isBanned: false
    });

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    regularUser.password = await bcrypt.hash(regularUser.password, salt);

    // Save the user
    await regularUser.save();

    console.log('Regular user account created successfully!');
    console.log('Email: user@piperoffroaders.com');
    console.log('Password: user123');
    console.log('Phone: +1-555-DRIVER');
    console.log('Role: Intermediate');
    console.log('');
    console.log('This account can join intermediate-level drives and use the marketplace/forum.');

    process.exit(0);
  } catch (error) {
    console.error('Error creating regular user account:', error);
    process.exit(1);
  }
}

createRegularUser();
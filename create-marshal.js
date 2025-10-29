const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

async function createMarshalAccount() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/piper-offroaders-club');
    console.log('Connected to MongoDB');

    // Check if marshal already exists
    const existingMarshal = await User.findOne({ email: 'marshal@piperoffroaders.com' });
    
    if (existingMarshal) {
      console.log('Marshal account already exists');
      console.log('Email: marshal@piperoffroaders.com');
      console.log('Password: marshal123');
      process.exit(0);
    }

    // Create default marshal user
    const marshalUser = new User({
      name: 'John Marshal',
      email: 'marshal@piperoffroaders.com',
      password: 'marshal123',
      phone: '+1-555-MARSHAL',
      role: 'marshal',
      drivesCompleted: 15,
      isBanned: false
    });

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    marshalUser.password = await bcrypt.hash(marshalUser.password, salt);

    // Save the marshal user
    await marshalUser.save();

    console.log('Default marshal account created successfully!');
    console.log('Email: marshal@piperoffroaders.com');
    console.log('Password: marshal123');
    console.log('Phone: +1-555-MARSHAL');
    console.log('Role: Marshal');
    console.log('');
    console.log('This account can post drives and vote on member promotions.');

    process.exit(0);
  } catch (error) {
    console.error('Error creating marshal account:', error);
    process.exit(1);
  }
}

createMarshalAccount();
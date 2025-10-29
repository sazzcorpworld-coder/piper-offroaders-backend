const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

async function setupDefaultAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/piper-offroaders-club');
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@piperoffroaders.com' });
    
    if (existingAdmin) {
      console.log('Admin account already exists');
      console.log('Email: admin@piperoffroaders.com');
      console.log('Password: admin123');
      process.exit(0);
    }

    // Create default admin user
    const adminUser = new User({
      name: 'System Administrator',
      email: 'admin@piperoffroaders.com',
      password: 'admin123',
      phone: '+1-555-ADMIN-1',
      role: 'admin',
      drivesCompleted: 0,
      isBanned: false
    });

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    adminUser.password = await bcrypt.hash(adminUser.password, salt);

    // Save the admin user
    await adminUser.save();

    console.log('Default admin account created successfully!');
    console.log('Email: admin@piperoffroaders.com');
    console.log('Password: admin123');
    console.log('Phone: +1-555-ADMIN-1');
    console.log('Role: Admin');
    console.log('');
    console.log('You can now log in with these credentials.');

    process.exit(0);
  } catch (error) {
    console.error('Error setting up admin account:', error);
    process.exit(1);
  }
}

setupDefaultAdmin();
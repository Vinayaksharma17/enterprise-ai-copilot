import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/user.model';

const seedAdmin = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined');
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const adminEmail = process.env.ADMIN_EMAIL || 'admin1@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || 'Administrator';
    const adminDepartment = process.env.ADMIN_DEPARTMENT || 'Admin';

    if (!adminPassword) {
      console.error('ADMIN_PASSWORD is required');
      process.exit(1);
    }

    const existingAdmin = await User.findOne({ email: adminEmail.toLowerCase(), role: 'admin' });
    if (existingAdmin) {
      console.log('Admin already exists. Skipping seed.');
      await mongoose.disconnect();
      process.exit(0);
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const passwordHash = await bcrypt.hash(adminPassword, rounds);

    await User.create({
      name: adminName,
      email: adminEmail.toLowerCase(),
      passwordHash,
      role: 'admin',
      department: adminDepartment,
      isActive: true,
    });

    console.log('Admin user created successfully');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();

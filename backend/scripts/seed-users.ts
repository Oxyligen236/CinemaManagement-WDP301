import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

function getMongoUri(): string {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^MONGODB_URI=(.*)$/m);
    if (match && match[1]?.trim()) {
      return match[1].trim();
    }
  }
  return process.env.MONGODB_URI || 'mongodb://localhost:27017/wdp';
}

async function seedUsers() {
  const mongoUri = getMongoUri();
  console.log(`Connecting to MongoDB at: ${mongoUri}`);

  await mongoose.connect(mongoUri);

  const usersCollection = mongoose.connection.collection('users');

  const defaultUsers = [
    {
      email: 'admin@mycast.vn',
      password: 'AdminPassword123!',
      firstName: 'Admin',
      lastName: 'System',
      role: 'ADMIN',
      isActive: true,
    },
    {
      email: 'customer@mycast.vn',
      password: 'CustomerPassword123!',
      firstName: 'Customer',
      lastName: 'User',
      role: 'USER',
      isActive: true,
    },
  ];

  for (const user of defaultUsers) {
    const existing = await usersCollection.findOne({ email: user.email.toLowerCase() });
    const hashedPassword = await bcrypt.hash(user.password, 10);

    if (existing) {
      await usersCollection.updateOne(
        { email: user.email.toLowerCase() },
        {
          $set: {
            password: hashedPassword,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isActive: user.isActive,
            updatedAt: new Date(),
          },
        },
      );
      console.log(`Updated user: ${user.email} (Role: ${user.role})`);
    } else {
      await usersCollection.insertOne({
        userId: randomUUID(),
        email: user.email.toLowerCase(),
        password: hashedPassword,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`Created user: ${user.email} (Role: ${user.role})`);
    }
  }

  await mongoose.disconnect();
  console.log('User seeding completed successfully!');
}

seedUsers().catch((err) => {
  console.error('Failed to seed users:', err);
  process.exit(1);
});

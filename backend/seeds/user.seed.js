import { connectDB } from '../config/db.js';
import { User } from '../modules/user/user.model.js';

const seedUsers = [
  { email: 'admin@kc-ai.com', password: 'admin123', name: 'Super Admin', role: 'super_admin' },
  { email: 'finance@kc-ai.com', password: 'finance123', name: 'Finance User', role: 'finance' },
  { email: 'viewer@kc-ai.com', password: 'viewer123', name: 'Viewer User', role: 'viewer' },
];

const seed = async () => {
  try {
    await connectDB();

    for (const u of seedUsers) {
      const existing = await User.findOne({ email: u.email });
      if (existing) {
        console.log(`User ${u.email} already exists. Skipping.`);
        continue;
      }
      const user = new User({
        email: u.email,
        password: u.password,
        name: u.name,
        role: u.role,
      });
      await user.save();
      console.log(`User ${u.email} (${u.role}) created successfully`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  }
};

seed();

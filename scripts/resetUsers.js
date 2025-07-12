const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/user');

const users = [
  { email: 'admin@example.com', name: 'Admin', password: 'admin123', role: 'admin' },
  { email: 'kofi@example.com', name: 'Kofi', password: 'kofi123', role: 'agent' },
  { email: 'kwesi@example.com', name: 'Kwesi', password: 'kwesi123', role: 'agent' },
  { email: 'rinel@example.com', name: 'Rinel Faith', password: 'rinel123', role: 'supervisor' },
  { email: 'haggi@example.com', name: 'Haggi Kusi', password: 'haggi123', role: 'supervisor' },
  { email: 'segbot@system.local', name: 'SEGbot', password: 'segbot123', role: 'bot' },
];

async function upsertUser({ email, name, password, role }) {
  let user = await User.findOne({ email });
  if (user) {
    user.name = name;
    user.password = password;
    user.role = role;
    await user.save();
    console.log(`Updated user: ${email}`);
  } else {
    user = new User({ email, name, password, role });
    await user.save();
    console.log(`Created user: ${email}`);
  }
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/omni-chat-app');
  for (const u of users) {
    await upsertUser(u);
  }
  await mongoose.disconnect();
  console.log('Done!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}); 
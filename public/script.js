const createDefaultAdmin = async () => {
  const exists = await User.findOne({ role: 'admin' });
  if (!exists) {
    const admin = new User({
      name: 'Admin',
      email: 'admin@example.com',
      password: 'admin123',
      role: 'admin'
    });
    await admin.save();
    console.log('✅ Default admin created: admin@example.com / admin123');
  }
};

const User = require('../models/User');

exports.addUser = async (req, res) => {
  try {
    const { name, email, password, role, supervisor_id } = req.body;

    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const newUser = new User({
      name,
      email,
      password,
      role,
      supervisor_id: supervisor_id || null
    });

    await newUser.save();
    res.status(201).json({ message: 'User added successfully', user: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

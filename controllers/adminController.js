exports.getAllUsers = (req, res) => {
  res.json({ message: 'All users' });
};

exports.getAllMessages = (req, res) => {
  res.json({ message: 'All messages' });
};

exports.getStats = (req, res) => {
  res.json({ message: 'Stats' });
};

exports.createUser = (req, res) => {
  res.json({ message: 'User created' });
};
exports.getRecentActivity = (req, res) => {
  res.json({ message: 'Recent activity data' });
};

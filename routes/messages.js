const express = require('express');
const router = express.Router();
const Message = require('../models/message');
const { auth } = require('../middleware/auth');

router.get('/conversations/:platform', auth, async (req, res) => {
  const convos = await Message.aggregate([
    { $match: { platform: req.params.platform } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$platformThreadId', doc: { $first: '$$ROOT' }}},
    { $replaceRoot: { newRoot: '$doc' } }
  ]);
  res.json(convos);
});

router.get('/thread/:platform/:threadId', auth, async (req, res) => {
  const messages = await Message.find({
    platform: req.params.platform,
    platformThreadId: req.params.threadId
  }).sort('createdAt');
  res.json(messages);
});

router.post('/', auth, require('../controllers/messageController').sendMessage);
module.exports = router;

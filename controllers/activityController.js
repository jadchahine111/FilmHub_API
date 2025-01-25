const Activity = require('../models/activityModel');
const WebSocket = require('ws');
const { setCache } = require('../middlewares/cachingMiddleware');

const getUserActivity = async (req, res) => {
  try {
    const activities = await Activity.find({ user: req.user.id })
      .sort({ date: -1 })
      .limit(10);

    // Check if no activities are found
    if (activities.length === 0) {
      res.json({ recentActivity: [] });
      return;
    }

    res.json({ recentActivity: activities });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};


const broadcastActivity = (activity) => {
  if (broadcastActivity.wss) {
    broadcastActivity.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(activity));
      }
    });
  }
};

module.exports = {
  getUserActivity,
  broadcastActivity
};
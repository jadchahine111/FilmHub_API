const jwt = require('jsonwebtoken');

// Protect middleware to verify JWT from cookies
const protect = async (req, res, next) => {
  try {
    // Get the access token from HTTP-only cookies
    const accessToken = req.cookies.accessToken;

    if (!accessToken) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
      // Verify the access token
      const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);

      // Attach user info to the request object
      req.user = decoded;
      return next();
    } catch (error) {
      // Access token is invalid or expired
      return res.status(401).json({ message: 'Invalid or expired access token' });
    }
  } catch (err) {
    console.error('Error in protect middleware:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { protect };

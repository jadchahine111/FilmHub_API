const Redis = require('ioredis');

// Use the REDIS_URL environment variable for Redis connection
const redis = new Redis(process.env.REDIS_URL);

redis.on('connect', () => console.log('Connected to Redis'));
redis.on('error', (err) => console.error('Redis connection error:', err));

module.exports = redis;

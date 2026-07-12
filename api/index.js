const app = require('../BACKEND/server');

// Vercel's Node.js runtime automatically parses JSON request bodies and
// consumes the raw stream. Express's body parser then fails on the consumed
// stream. This wrapper ensures the Vercel-parsed body survives into Express.
module.exports = app;

// Tell Vercel NOT to parse the body — let Express handle it instead.
// This keeps the raw stream intact for express.json() to consume.
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

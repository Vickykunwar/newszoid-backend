const app = require('../BACKEND/server');

// Vercel's Node.js runtime automatically parses JSON request bodies and
// consumes the raw stream before Express gets it. This wrapper intercepts
// the Vercel-parsed body and injects it into the Express request so that
// express.json() doesn't fail on the consumed stream.
module.exports = (req, res) => {
  // Vercel sets req.body with the pre-parsed body.
  // Store it so Express middleware can find it.
  if (req.body && typeof req.body === 'object') {
    // Flag so our body-parser middleware knows to skip parsing.
    req._vercelParsed = true;
  }
  return app(req, res);
};

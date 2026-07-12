const app = require('../BACKEND/server');
module.exports = app;

// Tell Vercel NOT to parse the request body — Express handles it.
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

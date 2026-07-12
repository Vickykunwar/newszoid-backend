const app = require('../BACKEND/server');
module.exports = app;

// Tell Vercel NOT to parse the request body — Express handles it.
// This config is only respected on the actual serverless function file,
// NOT when accessed via vercel.json rewrites.
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

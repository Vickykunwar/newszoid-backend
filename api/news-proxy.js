// Vercel may resolve this exact file before the Express catch-all. Reuse the
// same RSS implementation in both cases so headline and URL sanitisation
// cannot diverge between development and production routing.
module.exports = require('../BACKEND/controllers/newsProxyController').fetchNewsProxy;

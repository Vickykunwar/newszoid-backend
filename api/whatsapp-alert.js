// Kept for Vercel's file-based routing. The deployed Express catch-all also
// mounts this handler, so both route shapes have identical, non-simulated
// behaviour.
module.exports = require('../BACKEND/controllers/whatsappAlertController').handler;

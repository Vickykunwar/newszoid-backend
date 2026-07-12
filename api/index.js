const app = require('../BACKEND/server');

module.exports = app;
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

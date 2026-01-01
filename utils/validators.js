// utils/validators.js
module.exports = {
  isEmail: (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
};

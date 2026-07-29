/*
 * Assign existing BusinessProfile records to already-created User accounts with
 * the same email address. This script deliberately never creates an account or
 * guesses ownership. Run it first without --apply, resolve every unmatched
 * record, then run again with --apply before relying on authenticated profiles.
 *
 * Usage: node scripts/migrate-profile-users.js [--apply]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const BusinessProfile = require('../BACKEND/models/BusinessProfile');
const User = require('../BACKEND/models/User');

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGO_URI);

  const legacyProfiles = await BusinessProfile.find({
    $or: [{ userId: { $exists: false } }, { userId: null }],
  }).lean();
  const unmatched = [];
  let migrated = 0;

  for (const profile of legacyProfiles) {
    const email = String(profile.email || '').trim().toLowerCase();
    const user = email ? await User.findOne({ email }).select('_id').lean() : null;
    if (!user) {
      unmatched.push({ id: String(profile._id), email: email || '(missing)' });
      continue;
    }
    if (apply) await BusinessProfile.updateOne({ _id: profile._id }, { $set: { userId: user._id } });
    migrated += 1;
  }

  console.log(`${apply ? 'Migrated' : 'Would migrate'} ${migrated} of ${legacyProfiles.length} legacy profiles.`);
  if (unmatched.length) {
    console.error('Unmatched profiles (assign ownership manually; the script did not modify them):');
    console.error(JSON.stringify(unmatched, null, 2));
    process.exitCode = 1;
  }

  await mongoose.disconnect();
}

main().catch(error => {
  console.error('Profile migration failed:', error.message);
  process.exitCode = 1;
});

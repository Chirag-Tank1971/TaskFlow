/**
 * Create (or promote) an admin/manager account from the command line.
 * Public signup only allows the very first admin; use this for every one after that.
 *
 * Usage: node scripts/createAdmin.js <email> <password> "<name>" [admin|manager]
 */

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const createAdmin = async () => {
  const [email, password, name, role = "admin"] = process.argv.slice(2);

  if (!email || !password || !name || !["admin", "manager"].includes(role)) {
    console.error('Usage: node scripts/createAdmin.js <email> <password> "<name>" [admin|manager]');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("Password must be at least 6 characters");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URL || process.env.MONGODB_URI);

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { name, password: hashedPassword, role },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`✅ ${role} account ready: ${user.email}`);
  } catch (error) {
    console.error("❌ Failed to create admin:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

createAdmin();

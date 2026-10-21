const mongoose = require('mongoose');

async function connectDatabase(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
  return mongoose.connection;
}

module.exports = { connectDatabase };
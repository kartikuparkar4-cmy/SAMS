const { config, validateConfig } = require('../config');
const { connectDatabase } = require('../config/db');
const Provider = require('../models/Provider');

const demoProviders = [
  { name: 'Dr. Maya Chen', serviceCategory: 'Primary Care' },
  { name: 'Dr. Elias Park', serviceCategory: 'Cardiology' },
  { name: 'Dr. Priya Rao', serviceCategory: 'Dermatology' },
  { name: 'Dr. Nora Lewis', serviceCategory: 'Pediatrics' },
  { name: 'Dr. Mateo Silva', serviceCategory: 'Orthopedics' },
  { name: 'Dr. Amara Okafor', serviceCategory: 'Women’s Health' }
];

async function seed() {
  validateConfig();
  await connectDatabase(config.mongoUri);
  for (const provider of demoProviders) {
    await Provider.updateOne(
      { name: provider.name, serviceCategory: provider.serviceCategory },
      { $set: { ...provider, active: true, schedule: { daysOfWeek: [1, 2, 3, 4, 5], slots: ['08:30', '09:30', '10:30', '13:00', '14:00', '15:00'] } } },
      { upsert: true }
    );
  }
  console.log(`Seeded ${demoProviders.length} fictional providers.`);
}

seed().catch((error) => {
  console.error(`Provider seeding failed: ${error.message}`);
  process.exitCode = 1;
}).finally(async () => {
  await require('mongoose').disconnect();
});
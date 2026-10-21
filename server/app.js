const path = require('node:path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { config } = require('./config');
const appointmentRoutes = require('./routes/appointmentRoutes');
const authRoutes = require('./routes/authRoutes');
const providerRoutes = require('./routes/providerRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();
const clientDirectory = path.resolve(__dirname, '../client');

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:', 'https://images.unsplash.com'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || config.frontendOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  }
}));
app.use(express.json({ limit: '16kb', strict: true }));
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: require('mongoose').connection.readyState === 1 ? 'connected' : 'disconnected' });
});
app.use('/api/appointments', appointmentRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use(express.static(clientDirectory, { extensions: ['html'], maxAge: config.nodeEnv === 'production' ? '1h' : 0 }));
app.use('/api', notFound);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const reportsRouter = require('./routes/reports');
const aiRouter = require('./routes/ai');
const authRouter = require('./routes/auth');
const { getDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// ---- Security & performance middleware ----
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: (Number(process.env.RATE_LIMIT_WINDOW_MIN) || 15) * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ---- Uploads are served from S3 directly; no local static route needed ----

// ---- Routes ----
app.use('/api/reports', reportsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/auth', authRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'nagrik360-backend', time: new Date().toISOString() }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

(async () => {
  await getDB();
  app.listen(PORT, () => console.log(`🚀 Nagrik360 backend running on port ${PORT}`));
})();

module.exports = app;

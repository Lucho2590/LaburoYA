require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { initializeFirebase } = require('./config/firebase');
const authRoutes = require('./routes/auth');
const workerRoutes = require('./routes/workers');
const employerRoutes = require('./routes/employers');
const jobOfferRoutes = require('./routes/jobOffers');
const matchRoutes = require('./routes/matches');
const chatRoutes = require('./routes/chats');
const adminRoutes = require('./routes/admin');

// Initialize Firebase Admin
initializeFirebase();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/employers', employerRoutes);
app.use('/api/job-offers', jobOfferRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/admin', adminRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`LaburoYA Backend running on port ${PORT}`);
});

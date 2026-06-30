require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { initializeFirebase } = require('./config/firebase');
const authRoutes = require('./routes/auth');
const workerRoutes = require('./routes/workers');
const employerRoutes = require('./routes/employers');
const companyRoutes = require('./routes/companies');
const jobOfferRoutes = require('./routes/jobOffers');
const matchRoutes = require('./routes/matches');
const chatRoutes = require('./routes/chats');
const adminRoutes = require('./routes/admin');
const contactRequestRoutes = require('./routes/contactRequests');
const discoveryRoutes = require('./routes/discovery');
const notificationRoutes = require('./routes/notifications');
const leadsRoutes = require('./routes/leads');
const rubrosRoutes = require('./routes/rubros');
const settingsRoutes = require('./routes/settings');
const citiesRoutes = require('./routes/cities');
const geocodeRoutes = require('./routes/geocode');
const prospectsRoutes = require('./routes/prospects');
const { seedCities } = require('./scripts/seedCities');
const scheduler = require('./utils/scheduler');

// Initialize Firebase Admin
initializeFirebase();

// Seed idempotente de ciudades (crea Mar del Plata si no existe).
seedCities().catch((err) => console.warn('Seed de ciudades falló:', err.message));

// Job diario: migra/descarta el talent pool vencido (>6 meses).
scheduler.start();

const app = express();

// Render (y otros PaaS) corren detrás de un proxy: confiar en él para que
// req.ip y x-forwarded-for reflejen la IP real del cliente (geoloc por IP).
app.set('trust proxy', true);

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
app.use('/api/companies', companyRoutes);
app.use('/api/job-offers', jobOfferRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact-requests', contactRequestRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/rubros', rubrosRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/cities', citiesRoutes);
app.use('/api/geocode', geocodeRoutes);
app.use('/api/prospects', prospectsRoutes);

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

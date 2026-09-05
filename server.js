import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import db from './db.js';
import authRoutes, { JWT_SECRET } from './auth.js';
import { sendWhatsAppMessage } from './services/whatsapp.js';
import { initReminderScheduler } from './services/cron.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);

// Save booking & trigger automated instant WhatsApp confirmation
app.post('/api/bookings', async (req, res) => {
  const { 
    customer_name, 
    customer_phone, 
    origin, 
    destination, 
    fleet_name, 
    billing_type, 
    distance_km, 
    hotel_details, 
    total_cost, 
    trip_date 
  } = req.body;

  let userId = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.id;
    } catch (e) {}
  }

  // Ensure default fallback date if not supplied
  const effectiveDate = trip_date || new Date().toISOString().split('T')[0];

  try {
    const insertBooking = db.prepare(`
      INSERT INTO bookings (
        user_id, customer_name, customer_phone, origin, destination, 
        fleet_name, billing_type, distance_km, hotel_details, total_cost, trip_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertBooking.run(
      userId,
      customer_name || 'Guest Traveler',
      customer_phone || null,
      origin || 'Not specified',
      destination || 'Not specified',
      fleet_name || '14-Seater Luxury Traveller',
      billing_type || 'Standard',
      distance_km || 0,
      hotel_details || 'None',
      total_cost || 0,
      effectiveDate
    );

    // Send instant confirmation message via WhatsApp
    if (customer_phone) {
      await sendWhatsAppMessage(
        customer_phone,
        'booking_confirmation', // Meta template name
        [customer_name || 'Traveler', effectiveDate, origin, destination, fleet_name]
      );
    }

    res.json({ success: true, bookingId: result.lastInsertRowid });
  } catch (err) {
    console.error('Booking Insert Error:', err);
    res.status(500).json({ success: false, message: 'Database insert failed' });
  }
});

// Admin data view endpoint
app.get('/api/admin/data', (req, res) => {
  try {
    const users = db.prepare('SELECT id, name, email, phone, role, created_at FROM users ORDER BY id DESC').all();
    const bookings = db.prepare('SELECT * FROM bookings ORDER BY id DESC').all();
    res.json({ success: true, users, bookings });
  } catch (err) {
    console.error('Admin fetch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start scheduler & listen
initReminderScheduler();

app.listen(PORT, () => {
  console.log(`MoonLight Server live at http://localhost:${PORT}`);
  console.log(`Admin Monitor live at http://localhost:${PORT}/admin.html`);
});

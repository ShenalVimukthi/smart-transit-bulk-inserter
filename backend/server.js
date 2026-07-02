require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 4000;

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // support large base64 uploads
app.use('/uploads', express.static(uploadsDir));

// DB Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error', err);
});

// ──────────────────────────────────────────────
// GET /api/lounges — fetch all lounges for selector
// ──────────────────────────────────────────────
app.get('/api/lounges', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, lounge_name, address, status, is_operational
       FROM lounges
       ORDER BY lounge_name ASC`
    );
    res.json({ lounges: result.rows, total: result.rowCount });
  } catch (err) {
    console.error('[GET /api/lounges]', err.message);
    res.status(500).json({ error: 'database_error', message: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/bulk-insert
// Body: { lounge_id, entries: [ { location, latitude, longitude, est_duration, distance, three_wheeler_price, car_price, van_price } ] }
// ──────────────────────────────────────────────
app.post('/api/bulk-insert', async (req, res) => {
  const { lounge_id, entries } = req.body;

  if (!lounge_id) {
    return res.status(400).json({ error: 'validation_error', message: 'lounge_id is required' });
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'validation_error', message: 'entries array must be non-empty' });
  }

  const client = await pool.connect();
  const results = [];

  try {
    await client.query('BEGIN');

    // Verify lounge exists
    const loungeCheck = await client.query('SELECT id, lounge_name FROM lounges WHERE id = $1', [lounge_id]);
    if (loungeCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'not_found', message: 'Lounge not found' });
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // Validate required fields
      const requiredFields = ['location', 'latitude', 'longitude', 'est_duration', 'distance', 'three_wheeler_price', 'car_price', 'van_price'];
      const missing = requiredFields.filter(f => entry[f] === undefined || entry[f] === null || entry[f] === '');
      if (missing.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'validation_error',
          message: `Entry #${i + 1} is missing: ${missing.join(', ')}`,
          entry_index: i,
        });
      }

      // 1. Insert transport location
      const locationResult = await client.query(
        `INSERT INTO lounge_transport_locations
           (id, lounge_id, location, latitude, longitude, status, created_at, updated_at, est_duration, distance)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'active'::lounge_location_status, NOW(), NOW(), $5, $6)
         RETURNING id, lounge_id, location, latitude, longitude, status, est_duration, distance, created_at`,
        [
          lounge_id,
          entry.location.trim(),
          parseFloat(entry.latitude),
          parseFloat(entry.longitude),
          parseInt(entry.est_duration),
          parseFloat(entry.distance),
        ]
      );

      const createdLocation = locationResult.rows[0];
      const location_id = createdLocation.id;

      // 2. Insert prices using the returned location_id
      const priceResult = await client.query(
        `INSERT INTO lounge_transport_location_prices
           (lounge_id, location_id, three_wheeler_price, car_price, van_price, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (lounge_id, location_id) DO UPDATE SET
           three_wheeler_price = EXCLUDED.three_wheeler_price,
           car_price = EXCLUDED.car_price,
           van_price = EXCLUDED.van_price,
           updated_at = NOW()
         RETURNING lounge_id, location_id, three_wheeler_price, car_price, van_price, updated_at`,
        [
          lounge_id,
          location_id,
          parseFloat(entry.three_wheeler_price),
          parseFloat(entry.car_price),
          parseFloat(entry.van_price),
        ]
      );

      results.push({
        entry_index: i,
        location: createdLocation,
        prices: priceResult.rows[0],
        status: 'success',
      });
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: `Successfully inserted ${results.length} location(s) with prices`,
      lounge_id,
      total_inserted: results.length,
      results,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /api/bulk-insert]', err.message);
    res.status(500).json({ error: 'insert_failed', message: err.message });
  } finally {
    client.release();
  }
});

// ──────────────────────────────────────────────
// POST /api/bulk-insert-drivers
// Body: { lounge_id, entries: [ { name, nic_number, contact_no, vehicle_no, vehicle_type } ] }
// ──────────────────────────────────────────────
app.post('/api/bulk-insert-drivers', async (req, res) => {
  const { lounge_id, entries } = req.body;

  if (!lounge_id) {
    return res.status(400).json({ error: 'validation_error', message: 'lounge_id is required' });
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'validation_error', message: 'entries array must be non-empty' });
  }

  const VALID_VEHICLE_TYPES = ['three_wheeler', 'car', 'van'];

  const client = await pool.connect();
  const results = [];

  try {
    await client.query('BEGIN');

    // Verify lounge exists
    const loungeCheck = await client.query('SELECT id, lounge_name FROM lounges WHERE id = $1', [lounge_id]);
    if (loungeCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'not_found', message: 'Lounge not found' });
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // Validate required fields
      const requiredFields = ['name', 'nic_number', 'contact_no', 'vehicle_no', 'vehicle_type'];
      const missing = requiredFields.filter(f => !entry[f] || String(entry[f]).trim() === '');
      if (missing.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'validation_error',
          message: `Driver entry #${i + 1} is missing: ${missing.join(', ')}`,
          entry_index: i,
        });
      }

      // Validate vehicle type
      if (!VALID_VEHICLE_TYPES.includes(entry.vehicle_type)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'validation_error',
          message: `Driver entry #${i + 1}: vehicle_type must be one of: ${VALID_VEHICLE_TYPES.join(', ')}`,
          entry_index: i,
        });
      }

      // Insert driver
      const driverResult = await client.query(
        `INSERT INTO lounge_drivers
           (id, lounge_id, name, nic_number, contact_no, vehicle_no, vehicle_type, status, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'active', NOW(), NOW())
         RETURNING id, lounge_id, name, nic_number, contact_no, vehicle_no, vehicle_type, status, created_at`,
        [
          lounge_id,
          entry.name.trim(),
          entry.nic_number.trim(),
          entry.contact_no.trim(),
          entry.vehicle_no.trim(),
          entry.vehicle_type,
        ]
      );

      results.push({
        entry_index: i,
        driver: driverResult.rows[0],
        status: 'success',
      });
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: `Successfully inserted ${results.length} driver(s)`,
      lounge_id,
      total_inserted: results.length,
      results,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /api/bulk-insert-drivers]', err.message);
    res.status(500).json({ error: 'insert_failed', message: err.message });
  } finally {
    client.release();
  }
});

// ──────────────────────────────────────────────
// POST /api/bulk-insert-staff
// Body: { lounge_id, entries: [ { full_name, nic_number, phone, email? } ] }
// Inserts into lounge_staff (requires a matching user in users table by phone)
// ──────────────────────────────────────────────
app.post('/api/bulk-insert-staff', async (req, res) => {
  const { lounge_id, entries } = req.body;

  if (!lounge_id) {
    return res.status(400).json({ error: 'validation_error', message: 'lounge_id is required' });
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'validation_error', message: 'entries array must be non-empty' });
  }

  const client = await pool.connect();
  const results = [];

  try {
    await client.query('BEGIN');

    // Verify lounge exists
    const loungeCheck = await client.query('SELECT id, lounge_name FROM lounges WHERE id = $1', [lounge_id]);
    if (loungeCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'not_found', message: 'Lounge not found' });
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // Validate required fields
      const requiredFields = ['full_name', 'nic_number', 'phone'];
      const missing = requiredFields.filter(f => !entry[f] || String(entry[f]).trim() === '');
      if (missing.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'validation_error',
          message: `Staff entry #${i + 1} is missing: ${missing.join(', ')}`,
          entry_index: i,
        });
      }

      const fullName   = entry.full_name.trim();
      const nicNumber  = entry.nic_number.trim();
      const phone      = entry.phone.trim();
      const email      = entry.email ? entry.email.trim() : null;

      // Normalise phone: ensure it starts with +94 if Sri Lankan
      let normalizedPhone = phone;
      if (phone.startsWith('0') && phone.length === 10) {
        normalizedPhone = '+94' + phone.slice(1);
      }

      // 1. Look up (or create) user by phone
      let userRow = null;
      const existingUser = await client.query(
        'SELECT id FROM users WHERE phone = $1 LIMIT 1',
        [normalizedPhone]
      );

      if (existingUser.rowCount > 0) {
        userRow = existingUser.rows[0];
      } else {
        // Split full_name into first_name + last_name for the users table
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || fullName;
        const lastName  = nameParts.slice(1).join(' ') || null;

        // Create a minimal user record — users table uses first_name, last_name, nic (not full_name/nic_number)
        const newUser = await client.query(
          `INSERT INTO users (id, phone, roles, first_name, last_name, nic, status, phone_verified, profile_completed, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, ARRAY['lounge_staff'], $2, $3, $4, 'active', false, false, NOW(), NOW())
           RETURNING id`,
          [normalizedPhone, firstName, lastName, nicNumber]
        );
        userRow = newUser.rows[0];
      }

      const userId = userRow.id;

      // 2. Check if staff record already exists for this lounge + user
      const existingStaff = await client.query(
        'SELECT id FROM lounge_staff WHERE lounge_id = $1 AND user_id = $2 LIMIT 1',
        [lounge_id, userId]
      );
      if (existingStaff.rowCount > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'conflict',
          message: `Staff entry #${i + 1}: A staff record already exists for phone "${phone}" in this lounge`,
          entry_index: i,
        });
      }

      // 3. Insert the lounge_staff record
      const staffResult = await client.query(
        `INSERT INTO lounge_staff
           (id, lounge_id, user_id, full_name, nic_number, email,
            profile_completed, approval_status, employment_status,
            hired_date, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5,
                 true, 'approved', 'active',
                 NOW(), NOW(), NOW())
         RETURNING id, lounge_id, user_id, full_name, nic_number, email,
                   profile_completed, approval_status, employment_status,
                   hired_date, created_at`,
        [lounge_id, userId, fullName, nicNumber, email]
      );

      results.push({
        entry_index: i,
        staff: staffResult.rows[0],
        phone: normalizedPhone,
        status: 'success',
      });
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: `Successfully inserted ${results.length} staff member(s)`,
      lounge_id,
      total_inserted: results.length,
      results,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /api/bulk-insert-staff]', err.message);
    res.status(500).json({ error: 'insert_failed', message: err.message });
  } finally {
    client.release();
  }
});

// ──────────────────────────────────────────────
// GET /api/health — health check
// ──────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/marketplace-categories — list categories
// ──────────────────────────────────────────────
app.get('/api/marketplace-categories', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name FROM lounge_marketplace_categories WHERE is_active = true ORDER BY display_order, name'
    );
    res.json({ categories: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'fetch_failed', message: err.message });
  }
});

// ──────────────────────────────────────────────
// Cloudinary Helpers
// ──────────────────────────────────────────────
function signParams(params, apiSecret) {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map(k => `${k}=${params[k]}`).join('&') + apiSecret;
  return crypto.createHash('sha1').update(paramString).digest('hex');
}

async function uploadToCloudinary(base64Image, loungeId, originalName) {
  const cloudinaryUrl = process.env.CLOUDINARY_URL || '';
  if (!cloudinaryUrl.startsWith('cloudinary://')) {
    throw new Error('CLOUDINARY_URL is missing or invalid');
  }

  const parts = cloudinaryUrl.slice(13).split('@');
  if (parts.length !== 2) throw new Error('Invalid CLOUDINARY_URL format');
  const cloudName = parts[1];
  const credentials = parts[0].split(':');
  if (credentials.length !== 2) throw new Error('Invalid CLOUDINARY_URL credentials');
  const apiKey = credentials[0];
  const apiSecret = credentials[1];

  const timestamp = Math.floor(Date.now() / 1000).toString();
  // Folder structure: smarttransit/development/lounge-products/<lounge_id>/product
  const folder = `smarttransit/development/lounge-products/${loungeId}/product`;
  
  // Public ID format: timestamp + random UUID/uuid-like string
  const randomUuid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
  const publicId = `${Date.now()}-${randomUuid}`;

  const params = {
    folder: folder,
    overwrite: 'false',
    public_id: publicId,
    timestamp: timestamp,
    unique_filename: 'false',
  };

  const signature = signParams(params, apiSecret);

  const payload = new URLSearchParams();
  payload.append('file', base64Image);
  payload.append('api_key', apiKey);
  payload.append('timestamp', timestamp);
  payload.append('signature', signature);
  payload.append('folder', folder);
  payload.append('public_id', publicId);
  payload.append('overwrite', 'false');
  payload.append('unique_filename', 'false');

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const response = await axios.post(endpoint, payload.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  return response.data.secure_url;
}

// ──────────────────────────────────────────────
// POST /api/bulk-insert-products
// Body: { lounge_id, entries: [ { category_id, name, description?, product_type,
//         price, price_rate_type?, discounted_price?, stock_status?, stock_quantity?,
//         is_available?, is_pre_orderable?, is_vegetarian?, is_vegan?, is_halal?,
//         calories?, service_duration_minutes?, display_order?, is_featured?,
//         is_active?, tags?, allergens? } ] }
// ──────────────────────────────────────────────
app.post('/api/bulk-insert-products', async (req, res) => {
  const { lounge_id, entries } = req.body;

  if (!lounge_id) {
    return res.status(400).json({ error: 'validation_error', message: 'lounge_id is required' });
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'validation_error', message: 'entries array must be non-empty' });
  }

  const VALID_PRODUCT_TYPES = ['product', 'service', 'package', 'combo', 'other'];
  const VALID_STOCK_STATUSES = ['in_stock', 'low_stock', 'out_of_stock', 'discontinued', 'made_to_order'];
  const VALID_PRICE_RATE_TYPES = ['fixed_rate', 'hourly_rate', 'daily_rate'];

  const client = await pool.connect();
  const results = [];

  try {
    await client.query('BEGIN');

    // Verify lounge exists
    const loungeCheck = await client.query('SELECT id, lounge_name FROM lounges WHERE id = $1', [lounge_id]);
    if (loungeCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'not_found', message: 'Lounge not found' });
    }

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];

      // Required fields
      if (!e.category_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'validation_error', message: `Product #${i + 1}: category_id is required`, entry_index: i });
      }
      if (!e.name || String(e.name).trim() === '') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'validation_error', message: `Product #${i + 1}: name is required`, entry_index: i });
      }
      if (e.price === undefined || e.price === null || String(e.price).trim() === '') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'validation_error', message: `Product #${i + 1}: price is required`, entry_index: i });
      }

      const productType  = VALID_PRODUCT_TYPES.includes(e.product_type) ? e.product_type : 'product';
      const stockStatus  = VALID_STOCK_STATUSES.includes(e.stock_status) ? e.stock_status : 'in_stock';
      const priceRateType = VALID_PRICE_RATE_TYPES.includes(e.price_rate_type) ? e.price_rate_type : 'fixed_rate';

      // Upload image to Cloudinary if base64 provided (matching the app and Go backend flow)
      let imageUrl = null;
      if (e.image_base64) {
        imageUrl = await uploadToCloudinary(e.image_base64, lounge_id, e.image_name);
      }

      const productResult = await client.query(
        `INSERT INTO lounge_products (
           id, lounge_id, category_id, name, description, product_type,
           price, price_rate_type, discounted_price,
           stock_status, stock_quantity,
           is_available, is_pre_orderable,
           available_from, available_until, available_days,
           is_vegetarian, is_vegan, is_halal,
           allergens, calories,
           service_duration_minutes,
           display_order, is_featured, is_active,
           tags, image_url, thumbnail_url, created_at, updated_at
         ) VALUES (
           uuid_generate_v4(), $1, $2, $3, $4, $5::lounge_product_type,
           $6, $7::rate_type, $8,
           $9::lounge_product_stock_status, $10,
           $11, $12,
           $13, $14, $15,
           $16, $17, $18,
           $19, $20,
           $21,
           $22, $23, $24,
           $25, $26, $27, NOW(), NOW()
         )
         RETURNING id, lounge_id, category_id, name, product_type, price, price_rate_type,
                   discounted_price, stock_status, stock_quantity, is_available, is_featured, is_active, image_url`,
        [
          lounge_id,
          e.category_id,
          String(e.name).trim(),
          e.description ? String(e.description).trim() : null,
          productType,
          parseFloat(e.price),
          priceRateType,
          e.discounted_price != null ? parseFloat(e.discounted_price) : null,
          stockStatus,
          e.stock_quantity != null ? parseInt(e.stock_quantity) : null,
          e.is_available !== false,
          e.is_pre_orderable === true,
          e.available_from || null,
          e.available_until || null,
          e.available_days || ['mon','tue','wed','thu','fri','sat','sun'],
          e.is_vegetarian === true,
          e.is_vegan === true,
          e.is_halal === true,
          e.allergens || null,
          e.calories != null ? parseInt(e.calories) : null,
          e.service_duration_minutes != null ? parseInt(e.service_duration_minutes) : null,
          e.display_order != null ? parseInt(e.display_order) : 0,
          e.is_featured === true,
          e.is_active !== false,
          e.tags || null,
          imageUrl,
          imageUrl, // thumbnail_url
        ]
      );

      results.push({
        entry_index: i,
        product: productResult.rows[0],
        status: 'success',
      });
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: `Successfully inserted ${results.length} product(s)`,
      lounge_id,
      total_inserted: results.length,
      results,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /api/bulk-insert-products]', err.message);
    res.status(500).json({ error: 'insert_failed', message: err.message });
  } finally {
    client.release();
  }
});

// ──────────────────────────────────────────────
// POST /api/bulk-insert-packages
// Body: { lounge_id, entries: [ { package_name, description, package_type, price, pax?,
//         transport_status?, transport_mode?, meal_status?, breakfast_status?, breakfast_type?,
//         lunch_status?, lunch_type?, evening_snack_status?, evening_snack_type?,
//         dinner_status?, dinner_type?, places?, image_base64?, image_name? } ] }
// ──────────────────────────────────────────────
app.post('/api/bulk-insert-packages', async (req, res) => {
  const { lounge_id, entries } = req.body;

  if (!lounge_id) {
    return res.status(400).json({ error: 'validation_error', message: 'lounge_id is required' });
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'validation_error', message: 'entries array must be non-empty' });
  }

  const VALID_PACKAGE_TYPES = ['platinum', 'gold', 'standard'];
  const VALID_TRANSPORT_MODES = ['three-wheeler', 'van', 'car'];

  const client = await pool.connect();
  const results = [];

  try {
    await client.query('BEGIN');

    // Verify lounge exists
    const loungeCheck = await client.query('SELECT id, lounge_name FROM lounges WHERE id = $1', [lounge_id]);
    if (loungeCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'not_found', message: 'Lounge not found' });
    }

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];

      // Required fields
      if (!e.package_name || String(e.package_name).trim() === '') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'validation_error', message: `Package #${i + 1}: package_name is required`, entry_index: i });
      }
      if (!e.description || String(e.description).trim() === '') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'validation_error', message: `Package #${i + 1}: description is required`, entry_index: i });
      }
      if (e.price === undefined || e.price === null || String(e.price).trim() === '') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'validation_error', message: `Package #${i + 1}: price is required`, entry_index: i });
      }

      const packageType = VALID_PACKAGE_TYPES.includes(e.package_type) ? e.package_type : 'standard';
      const transportMode = (e.transport_status && VALID_TRANSPORT_MODES.includes(e.transport_mode)) ? e.transport_mode : null;

      // Upload image to Cloudinary if base64 provided
      let imageUrl = null;
      if (e.image_base64) {
        imageUrl = await uploadToCloudinary(e.image_base64, lounge_id, e.image_name, 'lounge-special-packages', 'package');
      }

      const jsonOrNull = (arr) => {
        if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
        return JSON.stringify(arr);
      };

      const packageResult = await client.query(
        `INSERT INTO lounge_special_packages (
           id, lounge_id, package_name, image_url, package_type,
           description, price, is_active, created_at, updated_at,
           pax, transport_status, transport_mode,
           "meal-status", "breakfast-status", "breakfast-type",
           "lunch-status", "lunch-type",
           "evening-snack-status", "evening-snack-type",
           "dinner-status", "dinner-type",
           places
         ) VALUES (
           uuid_generate_v4(), $1, $2, $3, $4,
           $5, $6, TRUE, NOW(), NOW(),
           $7, $8, $9::transport_types,
           $10, $11, $12::jsonb,
           $13, $14::jsonb,
           $15, $16::jsonb,
           $17, $18::jsonb,
           $19::jsonb
         )
         RETURNING id, lounge_id, package_name, image_url, package_type, description, price, is_active,
                   pax, transport_status, transport_mode`,
        [
          lounge_id,
          String(e.package_name).trim(),
          imageUrl,
          packageType,
          String(e.description).trim(),
          parseFloat(e.price),
          e.pax != null && String(e.pax).trim() !== '' ? parseInt(e.pax) : null,
          e.transport_status === true,
          transportMode,
          e.meal_status === true,
          e.breakfast_status === true,
          jsonOrNull(e.breakfast_type),
          e.lunch_status === true,
          jsonOrNull(e.lunch_type),
          e.evening_snack_status === true,
          jsonOrNull(e.evening_snack_type),
          e.dinner_status === true,
          jsonOrNull(e.dinner_type),
          jsonOrNull(e.places)
        ]
      );

      results.push({
        entry_index: i,
        package: packageResult.rows[0],
        status: 'success',
      });
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: `Successfully inserted ${results.length} package(s)`,
      lounge_id,
      total_inserted: results.length,
      results,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /api/bulk-insert-packages]', err.message);
    res.status(500).json({ error: 'insert_failed', message: err.message });
  } finally {
    client.release();
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Bulk-inserter backend running on http://localhost:${PORT}`);
  console.log(`📋 POST /api/bulk-insert              — bulk insert locations + prices`);
  console.log(`🚗 POST /api/bulk-insert-drivers       — bulk insert lounge drivers`);
  console.log(`👤 POST /api/bulk-insert-staff         — bulk insert lounge staff`);
  console.log(`🛍️  POST /api/bulk-insert-products      — bulk insert marketplace products`);
  console.log(`📦 POST /api/bulk-insert-packages      — bulk insert lounge special packages`);
  console.log(`📂 GET  /api/marketplace-categories    — list product categories`);
  console.log(`🏨 GET  /api/lounges                   — list all lounges`);
  console.log(`💚 GET  /api/health                    — health check`);
});

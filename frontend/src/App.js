import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

// ────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────
const API_BASE = 'http://localhost:4000/api';

// ── Location mode empty entry ──
const EMPTY_LOCATION_ENTRY = () => ({
  id: Date.now() + Math.random(),
  location: '',
  latitude: '',
  longitude: '',
  est_duration: '',
  distance: '',
  three_wheeler_price: '',
  car_price: '',
  van_price: '',
  errors: {},
});

// ── Driver mode empty entry ──
const EMPTY_DRIVER_ENTRY = () => ({
  id: Date.now() + Math.random(),
  name: '',
  nic_number: '',
  contact_no: '',
  vehicle_no: '',
  vehicle_type: '',
  errors: {},
});

// ── Staff mode empty entry ──
const EMPTY_STAFF_ENTRY = () => ({
  id: Date.now() + Math.random(),
  full_name: '',
  nic_number: '',
  phone: '',
  email: '',
  errors: {},
});

// ── Product mode empty entry ──
const EMPTY_PRODUCT_ENTRY = () => ({
  id: Date.now() + Math.random(),
  category_id: '',
  name: '',
  description: '',
  product_type: 'product',
  price: '',
  price_rate_type: 'fixed_rate',
  discounted_price: '',
  stock_status: 'in_stock',
  stock_quantity: '',
  is_available: true,
  is_pre_orderable: false,
  is_featured: false,
  is_vegetarian: false,
  is_vegan: false,
  is_halal: false,
  errors: {},
});
// ── Package mode empty entry ──
const EMPTY_PACKAGE_ENTRY = () => ({
  id: Date.now() + Math.random(),
  package_name: '',
  description: '',
  package_type: 'standard',
  price: '',
  pax: '',
  transport_status: false,
  transport_mode: '',
  meal_status: false,
  breakfast_status: false,
  breakfast_type: '',
  lunch_status: false,
  lunch_type: '',
  evening_snack_status: false,
  evening_snack_type: '',
  dinner_status: false,
  dinner_type: '',
  places: '',
  image_base64: '',
  image_name: '',
  errors: {},
});

const PRODUCT_TYPE_OPTIONS = [
  { value: 'product', label: '📦 Product' },
  { value: 'service', label: '🛠️ Service' },
  { value: 'package', label: '🎁 Package' },
  { value: 'combo',   label: '🍔 Combo' },
  { value: 'other',   label: '❓ Other' },
];

const STOCK_STATUS_OPTIONS = [
  { value: 'in_stock',     label: '✅ In Stock' },
  { value: 'low_stock',    label: '⚠️ Low Stock' },
  { value: 'out_of_stock', label: '❌ Out of Stock' },
  { value: 'discontinued', label: '🚫 Discontinued' },
  { value: 'made_to_order',label: '🍳 Made to Order' },
];

const PRICE_RATE_TYPE_OPTIONS = [
  { value: 'fixed_rate',  label: 'Fixed Price' },
  { value: 'hourly_rate', label: 'Hourly Rate' },
  { value: 'daily_rate',  label: 'Daily Rate' },
];

const VEHICLE_TYPE_OPTIONS = [
  { value: 'three_wheeler', label: '🛺 Three-Wheeler' },
  { value: 'car',           label: '🚗 Car' },
  { value: 'van',           label: '🚐 Van' },
];

// ────────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────────
function validateLocationEntry(entry) {
  const errors = {};

  if (!entry.location.trim()) errors.location = 'Required';
  else if (entry.location.trim().length < 2) errors.location = 'Min 2 characters';

  const lat = parseFloat(entry.latitude);
  if (entry.latitude === '') errors.latitude = 'Required';
  else if (isNaN(lat) || lat < -90 || lat > 90) errors.latitude = '-90 to 90';

  const lon = parseFloat(entry.longitude);
  if (entry.longitude === '') errors.longitude = 'Required';
  else if (isNaN(lon) || lon < -180 || lon > 180) errors.longitude = '-180 to 180';

  const dur = parseInt(entry.est_duration);
  if (entry.est_duration === '') errors.est_duration = 'Required';
  else if (isNaN(dur) || dur <= 0) errors.est_duration = 'Must be > 0';

  const dist = parseFloat(entry.distance);
  if (entry.distance === '') errors.distance = 'Required';
  else if (isNaN(dist) || dist <= 0) errors.distance = 'Must be > 0';

  const tw = parseFloat(entry.three_wheeler_price);
  if (entry.three_wheeler_price === '') errors.three_wheeler_price = 'Required';
  else if (isNaN(tw) || tw < 0) errors.three_wheeler_price = 'Must be ≥ 0';

  const car = parseFloat(entry.car_price);
  if (entry.car_price === '') errors.car_price = 'Required';
  else if (isNaN(car) || car < 0) errors.car_price = 'Must be ≥ 0';

  const van = parseFloat(entry.van_price);
  if (entry.van_price === '') errors.van_price = 'Required';
  else if (isNaN(van) || van < 0) errors.van_price = 'Must be ≥ 0';

  return errors;
}

function validateDriverEntry(entry) {
  const errors = {};

  if (!entry.name.trim()) errors.name = 'Required';
  else if (entry.name.trim().length < 2) errors.name = 'Min 2 characters';

  if (!entry.nic_number.trim()) errors.nic_number = 'Required';
  else if (!/^[0-9]{9}[vVxX]$|^[0-9]{12}$/.test(entry.nic_number.trim()))
    errors.nic_number = 'Invalid NIC format';

  if (!entry.contact_no.trim()) errors.contact_no = 'Required';
  else if (!/^[0-9+\-\s]{7,15}$/.test(entry.contact_no.trim()))
    errors.contact_no = 'Invalid phone number';

  if (!entry.vehicle_no.trim()) errors.vehicle_no = 'Required';

  if (!entry.vehicle_type) errors.vehicle_type = 'Required';

  return errors;
}

function validateStaffEntry(entry) {
  const errors = {};

  if (!entry.full_name.trim()) errors.full_name = 'Required';
  else if (entry.full_name.trim().length < 2) errors.full_name = 'Min 2 characters';

  if (!entry.nic_number.trim()) errors.nic_number = 'Required';
  else if (!/^[0-9]{9}[vVxX]$|^[0-9]{12}$/.test(entry.nic_number.trim()))
    errors.nic_number = 'Invalid NIC (9 digits+V/X or 12 digits)';

  if (!entry.phone.trim()) errors.phone = 'Required';
  else if (!/^[0-9+\-\s]{7,15}$/.test(entry.phone.trim()))
    errors.phone = 'Invalid phone number';

  // email is optional but validate format if provided
  if (entry.email && entry.email.trim() !== '') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email.trim()))
      errors.email = 'Invalid email format';
  }

  return errors;
}

function validateProductEntry(entry) {
  const errors = {};

  if (!entry.name || !entry.name.trim()) {
    errors.name = 'Required';
  } else if (entry.name.trim().length < 2) {
    errors.name = 'Min 2 characters';
  }

  if (!entry.category_id) {
    errors.category_id = 'Required';
  }

  if (!entry.product_type) {
    errors.product_type = 'Required';
  }

  const priceVal = parseFloat(entry.price);
  if (entry.price === '' || entry.price === undefined || entry.price === null) {
    errors.price = 'Required';
  } else if (isNaN(priceVal) || priceVal <= 0) {
    errors.price = 'Must be a positive number';
  }

  if (entry.discounted_price && String(entry.discounted_price).trim() !== '') {
    const discVal = parseFloat(entry.discounted_price);
    if (isNaN(discVal) || discVal <= 0) {
      errors.discounted_price = 'Must be a positive number';
    } else if (!isNaN(priceVal) && discVal >= priceVal) {
      errors.discounted_price = 'Must be less than price';
    }
  }

  if (entry.stock_quantity && String(entry.stock_quantity).trim() !== '') {
    const stockVal = parseInt(entry.stock_quantity, 10);
    if (isNaN(stockVal) || stockVal < 0) {
      errors.stock_quantity = 'Must be 0 or greater';
    }
  }

  return errors;
}

function validatePackageEntry(entry) {
  const errors = {};

  if (!entry.package_name || !entry.package_name.trim()) {
    errors.package_name = 'Required';
  } else if (entry.package_name.trim().length < 2) {
    errors.package_name = 'Min 2 characters';
  }

  if (!entry.description || !entry.description.trim()) {
    errors.description = 'Required';
  }

  if (!entry.package_type) {
    errors.package_type = 'Required';
  }

  const priceVal = parseFloat(entry.price);
  if (entry.price === '' || entry.price === undefined || entry.price === null) {
    errors.price = 'Required';
  } else if (isNaN(priceVal) || priceVal <= 0) {
    errors.price = 'Must be a positive number';
  }

  if (entry.pax && String(entry.pax).trim() !== '') {
    const paxVal = parseInt(entry.pax, 10);
    if (isNaN(paxVal) || paxVal <= 0) {
      errors.pax = 'Must be a positive integer';
    }
  }

  if (entry.transport_status && !entry.transport_mode) {
    errors.transport_mode = 'Required when transport is on';
  }

  return errors;
}

// ────────────────────────────────────────────────
// Toast
// ────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────
// Mode Toggle Button
// ────────────────────────────────────────────────
function ModeToggle({ mode, onToggle }) {
  return (
    <div className="mode-toggle-wrapper">
      <div className="mode-toggle-label">Insert Mode</div>
      <div className="mode-toggle">
        <button
          className={`mode-btn ${mode === 'locations' ? 'active' : ''}`}
          onClick={() => onToggle('locations')}
          id="mode-locations"
        >
          <span className="mode-btn-icon">📍</span>
          <span>Transport Locations</span>
        </button>
        <button
          className={`mode-btn ${mode === 'drivers' ? 'active' : ''}`}
          onClick={() => onToggle('drivers')}
          id="mode-drivers"
        >
          <span className="mode-btn-icon">🚗</span>
          <span>Lounge Drivers</span>
        </button>
        <button
          className={`mode-btn ${mode === 'staff' ? 'active' : ''}`}
          onClick={() => onToggle('staff')}
          id="mode-staff"
        >
          <span className="mode-btn-icon">👤</span>
          <span>Lounge Staff</span>
        </button>
        <button
          className={`mode-btn ${mode === 'products' ? 'active' : ''}`}
          onClick={() => onToggle('products')}
          id="mode-products"
        >
          <span className="mode-btn-icon">🛍️</span>
          <span>Lounge Products</span>
        </button>
        <button
          className={`mode-btn ${mode === 'packages' ? 'active' : ''}`}
          onClick={() => onToggle('packages')}
          id="mode-packages"
        >
          <span className="mode-btn-icon">📦</span>
          <span>Special Packages</span>
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// Steps Bar
// ────────────────────────────────────────────────
function StepsBar({ step }) {
  const steps = [
    { label: 'Select Lounge', num: 1 },
    { label: 'Add Entries', num: 2 },
    { label: 'Review & Insert', num: 3 },
  ];

  return (
    <div className="steps-bar">
      {steps.map((s, i) => {
        const state = step > s.num ? 'done' : step === s.num ? 'active' : 'idle';
        return (
          <React.Fragment key={s.num}>
            <div className="step-item">
              <div className={`step-circle ${state}`}>
                {state === 'done' ? '✓' : s.num}
              </div>
              <span className={`step-label ${state}`}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`step-connector ${step > s.num ? 'done' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────
// Location Entry Card
// ────────────────────────────────────────────────
function LocationEntryCard({ entry, index, onChange, onRemove, showErrors }) {
  const hasErrors = showErrors && Object.keys(entry.errors).length > 0;

  const field = (name, label, type = 'text', placeholder = '', extra = {}) => (
    <div className={`field-group ${extra.span ? 'span-2' : ''}`}>
      <label className="field-label">
        {label} <span className="required">*</span>
      </label>
      {extra.prefix ? (
        <div className="price-input-wrapper">
          <span className="price-prefix">{extra.prefix}</span>
          <input
            className={`field-input with-prefix ${showErrors && entry.errors[name] ? 'error' : ''}`}
            type={type}
            placeholder={placeholder}
            value={entry[name]}
            onChange={e => onChange(entry.id, name, e.target.value)}
          />
        </div>
      ) : (
        <input
          className={`field-input ${showErrors && entry.errors[name] ? 'error' : ''}`}
          type={type}
          placeholder={placeholder}
          value={entry[name]}
          onChange={e => onChange(entry.id, name, e.target.value)}
        />
      )}
      {showErrors && entry.errors[name] && (
        <span style={{ fontSize: '10px', color: 'var(--danger)', marginTop: '2px' }}>
          {entry.errors[name]}
        </span>
      )}
    </div>
  );

  return (
    <div className={`entry-card ${hasErrors ? 'has-error' : ''}`}>
      <div className="entry-card-header">
        <div className="entry-number">
          <div className="entry-badge">{index + 1}</div>
          <span className="entry-label">Transport Location Entry</span>
        </div>
        <button className="btn-remove" onClick={() => onRemove(entry.id)} title="Remove entry">
          ✕
        </button>
      </div>

      <div className="fields-grid">
        {field('location', 'Location Name', 'text', 'e.g. Colombo Fort Station', { span: true })}
        {field('latitude', 'Latitude', 'number', 'e.g. 6.9271')}
        {field('longitude', 'Longitude', 'number', 'e.g. 79.8612')}
        {field('est_duration', 'Est. Duration (min)', 'number', 'e.g. 45')}
        {field('distance', 'Distance (km)', 'number', 'e.g. 12.5')}
      </div>

      <div className="entry-divider">
        <div className="entry-divider-line" />
        <span className="entry-divider-label">💰 Transport Prices (LKR)</span>
        <div className="entry-divider-line" />
      </div>

      <div className="fields-grid">
        {field('three_wheeler_price', '3-Wheeler Price', 'number', '0.00', { prefix: 'LKR' })}
        {field('car_price', 'Car Price', 'number', '0.00', { prefix: 'LKR' })}
        {field('van_price', 'Van Price', 'number', '0.00', { prefix: 'LKR' })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// Driver Entry Card
// ────────────────────────────────────────────────
function DriverEntryCard({ entry, index, onChange, onRemove, showErrors }) {
  const hasErrors = showErrors && Object.keys(entry.errors).length > 0;

  const textField = (name, label, placeholder = '', extra = {}) => (
    <div className={`field-group ${extra.span ? 'span-2' : ''}`}>
      <label className="field-label">
        {label} <span className="required">*</span>
      </label>
      <input
        className={`field-input ${showErrors && entry.errors[name] ? 'error' : ''}`}
        type="text"
        placeholder={placeholder}
        value={entry[name]}
        onChange={e => onChange(entry.id, name, e.target.value)}
      />
      {showErrors && entry.errors[name] && (
        <span style={{ fontSize: '10px', color: 'var(--danger)', marginTop: '2px' }}>
          {entry.errors[name]}
        </span>
      )}
    </div>
  );

  return (
    <div className={`entry-card driver-card ${hasErrors ? 'has-error' : ''}`}>
      <div className="entry-card-header">
        <div className="entry-number">
          <div className="entry-badge driver-badge">{index + 1}</div>
          <span className="entry-label">Driver Entry</span>
        </div>
        <button className="btn-remove" onClick={() => onRemove(entry.id)} title="Remove entry">
          ✕
        </button>
      </div>

      <div className="fields-grid">
        {textField('name', 'Full Name', 'e.g. Kamal Perera', { span: true })}
        {textField('nic_number', 'NIC Number', 'e.g. 901234567V or 199012345678')}
        {textField('contact_no', 'Contact Number', 'e.g. 0771234567')}
        {textField('vehicle_no', 'Vehicle Number', 'e.g. CAB-1234')}
      </div>

      {/* Vehicle Type Selector */}
      <div className="entry-divider">
        <div className="entry-divider-line" />
        <span className="entry-divider-label">🚗 Vehicle Type</span>
        <div className="entry-divider-line" />
      </div>

      <div className="vehicle-type-group">
        {VEHICLE_TYPE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`vehicle-type-btn ${entry.vehicle_type === opt.value ? 'selected' : ''} ${showErrors && entry.errors.vehicle_type && !entry.vehicle_type ? 'error-border' : ''}`}
            onClick={() => onChange(entry.id, 'vehicle_type', opt.value)}
            type="button"
          >
            <span className="vt-icon">{opt.label.split(' ')[0]}</span>
            <span className="vt-label">{opt.label.split(' ').slice(1).join(' ')}</span>
          </button>
        ))}
      </div>
      {showErrors && entry.errors.vehicle_type && (
        <span style={{ fontSize: '10px', color: 'var(--danger)', marginTop: '4px', display: 'block' }}>
          {entry.errors.vehicle_type}
        </span>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// Staff Entry Card
// ────────────────────────────────────────────────
function StaffEntryCard({ entry, index, onChange, onRemove, showErrors }) {
  const hasErrors = showErrors && Object.keys(entry.errors).length > 0;

  const textField = (name, label, placeholder = '', opts = {}) => (
    <div className={`field-group ${opts.span ? 'span-2' : ''}`}>
      <label className="field-label">
        {label}{!opts.optional && <span className="required"> *</span>}
        {opts.optional && <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>(optional)</span>}
      </label>
      <input
        className={`field-input ${showErrors && entry.errors[name] ? 'error' : ''}`}
        type={opts.type || 'text'}
        placeholder={placeholder}
        value={entry[name]}
        onChange={e => onChange(entry.id, name, e.target.value)}
      />
      {showErrors && entry.errors[name] && (
        <span style={{ fontSize: '10px', color: 'var(--danger)', marginTop: '2px' }}>
          {entry.errors[name]}
        </span>
      )}
    </div>
  );

  return (
    <div className={`entry-card staff-card ${hasErrors ? 'has-error' : ''}`}>
      <div className="entry-card-header">
        <div className="entry-number">
          <div className="entry-badge staff-badge">{index + 1}</div>
          <span className="entry-label">Staff Entry</span>
        </div>
        <button className="btn-remove" onClick={() => onRemove(entry.id)} title="Remove entry">
          ✕
        </button>
      </div>

      <div className="fields-grid">
        {textField('full_name', 'Full Name', 'e.g. Nimal Perera', { span: true })}
        {textField('nic_number', 'NIC Number', 'e.g. 901234567V or 199012345678')}
        {textField('phone', 'Phone Number', 'e.g. 0771234567 or +94771234567')}
        {textField('email', 'Email Address', 'e.g. nimal@example.com', { optional: true })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// Product Entry Card
// ────────────────────────────────────────────────
function ProductEntryCard({ entry, index, onChange, onRemove, showErrors, categories }) {
  const hasErrors = showErrors && Object.keys(entry.errors).length > 0;

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      onChange(entry.id, 'image_base64', reader.result);
      onChange(entry.id, 'image_name', file.name);
    };
    reader.readAsDataURL(file);
  };

  const textField = (name, label, placeholder = '', opts = {}) => (
    <div className={`field-group ${opts.span ? 'span-2' : ''}`}>
      <label className="field-label">
        {label}{!opts.optional && <span className="required"> *</span>}
      </label>
      <input
        className={`field-input ${showErrors && entry.errors[name] ? 'error' : ''}`}
        type={opts.type || 'text'}
        placeholder={placeholder}
        value={entry[name]}
        onChange={e => onChange(entry.id, name, e.target.value)}
      />
      {showErrors && entry.errors[name] && (
        <span style={{ fontSize: '10px', color: 'var(--danger)', marginTop: '2px' }}>
          {entry.errors[name]}
        </span>
      )}
    </div>
  );

  const selectField = (name, label, options, opts = {}) => (
    <div className={`field-group ${opts.span ? 'span-2' : ''}`}>
      <label className="field-label">
        {label}{!opts.optional && <span className="required"> *</span>}
      </label>
      <div className="select-container" style={{ position: 'relative' }}>
        <select
          className={`field-input ${showErrors && entry.errors[name] ? 'error' : ''}`}
          value={entry[name]}
          onChange={e => onChange(entry.id, name, e.target.value)}
          style={{ paddingRight: '24px' }}
        >
          {opts.placeholder && <option value="">{opts.placeholder}</option>}
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="select-arrow" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>▾</span>
      </div>
      {showErrors && entry.errors[name] && (
        <span style={{ fontSize: '10px', color: 'var(--danger)', marginTop: '2px' }}>
          {entry.errors[name]}
        </span>
      )}
    </div>
  );

  const renderToggle = (name, label, desc) => {
    const active = entry[name] === true;
    return (
      <button
        type="button"
        className={`toggle-pill-btn ${active ? 'active' : ''}`}
        onClick={() => onChange(entry.id, name, !active)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          padding: '10px 12px',
          border: '1px solid',
          borderColor: active ? 'var(--product-accent)' : 'var(--border)',
          borderRadius: '8px',
          background: active ? 'var(--product-accent-soft)' : 'transparent',
          color: active ? 'var(--product-accent)' : 'var(--text-muted)',
          cursor: 'pointer',
          transition: 'all 0.2s',
          textAlign: 'left'
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{label}</span>
        <span style={{ fontSize: '9px', opacity: 0.8, marginTop: '2px' }}>{desc}</span>
      </button>
    );
  };

  const imageField = () => {
    const hasImage = !!entry.image_base64;
    return (
      <div className="field-group span-2" style={{ marginTop: '4px' }}>
        <label className="field-label">
          📸 Product Image <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>(optional)</span>
        </label>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {hasImage ? (
            <div style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
              <img src={entry.image_base64} alt="product preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={() => {
                  onChange(entry.id, 'image_base64', '');
                  onChange(entry.id, 'image_name', '');
                }}
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  background: 'rgba(0,0,0,0.6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <label style={{
              flex: 1,
              height: '100px',
              borderRadius: '12px',
              border: '2px dashed var(--border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'border-color 0.2s',
              backgroundColor: 'rgba(255,255,255,0.02)'
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--product-accent)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <span style={{ fontSize: '24px' }}>🖼️</span>
              <span style={{ fontSize: '11px', marginTop: '4px', fontWeight: 'bold' }}>Choose or drag image file</span>
              <span style={{ fontSize: '9px', opacity: 0.7 }}>Support PNG, JPG</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />
            </label>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`entry-card product-card ${hasErrors ? 'has-error' : ''}`}>
      <div className="entry-card-header">
        <div className="entry-number">
          <div className="entry-badge product-badge">{index + 1}</div>
          <span className="entry-label">Product Entry</span>
        </div>
        <button className="btn-remove" onClick={() => onRemove(entry.id)} title="Remove entry">
          ✕
        </button>
      </div>

      <div className="fields-grid" style={{ gap: '14px 16px' }}>
        {textField('name', 'Product Name', 'e.g. Fresh Orange Juice', { span: true })}
        
        {selectField('category_id', 'Category', categories.map(c => ({ value: c.id, label: c.name })), {
          placeholder: '— Select Category —'
        })}
        
        {selectField('product_type', 'Product Type', PRODUCT_TYPE_OPTIONS)}

        {textField('price', 'Price (LKR)', 'e.g. 500.00')}
        
        {textField('discounted_price', 'Sale Price (LKR)', 'Optional', { optional: true })}

        {selectField('price_rate_type', 'Price Rate Type', PRICE_RATE_TYPE_OPTIONS)}

        {selectField('stock_status', 'Stock Status', STOCK_STATUS_OPTIONS)}

        {textField('stock_quantity', 'Stock Quantity', 'Optional', { optional: true })}

        {textField('description', 'Description', 'Describe the product...', { span: true, optional: true })}
        {imageField()}
      </div>

      {/* Switches Grid */}
      <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px' }}>
          ⚙️ Availability & Attributes
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
          {renderToggle('is_available', '🟢 Available', 'Visible to customers')}
          {renderToggle('is_pre_orderable', '📅 Pre-Orderable', 'Order before travel')}
          {renderToggle('is_featured', '⭐ Featured', 'Show in featured section')}
          {renderToggle('is_vegetarian', '🥦 Vegetarian', 'Non-meat option')}
          {renderToggle('is_vegan', '🌱 Vegan', 'Plant-based only')}
          {renderToggle('is_halal', '☪️ Halal', 'Halal certified')}
        </div>
      </div>
    </div>
  );
}

function PackageEntryCard({ entry, index, onChange, onRemove, showErrors }) {
  const hasErrors = showErrors && Object.keys(entry.errors).length > 0;

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      onChange(entry.id, 'image_base64', reader.result);
      onChange(entry.id, 'image_name', file.name);
    };
    reader.readAsDataURL(file);
  };

  const textField = (name, label, placeholder = '', opts = {}) => (
    <div className={`field-group ${opts.span ? 'span-2' : ''}`}>
      <label className="field-label">
        {label}{!opts.optional && <span className="required"> *</span>}
      </label>
      <input
        className={`field-input ${showErrors && entry.errors[name] ? 'error' : ''}`}
        type={opts.type || 'text'}
        placeholder={placeholder}
        value={entry[name]}
        onChange={e => onChange(entry.id, name, e.target.value)}
      />
      {showErrors && entry.errors[name] && (
        <span style={{ fontSize: '10px', color: 'var(--danger)', marginTop: '2px' }}>
          {entry.errors[name]}
        </span>
      )}
    </div>
  );

  const selectField = (name, label, options, opts = {}) => (
    <div className={`field-group ${opts.span ? 'span-2' : ''}`}>
      <label className="field-label">
        {label}{!opts.optional && <span className="required"> *</span>}
      </label>
      <div className="select-container" style={{ position: 'relative' }}>
        <select
          className={`field-input ${showErrors && entry.errors[name] ? 'error' : ''}`}
          value={entry[name]}
          onChange={e => onChange(entry.id, name, e.target.value)}
          style={{ paddingRight: '24px' }}
        >
          {opts.placeholder && <option value="">{opts.placeholder}</option>}
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="select-arrow" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>▾</span>
      </div>
      {showErrors && entry.errors[name] && (
        <span style={{ fontSize: '10px', color: 'var(--danger)', marginTop: '2px' }}>
          {entry.errors[name]}
        </span>
      )}
    </div>
  );

  const renderToggle = (name, label, desc) => {
    const active = entry[name] === true;
    return (
      <button
        type="button"
        className={`toggle-pill-btn ${active ? 'active' : ''}`}
        onClick={() => onChange(entry.id, name, !active)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          padding: '10px 12px',
          border: '1px solid',
          borderColor: active ? 'var(--package-accent, #8b5cf6)' : 'var(--border)',
          borderRadius: '8px',
          background: active ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
          color: active ? 'var(--package-accent, #8b5cf6)' : 'var(--text-muted)',
          cursor: 'pointer',
          transition: 'all 0.2s',
          textAlign: 'left'
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{label}</span>
        <span style={{ fontSize: '9px', opacity: 0.8, marginTop: '2px' }}>{desc}</span>
      </button>
    );
  };

  const imageField = () => {
    const hasImage = !!entry.image_base64;
    return (
      <div className="field-group span-2" style={{ marginTop: '4px' }}>
        <label className="field-label">
          📸 Package Image <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>(optional)</span>
        </label>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {hasImage ? (
            <div style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
              <img src={entry.image_base64} alt="package preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={() => {
                  onChange(entry.id, 'image_base64', '');
                  onChange(entry.id, 'image_name', '');
                }}
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  background: 'rgba(0,0,0,0.6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <label style={{
              flex: 1,
              height: '100px',
              borderRadius: '12px',
              border: '2px dashed var(--border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'border-color 0.2s',
              backgroundColor: 'rgba(255,255,255,0.02)'
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--package-accent, #8b5cf6)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <span style={{ fontSize: '24px' }}>🖼️</span>
              <span style={{ fontSize: '11px', marginTop: '4px', fontWeight: 'bold' }}>Choose package image</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />
            </label>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`entry-card package-card ${hasErrors ? 'has-error' : ''}`}>
      <div className="entry-card-header">
        <div className="entry-number">
          <div className="entry-badge package-badge">{index + 1}</div>
          <span className="entry-label">Package Entry</span>
        </div>
        <button className="btn-remove" onClick={() => onRemove(entry.id)} title="Remove entry">
          ✕
        </button>
      </div>

      <div className="fields-grid" style={{ gap: '14px 16px' }}>
        {textField('package_name', 'Package Name', 'e.g. VIP Gold Transit Lounge', { span: true })}
        
        {selectField('package_type', 'Package Type', [
          { value: 'standard', label: 'Standard' },
          { value: 'gold', label: 'Gold' },
          { value: 'platinum', label: 'Platinum' }
        ])}

        {textField('price', 'Price (LKR)', 'e.g. 7500.00')}
        
        {textField('pax', 'Guests (PAX)', 'e.g. 2', { optional: true })}

        {textField('places', 'Places / Destinations', 'e.g. Temple of Tooth, Royal Botanical (comma-separated)', { span: true, optional: true })}

        {textField('description', 'Description', 'Describe what package includes...', { span: true })}

        {imageField()}
      </div>

      {/* Transport Toggle and Selection */}
      <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center' }}>
          {renderToggle('transport_status', '🚗 Transport Included', 'Toggle on if transport is provided')}
          
          {entry.transport_status && (
            selectField('transport_mode', 'Transport Mode', [
              { value: 'three-wheeler', label: '🛺 Three-Wheeler' },
              { value: 'van', label: '🚐 Van' },
              { value: 'car', label: '🚗 Car' }
            ])
          )}
        </div>
      </div>

      {/* Meals Toggle and Sub-entries */}
      <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
        {renderToggle('meal_status', '🍽️ Meals Included', 'Toggle on if meals are provided')}

        {entry.meal_status && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginTop: '12px', paddingLeft: '12px', borderLeft: '2px solid var(--package-accent, #8b5cf6)' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '12px', alignItems: 'center' }}>
              {renderToggle('breakfast_status', '🍳 Breakfast', 'Breakfast included')}
              {entry.breakfast_status && textField('breakfast_type', 'Breakfast Menu Items', 'e.g. Continental, Fruit Juice, Tea (comma-separated)', { optional: true })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '12px', alignItems: 'center' }}>
              {renderToggle('lunch_status', '🍲 Lunch', 'Lunch included')}
              {entry.lunch_status && textField('lunch_type', 'Lunch Menu Items', 'e.g. Fried Rice, Curry, Ice Cream (comma-separated)', { optional: true })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '12px', alignItems: 'center' }}>
              {renderToggle('evening_snack_status', '☕ Evening Snack', 'Snack included')}
              {entry.evening_snack_status && textField('evening_snack_type', 'Evening Snack Menu Items', 'e.g. Cake, Biscuits, Coffee (comma-separated)', { optional: true })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '12px', alignItems: 'center' }}>
              {renderToggle('dinner_status', '🍝 Dinner', 'Dinner included')}
              {entry.dinner_status && textField('dinner_type', 'Dinner Menu Items', 'e.g. Pasta, Soup, Pudding (comma-separated)', { optional: true })}
            </div>

          </div>
        )}
      </div>

    </div>
  );
}

function LoungeSelector({ lounges, selectedLoungeId, onSelect, mode }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const selectedLounge = lounges.find(l => l.id === selectedLoungeId);

  // Sync searchQuery with selectedLounge when selectedLounge changes
  useEffect(() => {
    if (selectedLounge) {
      setSearchQuery(selectedLounge.lounge_name);
    } else {
      setSearchQuery('');
    }
  }, [selectedLounge]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredLounges = lounges.filter(l => {
    const query = searchQuery.toLowerCase();
    return (
      l.lounge_name.toLowerCase().includes(query) ||
      (l.address && l.address.toLowerCase().includes(query))
    );
  });

  const desc = mode === 'drivers'
    ? 'Choose the lounge you want to add drivers to. The lounge_id will be applied to all driver entries.'
    : mode === 'staff'
    ? 'Choose the lounge you want to add staff to. The lounge_id will be applied to all staff entries.'
    : mode === 'products'
    ? 'Choose the lounge you want to add marketplace products to. The lounge_id will be applied to all product entries.'
    : mode === 'packages'
    ? 'Choose the lounge you want to add special packages to. The lounge_id will be applied to all package entries.'
    : 'Choose the lounge you want to add transport locations to. The lounge_id will be applied to all entries.';

  return (
    <div className="section-card" style={{ overflow: 'visible' }}>
      <div className="section-header">
        <div className="section-icon blue">🏨</div>
        <div>
          <div className="section-title">Step 1 — Select Target Lounge</div>
          <div className="section-desc">{desc}</div>
        </div>
      </div>

      <div className="lounge-select-wrapper" ref={dropdownRef} style={{ position: 'relative', overflow: 'visible' }}>
        <div style={{ display: 'flex', position: 'relative' }}>
          <input
            type="text"
            className="field-input"
            style={{ 
              paddingRight: '40px', 
              background: 'var(--bg-surface)', 
              border: '1.5px solid var(--border)', 
              color: 'var(--text-primary)', 
              borderRadius: 'var(--radius-md)',
              width: '100%',
              padding: '12px 16px',
              fontFamily: 'inherit',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            placeholder={lounges.length === 0 ? '⏳ Loading lounges...' : '🔍 Search lounge by name, address, or ID...'}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
              // Clear selection if input is edited
              if (selectedLoungeId) {
                onSelect('');
              }
            }}
            onFocus={() => setShowDropdown(true)}
            disabled={lounges.length === 0}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                onSelect('');
                setShowDropdown(false);
              }}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              ✕
            </button>
          )}
        </div>

        {showDropdown && lounges.length > 0 && (
          <div
            className="search-dropdown-menu"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: 'var(--bg-card)',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              zIndex: 9999,
              maxHeight: '220px',
              overflowY: 'auto',
              marginTop: '4px'
            }}
          >
            {filteredLounges.length === 0 ? (
              <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
                No lounges match your search
              </div>
            ) : (
              filteredLounges.map(l => (
                <div
                  key={l.id}
                  onClick={() => {
                    onSelect(l.id);
                    setSearchQuery(l.lounge_name);
                    setShowDropdown(false);
                  }}
                  className="dropdown-item"
                  style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border-light)',
                    transition: 'background 0.2s',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'var(--border-light)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--text-primary)' }}>
                    {l.lounge_name}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {l.address || 'No address'}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                    ID: {l.id} · Status: {l.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {selectedLounge && (
        <div className="selected-lounge-info">
          <span style={{ fontSize: '20px' }}>🏨</span>
          <div>
            <div className="lounge-info-name">{selectedLounge.lounge_name}</div>
            <div className="lounge-info-id">ID: {selectedLounge.id}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {selectedLounge.address} · Status: <span style={{
                color: selectedLounge.status === 'approved' ? 'var(--success)' : 'var(--warning)',
                fontWeight: 'bold'
              }}>{selectedLounge.status}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// Results Panel — Locations
// ────────────────────────────────────────────────
function LocationResultsPanel({ result, onReset }) {
  const successCount = result.results?.filter(r => r.status === 'success').length || 0;
  const errorCount = (result.results?.length || 0) - successCount;

  return (
    <div className="results-panel">
      <div className="section-card">
        <div className="section-header">
          <div className="section-icon green" style={{ fontSize: '20px' }}>🎉</div>
          <div>
            <div className="section-title">Bulk Insert Complete</div>
            <div className="section-desc">Transport locations committed to Supabase</div>
          </div>
        </div>

        <div className="results-summary">
          <div className="stat-card">
            <div className="stat-value blue">{result.total_inserted || 0}</div>
            <div className="stat-label">Total Processed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value green">{successCount}</div>
            <div className="stat-label">Successful</div>
          </div>
          <div className="stat-card">
            <div className="stat-value red">{errorCount}</div>
            <div className="stat-label">Failed</div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          {result.results?.map((r, i) => (
            <div key={i} className={`result-item ${r.status === 'success' ? 'success' : 'error'}`}>
              <span className="result-icon">{r.status === 'success' ? '✅' : '❌'}</span>
              <div className="result-text">
                <strong>Entry #{r.entry_index + 1}</strong>
                {r.status === 'success' ? (
                  <>
                    {' — '}<strong>"{r.location?.location}"</strong> inserted successfully
                    <div className="location-id">Location ID: {r.location?.id}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Prices: 3W=LKR {Number(r.prices?.three_wheeler_price).toFixed(2)} |
                      Car=LKR {Number(r.prices?.car_price).toFixed(2)} |
                      Van=LKR {Number(r.prices?.van_price).toFixed(2)}
                    </div>
                  </>
                ) : (
                  <> — <span style={{ color: 'var(--danger)' }}>{r.error || 'Failed'}</span></>
                )}
              </div>
            </div>
          ))}
        </div>

        <button className="btn-reset" onClick={onReset}>
          🔄 Start New Bulk Insert
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// Results Panel — Drivers
// ────────────────────────────────────────────────
function DriverResultsPanel({ result, onReset }) {
  const successCount = result.results?.filter(r => r.status === 'success').length || 0;
  const errorCount = (result.results?.length || 0) - successCount;

  const vehicleLabel = (vt) => {
    const map = { three_wheeler: '🛺 3-Wheeler', car: '🚗 Car', van: '🚐 Van' };
    return map[vt] || vt;
  };

  return (
    <div className="results-panel">
      <div className="section-card">
        <div className="section-header">
          <div className="section-icon" style={{ background: '#1e1b4b', fontSize: '20px' }}>🎉</div>
          <div>
            <div className="section-title">Driver Bulk Insert Complete</div>
            <div className="section-desc">Lounge drivers committed to Supabase</div>
          </div>
        </div>

        <div className="results-summary">
          <div className="stat-card">
            <div className="stat-value blue">{result.total_inserted || 0}</div>
            <div className="stat-label">Total Processed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value green">{successCount}</div>
            <div className="stat-label">Successful</div>
          </div>
          <div className="stat-card">
            <div className="stat-value red">{errorCount}</div>
            <div className="stat-label">Failed</div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          {result.results?.map((r, i) => (
            <div key={i} className={`result-item ${r.status === 'success' ? 'success' : 'error'}`}>
              <span className="result-icon">{r.status === 'success' ? '✅' : '❌'}</span>
              <div className="result-text">
                <strong>Driver #{r.entry_index + 1}</strong>
                {r.status === 'success' ? (
                  <>
                    {' — '}<strong>{r.driver?.name}</strong> added successfully
                    <div className="location-id">Driver ID: {r.driver?.id}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      NIC: {r.driver?.nic_number} · Contact: {r.driver?.contact_no} · Vehicle: {r.driver?.vehicle_no} · {vehicleLabel(r.driver?.vehicle_type)}
                    </div>
                  </>
                ) : (
                  <> — <span style={{ color: 'var(--danger)' }}>{r.error || 'Failed'}</span></>
                )}
              </div>
            </div>
          ))}
        </div>

        <button className="btn-reset" onClick={onReset}>
          🔄 Start New Bulk Insert
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// Results Panel — Staff
// ────────────────────────────────────────────────
function StaffResultsPanel({ result, onReset }) {
  const successCount = result.results?.filter(r => r.status === 'success').length || 0;
  const errorCount = (result.results?.length || 0) - successCount;

  return (
    <div className="results-panel">
      <div className="section-card">
        <div className="section-header">
          <div className="section-icon" style={{ background: '#064e3b55', fontSize: '20px' }}>🎉</div>
          <div>
            <div className="section-title">Staff Bulk Insert Complete</div>
            <div className="section-desc">Lounge staff members committed to Supabase</div>
          </div>
        </div>

        <div className="results-summary">
          <div className="stat-card">
            <div className="stat-value blue">{result.total_inserted || 0}</div>
            <div className="stat-label">Total Processed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value green">{successCount}</div>
            <div className="stat-label">Successful</div>
          </div>
          <div className="stat-card">
            <div className="stat-value red">{errorCount}</div>
            <div className="stat-label">Failed</div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          {result.results?.map((r, i) => (
            <div key={i} className={`result-item ${r.status === 'success' ? 'success' : 'error'}`}>
              <span className="result-icon">{r.status === 'success' ? '✅' : '❌'}</span>
              <div className="result-text">
                <strong>Staff #{r.entry_index + 1}</strong>
                {r.status === 'success' ? (
                  <>
                    {' — '}<strong>{r.staff?.full_name}</strong> added successfully
                    <div className="location-id">Staff ID: {r.staff?.id}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      NIC: {r.staff?.nic_number} · Phone: {r.phone} · Status: {r.staff?.approval_status} / {r.staff?.employment_status}
                    </div>
                  </>
                ) : (
                  <> — <span style={{ color: 'var(--danger)' }}>{r.error || 'Failed'}</span></>
                )}
              </div>
            </div>
          ))}
        </div>

        <button className="btn-reset" onClick={onReset}>
          🔄 Start New Bulk Insert
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// Results Panel — Products
// ────────────────────────────────────────────────
function ProductResultsPanel({ result, onReset }) {
  const successCount = result.results?.filter(r => r.status === 'success').length || 0;
  const errorCount = (result.results?.length || 0) - successCount;

  return (
    <div className="results-panel">
      <div className="section-card">
        <div className="section-header">
          <div className="section-icon" style={{ background: 'var(--product-accent-soft)', fontSize: '20px' }}>🎉</div>
          <div>
            <div className="section-title">Product Bulk Insert Complete</div>
            <div className="section-desc">Marketplace products committed to Supabase</div>
          </div>
        </div>

        <div className="results-summary">
          <div className="stat-card">
            <div className="stat-value blue">{result.total_inserted || 0}</div>
            <div className="stat-label">Total Processed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value green">{successCount}</div>
            <div className="stat-label">Successful</div>
          </div>
          <div className="stat-card">
            <div className="stat-value red">{errorCount}</div>
            <div className="stat-label">Failed</div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          {result.results?.map((r, i) => (
            <div key={i} className={`result-item ${r.status === 'success' ? 'success' : 'error'}`} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span className="result-icon">{r.status === 'success' ? '✅' : '❌'}</span>
              
              {r.status === 'success' && r.product?.image_url && (
                <div style={{ width: '40px', height: '40px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
                  <img src={r.product.image_url} alt={r.product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}

              <div className="result-text" style={{ flexGrow: 1 }}>
                <strong>Product #{r.entry_index + 1}</strong>
                {r.status === 'success' ? (
                  <>
                    {' — '}<strong>{r.product?.name}</strong> added successfully
                    <div className="location-id">Product ID: {r.product?.id}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Type: {r.product?.product_type} · Price: LKR {r.product?.price} · Stock: {r.product?.stock_status} ({r.product?.stock_quantity ?? 'N/A'}) · Available: {r.product?.is_available ? 'Yes' : 'No'}
                    </div>
                  </>
                ) : (
                  <> — <span style={{ color: 'var(--danger)' }}>{r.error || 'Failed'}</span></>
                )}
              </div>
            </div>
          ))}
        </div>

        <button className="btn-reset" onClick={onReset}>
          🔄 Start New Bulk Insert
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// Results Panel — Packages
// ────────────────────────────────────────────────
function PackageResultsPanel({ result, onReset }) {
  const successCount = result.results?.filter(r => r.status === 'success').length || 0;
  const errorCount = (result.results?.length || 0) - successCount;

  return (
    <div className="results-panel">
      <div className="section-card">
        <div className="section-header">
          <div className="section-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', fontSize: '20px' }}>🎉</div>
          <div>
            <div className="section-title">Special Packages Bulk Insert Complete</div>
            <div className="section-desc">Lounge special packages committed to Supabase</div>
          </div>
        </div>

        <div className="results-summary">
          <div className="stat-card">
            <div className="stat-value blue">{result.total_inserted || 0}</div>
            <div className="stat-label">Total Processed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value green">{successCount}</div>
            <div className="stat-label">Successful</div>
          </div>
          <div className="stat-card">
            <div className="stat-value red">{errorCount}</div>
            <div className="stat-label">Failed</div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          {result.results?.map((r, i) => (
            <div key={i} className={`result-item ${r.status === 'success' ? 'success' : 'error'}`} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span className="result-icon">{r.status === 'success' ? '✅' : '❌'}</span>
              
              {r.status === 'success' && r.package?.image_url && (
                <div style={{ width: '40px', height: '40px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
                  <img src={r.package.image_url} alt={r.package.package_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}

              <div className="result-text" style={{ flexGrow: 1 }}>
                <strong>Package #{r.entry_index + 1}</strong>
                {r.status === 'success' ? (
                  <>
                    {' — '}<strong>{r.package?.package_name}</strong> added successfully
                    <div className="location-id">Package ID: {r.package?.id}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Type: {r.package?.package_type} · Price: LKR {r.package?.price} · Guests (Pax): {r.package?.pax ?? 'N/A'} · Transport: {r.package?.transport_status ? `Yes (${r.package?.transport_mode})` : 'No'}
                    </div>
                  </>
                ) : (
                  <> — <span style={{ color: 'var(--danger)' }}>{r.error || 'Failed'}</span></>
                )}
              </div>
            </div>
          ))}
        </div>

        <button className="btn-reset" onClick={onReset}>
          🔄 Start New Bulk Insert
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// Main App
// ────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState('locations'); // 'locations' | 'drivers' | 'staff' | 'products'
  const [dbStatus, setDbStatus] = useState('checking'); // 'checking' | 'ok' | 'error'
  const [lounges, setLounges] = useState([]);
  const [selectedLoungeId, setSelectedLoungeId] = useState('');
  const [categories, setCategories] = useState([]);

  // Location mode state
  const [locationEntries, setLocationEntries] = useState([EMPTY_LOCATION_ENTRY()]);
  const [locationShowErrors, setLocationShowErrors] = useState(false);
  const [locationResult, setLocationResult] = useState(null);

  // Driver mode state
  const [driverEntries, setDriverEntries] = useState([EMPTY_DRIVER_ENTRY()]);
  const [driverShowErrors, setDriverShowErrors] = useState(false);
  const [driverResult, setDriverResult] = useState(null);

  // Staff mode state
  const [staffEntries, setStaffEntries] = useState([EMPTY_STAFF_ENTRY()]);
  const [staffShowErrors, setStaffShowErrors] = useState(false);
  const [staffResult, setStaffResult] = useState(null);

  // Product mode state
  const [productEntries, setProductEntries] = useState([EMPTY_PRODUCT_ENTRY()]);
  const [productShowErrors, setProductShowErrors] = useState(false);
  const [productResult, setProductResult] = useState(null);

  // Package mode state
  const [packageEntries, setPackageEntries] = useState([EMPTY_PACKAGE_ENTRY()]);
  const [packageShowErrors, setPackageShowErrors] = useState(false);
  const [packageResult, setPackageResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [step, setStep] = useState(1);

  // ─── Toast helper ───
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ─── Health check + Lounges fetch ───
  useEffect(() => {
    const init = async () => {
      try {
        await axios.get(`${API_BASE}/health`);
        setDbStatus('ok');
        const res = await axios.get(`${API_BASE}/lounges`);
        setLounges(res.data.lounges || []);
        
        const catRes = await axios.get(`${API_BASE}/marketplace-categories`);
        setCategories(catRes.data.categories || []);
      } catch (err) {
        setDbStatus('error');
        addToast('Cannot connect to backend. Is the server running on port 4000?', 'error');
      }
    };
    init();
  }, [addToast]);

  // ─── Update step based on state ───
  const currentResult = mode === 'locations'
    ? locationResult
    : mode === 'drivers'
    ? driverResult
    : mode === 'staff'
    ? staffResult
    : mode === 'products'
    ? productResult
    : packageResult;

  useEffect(() => {
    if (currentResult) { setStep(3); return; }
    if (selectedLoungeId) { setStep(2); return; }
    setStep(1);
  }, [selectedLoungeId, currentResult]);

  // ─── Mode switch — reset only that mode's state ───
  const handleModeToggle = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setStep(selectedLoungeId ? 2 : 1);
    if (newMode === 'locations') {
      setLocationResult(null); setLocationShowErrors(false);
    } else if (newMode === 'drivers') {
      setDriverResult(null); setDriverShowErrors(false);
    } else if (newMode === 'staff') {
      setStaffResult(null); setStaffShowErrors(false);
    } else if (newMode === 'products') {
      setProductResult(null); setProductShowErrors(false);
    } else {
      setPackageResult(null); setPackageShowErrors(false);
    }
  };

  const selectedLounge = lounges.find(l => l.id === selectedLoungeId);

  // ─── Location entry handlers ───
  const handleAddLocationRow = () => setLocationEntries(prev => [...prev, EMPTY_LOCATION_ENTRY()]);

  const handleRemoveLocationRow = (id) => {
    if (locationEntries.length === 1) { addToast('At least one entry is required', 'error'); return; }
    setLocationEntries(prev => prev.filter(e => e.id !== id));
  };

  const handleLocationEntryChange = (id, field, value) => {
    setLocationEntries(prev => prev.map(e => {
      if (e.id !== id) return e;
      const updated = { ...e, [field]: value };
      if (locationShowErrors) updated.errors = validateLocationEntry(updated);
      return updated;
    }));
  };

  const handleDuplicateLastLocation = () => {
    if (locationEntries.length === 0) return;
    const last = locationEntries[locationEntries.length - 1];
    setLocationEntries(prev => [...prev, { ...last, id: Date.now() + Math.random(), errors: {} }]);
    addToast('Entry duplicated', 'info');
  };

  const handleClearAllLocations = () => {
    setLocationEntries([EMPTY_LOCATION_ENTRY()]);
    setLocationShowErrors(false);
    addToast('All entries cleared', 'info');
  };

  // ─── Driver entry handlers ───
  const handleAddDriverRow = () => setDriverEntries(prev => [...prev, EMPTY_DRIVER_ENTRY()]);

  const handleRemoveDriverRow = (id) => {
    if (driverEntries.length === 1) { addToast('At least one entry is required', 'error'); return; }
    setDriverEntries(prev => prev.filter(e => e.id !== id));
  };

  const handleDriverEntryChange = (id, field, value) => {
    setDriverEntries(prev => prev.map(e => {
      if (e.id !== id) return e;
      const updated = { ...e, [field]: value };
      if (driverShowErrors) updated.errors = validateDriverEntry(updated);
      return updated;
    }));
  };

  const handleDuplicateLastDriver = () => {
    if (driverEntries.length === 0) return;
    const last = driverEntries[driverEntries.length - 1];
    setDriverEntries(prev => [...prev, { ...last, id: Date.now() + Math.random(), errors: {} }]);
    addToast('Entry duplicated', 'info');
  };

  const handleClearAllDrivers = () => {
    setDriverEntries([EMPTY_DRIVER_ENTRY()]);
    setDriverShowErrors(false);
    addToast('All entries cleared', 'info');
  };

  // ─── Staff entry handlers ───
  const handleAddStaffRow = () => setStaffEntries(prev => [...prev, EMPTY_STAFF_ENTRY()]);

  const handleRemoveStaffRow = (id) => {
    if (staffEntries.length === 1) { addToast('At least one entry is required', 'error'); return; }
    setStaffEntries(prev => prev.filter(e => e.id !== id));
  };

  const handleStaffEntryChange = (id, field, value) => {
    setStaffEntries(prev => prev.map(e => {
      if (e.id !== id) return e;
      const updated = { ...e, [field]: value };
      if (staffShowErrors) updated.errors = validateStaffEntry(updated);
      return updated;
    }));
  };

  const handleDuplicateLastStaff = () => {
    if (staffEntries.length === 0) return;
    const last = staffEntries[staffEntries.length - 1];
    setStaffEntries(prev => [...prev, { ...last, id: Date.now() + Math.random(), errors: {} }]);
    addToast('Entry duplicated', 'info');
  };

  const handleClearAllStaff = () => {
    setStaffEntries([EMPTY_STAFF_ENTRY()]);
    setStaffShowErrors(false);
    addToast('All entries cleared', 'info');
  };

  // ─── Submit Staff ───
  const handleSubmitStaff = async () => {
    if (!selectedLoungeId) { addToast('Please select a lounge first', 'error'); return; }

    const validated = staffEntries.map(e => ({ ...e, errors: validateStaffEntry(e) }));
    setStaffEntries(validated);
    setStaffShowErrors(true);

    const hasErrors = validated.some(e => Object.keys(e.errors).length > 0);
    if (hasErrors) { addToast('Please fix validation errors before submitting', 'error'); return; }

    setLoading(true);
    try {
      const payload = {
        lounge_id: selectedLoungeId,
        entries: staffEntries.map(e => ({
          full_name: e.full_name.trim(),
          nic_number: e.nic_number.trim(),
          phone: e.phone.trim(),
          ...(e.email.trim() ? { email: e.email.trim() } : {}),
        })),
      };
      const res = await axios.post(`${API_BASE}/bulk-insert-staff`, payload);
      setStaffResult(res.data);
      addToast(`✅ ${res.data.total_inserted} staff members inserted successfully!`, 'success');
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      addToast(`Insert failed: ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ─── Product entry handlers ───
  const handleAddProductRow = () => setProductEntries(prev => [...prev, EMPTY_PRODUCT_ENTRY()]);

  const handleRemoveProductRow = (id) => {
    if (productEntries.length === 1) { addToast('At least one entry is required', 'error'); return; }
    setProductEntries(prev => prev.filter(e => e.id !== id));
  };

  const handleProductEntryChange = (id, field, value) => {
    setProductEntries(prev => prev.map(e => {
      if (e.id !== id) return e;
      const updated = { ...e, [field]: value };
      if (productShowErrors) updated.errors = validateProductEntry(updated);
      return updated;
    }));
  };

  const handleDuplicateLastProduct = () => {
    if (productEntries.length === 0) return;
    const last = productEntries[productEntries.length - 1];
    setProductEntries(prev => [...prev, { ...last, id: Date.now() + Math.random(), errors: {} }]);
    addToast('Entry duplicated', 'info');
  };

  const handleClearAllProducts = () => {
    setProductEntries([EMPTY_PRODUCT_ENTRY()]);
    setProductShowErrors(false);
    addToast('All entries cleared', 'info');
  };

  // ─── Submit Products ───
  const handleSubmitProducts = async () => {
    if (!selectedLoungeId) { addToast('Please select a lounge first', 'error'); return; }

    const validated = productEntries.map(e => ({ ...e, errors: validateProductEntry(e) }));
    setProductEntries(validated);
    setProductShowErrors(true);

    const hasErrors = validated.some(e => Object.keys(e.errors).length > 0);
    if (hasErrors) { addToast('Please fix validation errors before submitting', 'error'); return; }

    setLoading(true);
    try {
      const payload = {
        lounge_id: selectedLoungeId,
        entries: productEntries.map(e => ({
          category_id: e.category_id,
          name: e.name.trim(),
          description: e.description.trim() || undefined,
          product_type: e.product_type,
          price: e.price,
          price_rate_type: e.price_rate_type,
          discounted_price: e.discounted_price.trim() || undefined,
          stock_status: e.stock_status,
          stock_quantity: e.stock_quantity.trim() || undefined,
          is_available: e.is_available,
          is_pre_orderable: e.is_pre_orderable,
          is_featured: e.is_featured,
          is_vegetarian: e.is_vegetarian,
          is_vegan: e.is_vegan,
          is_halal: e.is_halal,
          image_base64: e.image_base64 || undefined,
          image_name: e.image_name || undefined,
        })),
      };
      const res = await axios.post(`${API_BASE}/bulk-insert-products`, payload);
      setProductResult(res.data);
      addToast(`✅ ${res.data.total_inserted} products inserted successfully!`, 'success');
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      addToast(`Insert failed: ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ─── Package entry handlers ───
  const handleAddPackageRow = () => setPackageEntries(prev => [...prev, EMPTY_PACKAGE_ENTRY()]);

  const handleRemovePackageRow = (id) => {
    if (packageEntries.length === 1) { addToast('At least one entry is required', 'error'); return; }
    setPackageEntries(prev => prev.filter(e => e.id !== id));
  };

  const handlePackageEntryChange = (id, field, value) => {
    setPackageEntries(prev => prev.map(e => {
      if (e.id !== id) return e;
      const updated = { ...e, [field]: value };
      if (packageShowErrors) updated.errors = validatePackageEntry(updated);
      return updated;
    }));
  };

  const handleDuplicateLastPackage = () => {
    if (packageEntries.length === 0) return;
    const last = packageEntries[packageEntries.length - 1];
    setPackageEntries(prev => [...prev, { ...last, id: Date.now() + Math.random(), errors: {} }]);
    addToast('Entry duplicated', 'info');
  };

  const handleClearAllPackages = () => {
    setPackageEntries([EMPTY_PACKAGE_ENTRY()]);
    setPackageShowErrors(false);
    addToast('All entries cleared', 'info');
  };

  // ─── Submit Packages ───
  const handleSubmitPackages = async () => {
    if (!selectedLoungeId) { addToast('Please select a lounge first', 'error'); return; }

    const validated = packageEntries.map(e => ({ ...e, errors: validatePackageEntry(e) }));
    setPackageEntries(validated);
    setPackageShowErrors(true);

    const hasErrors = validated.some(e => Object.keys(e.errors).length > 0);
    if (hasErrors) { addToast('Please fix validation errors before submitting', 'error'); return; }

    setLoading(true);
    try {
      const payload = {
        lounge_id: selectedLoungeId,
        entries: packageEntries.map(e => {
          // Parse list strings to arrays
          const placesList = e.places ? e.places.split(',').map(s => s.trim()).filter(Boolean) : [];
          const bList = e.breakfast_status && e.breakfast_type ? e.breakfast_type.split(',').map(s => s.trim()).filter(Boolean) : [];
          const lList = e.lunch_status && e.lunch_type ? e.lunch_type.split(',').map(s => s.trim()).filter(Boolean) : [];
          const esList = e.evening_snack_status && e.evening_snack_type ? e.evening_snack_type.split(',').map(s => s.trim()).filter(Boolean) : [];
          const dList = e.dinner_status && e.dinner_type ? e.dinner_type.split(',').map(s => s.trim()).filter(Boolean) : [];

          return {
            package_name: e.package_name.trim(),
            description: e.description.trim(),
            package_type: e.package_type,
            price: e.price,
            pax: e.pax.trim() || undefined,
            transport_status: e.transport_status,
            transport_mode: e.transport_status ? e.transport_mode : undefined,
            meal_status: e.meal_status,
            breakfast_status: e.meal_status ? e.breakfast_status : false,
            breakfast_type: e.meal_status && e.breakfast_status ? bList : undefined,
            lunch_status: e.meal_status ? e.lunch_status : false,
            lunch_type: e.meal_status && e.lunch_status ? lList : undefined,
            evening_snack_status: e.meal_status ? e.evening_snack_status : false,
            evening_snack_type: e.meal_status && e.evening_snack_status ? esList : undefined,
            dinner_status: e.meal_status ? e.dinner_status : false,
            dinner_type: e.meal_status && e.dinner_status ? dList : undefined,
            places: placesList.length > 0 ? placesList : undefined,
            image_base64: e.image_base64 || undefined,
            image_name: e.image_name || undefined,
          };
        }),
      };
      const res = await axios.post(`${API_BASE}/bulk-insert-packages`, payload);
      setPackageResult(res.data);
      addToast(`✅ ${res.data.total_inserted} packages inserted successfully!`, 'success');
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      addToast(`Insert failed: ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ─── Submit Locations ───
  const handleSubmitLocations = async () => {
    if (!selectedLoungeId) { addToast('Please select a lounge first', 'error'); return; }

    const validated = locationEntries.map(e => ({ ...e, errors: validateLocationEntry(e) }));
    setLocationEntries(validated);
    setLocationShowErrors(true);

    const hasErrors = validated.some(e => Object.keys(e.errors).length > 0);
    if (hasErrors) { addToast('Please fix validation errors before submitting', 'error'); return; }

    setLoading(true);
    try {
      const payload = {
        lounge_id: selectedLoungeId,
        entries: locationEntries.map(e => ({
          location: e.location.trim(),
          latitude: parseFloat(e.latitude),
          longitude: parseFloat(e.longitude),
          est_duration: parseInt(e.est_duration),
          distance: parseFloat(e.distance),
          three_wheeler_price: parseFloat(e.three_wheeler_price),
          car_price: parseFloat(e.car_price),
          van_price: parseFloat(e.van_price),
        })),
      };
      const res = await axios.post(`${API_BASE}/bulk-insert`, payload);
      setLocationResult(res.data);
      addToast(`✅ ${res.data.total_inserted} locations inserted successfully!`, 'success');
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      addToast(`Insert failed: ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ─── Submit Drivers ───
  const handleSubmitDrivers = async () => {
    if (!selectedLoungeId) { addToast('Please select a lounge first', 'error'); return; }

    const validated = driverEntries.map(e => ({ ...e, errors: validateDriverEntry(e) }));
    setDriverEntries(validated);
    setDriverShowErrors(true);

    const hasErrors = validated.some(e => Object.keys(e.errors).length > 0);
    if (hasErrors) { addToast('Please fix validation errors before submitting', 'error'); return; }

    setLoading(true);
    try {
      const payload = {
        lounge_id: selectedLoungeId,
        entries: driverEntries.map(e => ({
          name: e.name.trim(),
          nic_number: e.nic_number.trim(),
          contact_no: e.contact_no.trim(),
          vehicle_no: e.vehicle_no.trim(),
          vehicle_type: e.vehicle_type,
        })),
      };
      const res = await axios.post(`${API_BASE}/bulk-insert-drivers`, payload);
      setDriverResult(res.data);
      addToast(`✅ ${res.data.total_inserted} drivers inserted successfully!`, 'success');
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      addToast(`Insert failed: ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ─── Reset ───
  const handleReset = () => {
    setLocationResult(null);
    setDriverResult(null);
    setStaffResult(null);
    setProductResult(null);
    setPackageResult(null);
    setLocationEntries([EMPTY_LOCATION_ENTRY()]);
    setDriverEntries([EMPTY_DRIVER_ENTRY()]);
    setStaffEntries([EMPTY_STAFF_ENTRY()]);
    setProductEntries([EMPTY_PRODUCT_ENTRY()]);
    setPackageEntries([EMPTY_PACKAGE_ENTRY()]);
    setSelectedLoungeId('');
    setLocationShowErrors(false);
    setDriverShowErrors(false);
    setStaffShowErrors(false);
    setProductShowErrors(false);
    setPackageShowErrors(false);
    setStep(1);
  };

  // ─── Render ───
  const isLocations = mode === 'locations';
  const isDrivers = mode === 'drivers';
  const isStaff = mode === 'staff';
  const isProducts = mode === 'products';
  const isPackages = mode === 'packages';
  const entries = isLocations 
    ? locationEntries 
    : isDrivers 
    ? driverEntries 
    : isStaff 
    ? staffEntries 
    : isProducts
    ? productEntries
    : packageEntries;
  const result = isLocations 
    ? locationResult 
    : isDrivers 
    ? driverResult 
    : isStaff 
    ? staffResult 
    : isProducts
    ? productResult
    : packageResult;

  return (
    <div className="app-wrapper">
      {/* Header */}
      <header className="header">
        <div className="header-icon">🚌</div>
        <div>
          <div className="header-title">SmartTransit · Bulk Inserter</div>
          <div className="header-subtitle">
            {isLocations 
              ? 'Lounge Transport Locations & Pricing' 
              : isDrivers 
              ? 'Lounge Driver Management' 
              : isStaff 
              ? 'Lounge Staff Management' 
              : isProducts
              ? 'Lounge Marketplace Products'
              : 'Lounge Special Packages'}
          </div>
        </div>
        <div className={`header-badge ${dbStatus === 'ok' ? 'connected' : 'disconnected'}`}>
          {dbStatus === 'checking' ? '⏳ Connecting' : dbStatus === 'ok' ? '● Supabase Connected' : '✕ DB Offline'}
        </div>
      </header>

      <div className="main-container">
        {/* Mode Toggle */}
        <ModeToggle mode={mode} onToggle={handleModeToggle} />

        {/* Steps */}
        <StepsBar step={step} />

        {/* Results view */}
        {result ? (
          isLocations
            ? <LocationResultsPanel result={result} onReset={handleReset} />
            : isDrivers
            ? <DriverResultsPanel result={result} onReset={handleReset} />
            : isStaff
            ? <StaffResultsPanel result={result} onReset={handleReset} />
            : isProducts
            ? <ProductResultsPanel result={result} onReset={handleReset} />
            : <PackageResultsPanel result={result} onReset={handleReset} />
        ) : (
          <>
            {/* ─── Step 1: Lounge Selector ─── */}
            <LoungeSelector
              lounges={lounges}
              selectedLoungeId={selectedLoungeId}
              onSelect={setSelectedLoungeId}
              mode={mode}
            />

            {/* ─── Step 2: Entries ─── */}
            <div className="section-card">
              <div className="section-header">
                <div className={`section-icon ${isLocations ? 'purple' : isDrivers ? 'orange' : isStaff ? 'teal' : isProducts ? 'rose' : 'violet'}`}>
                  {isLocations ? '📋' : isDrivers ? '🚗' : isStaff ? '👤' : isProducts ? '🛍️' : '📦'}
                </div>
                <div>
                  <div className="section-title">
                    {isLocations
                      ? 'Step 2 — Add Transport Location Entries'
                      : isDrivers
                      ? 'Step 2 — Add Lounge Driver Entries'
                      : isStaff
                      ? 'Step 2 — Add Lounge Staff Entries'
                      : isProducts
                      ? 'Step 2 — Add Lounge Product Entries'
                      : 'Step 2 — Add Lounge Special Package Entries'}
                  </div>
                  <div className="section-desc">
                    {isLocations
                      ? 'Each entry creates one transport location row and its linked price row. Prices are stored in LKR.'
                      : isDrivers
                      ? 'Each entry registers one driver for the selected lounge. Default status is active.'
                      : isStaff
                      ? 'Each entry registers one staff member. A user account is created if the phone number is new.'
                      : isProducts
                      ? 'Each entry creates one lounge product or service in the lounge marketplace.'
                      : 'Each entry creates one lounge special package with meals, transport, and destination options.'}
                  </div>
                </div>
              </div>

              <div className="entries-count-bar">
                <div className="count-pill">
                  <span>📦 Entries:</span>
                  <span className="num">{entries.length}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn-reset"
                    style={{ padding: '6px 14px', fontSize: '12px' }}
                    onClick={
                      isLocations 
                        ? handleDuplicateLastLocation 
                        : isDrivers 
                        ? handleDuplicateLastDriver 
                        : isStaff 
                        ? handleDuplicateLastStaff 
                        : isProducts
                        ? handleDuplicateLastProduct
                        : handleDuplicateLastPackage
                    }
                    disabled={entries.length === 0}
                    title="Duplicate last entry"
                  >
                    ⊕ Duplicate Last
                  </button>
                  <button
                    className="btn-reset"
                    style={{ padding: '6px 14px', fontSize: '12px', color: 'var(--danger)', borderColor: 'var(--danger)44' }}
                    onClick={
                      isLocations 
                        ? handleClearAllLocations 
                        : isDrivers 
                        ? handleClearAllDrivers 
                        : isStaff 
                        ? handleClearAllStaff 
                        : isProducts
                        ? handleClearAllProducts
                        : handleClearAllPackages
                    }
                  >
                    🗑 Clear All
                  </button>
                  <button
                    className={`btn-add-row ${isLocations ? '' : isDrivers ? 'driver-add-btn' : isStaff ? 'staff-add-btn' : isProducts ? 'product-add-btn' : 'package-add-btn'}`}
                    onClick={
                      isLocations 
                        ? handleAddLocationRow 
                        : isDrivers 
                        ? handleAddDriverRow 
                        : isStaff 
                        ? handleAddStaffRow 
                        : isProducts
                        ? handleAddProductRow
                        : handleAddPackageRow
                    }
                  >
                    + Add Entry
                  </button>
                </div>
              </div>

              {entries.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📭</div>
                  <div className="empty-state-text">No entries yet</div>
                  <div className="empty-state-sub">Click "Add Entry" to get started</div>
                </div>
              ) : isLocations ? (
                locationEntries.map((entry, i) => (
                  <LocationEntryCard
                    key={entry.id}
                    entry={entry}
                    index={i}
                    onChange={handleLocationEntryChange}
                    onRemove={handleRemoveLocationRow}
                    showErrors={locationShowErrors}
                  />
                ))
              ) : isDrivers ? (
                driverEntries.map((entry, i) => (
                  <DriverEntryCard
                    key={entry.id}
                    entry={entry}
                    index={i}
                    onChange={handleDriverEntryChange}
                    onRemove={handleRemoveDriverRow}
                    showErrors={driverShowErrors}
                  />
                ))
              ) : isStaff ? (
                staffEntries.map((entry, i) => (
                  <StaffEntryCard
                    key={entry.id}
                    entry={entry}
                    index={i}
                    onChange={handleStaffEntryChange}
                    onRemove={handleRemoveStaffRow}
                    showErrors={staffShowErrors}
                  />
                ))
              ) : isProducts ? (
                productEntries.map((entry, i) => (
                  <ProductEntryCard
                    key={entry.id}
                    entry={entry}
                    index={i}
                    onChange={handleProductEntryChange}
                    onRemove={handleRemoveProductRow}
                    showErrors={productShowErrors}
                    categories={categories}
                  />
                ))
              ) : (
                packageEntries.map((entry, i) => (
                  <PackageEntryCard
                    key={entry.id}
                    entry={entry}
                    index={i}
                    onChange={handlePackageEntryChange}
                    onRemove={handleRemovePackageRow}
                    showErrors={packageShowErrors}
                  />
                ))
              )}
            </div>

            {/* ─── Step 3: Submit ─── */}
            <div className="submit-area">
              <div className="submit-info">
                Ready to insert{' '}
                <strong>
                  {entries.length}{' '}
                  {isLocations 
                    ? `location${entries.length !== 1 ? 's' : ''}` 
                    : isDrivers 
                    ? `driver${entries.length !== 1 ? 's' : ''}` 
                    : isStaff 
                    ? `staff member${entries.length !== 1 ? 's' : ''}` 
                    : isProducts
                    ? `product${entries.length !== 1 ? 's' : ''}`
                    : `package${entries.length !== 1 ? 's' : ''}`}
                </strong>
                {selectedLounge ? (
                  <> into <strong>"{selectedLounge.lounge_name}"</strong></>
                ) : (
                  <> — <span style={{ color: 'var(--warning)' }}>no lounge selected</span></>
                )}
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {isLocations
                    ? 'Each entry = 1 location row + 1 price row · All inserted in a single DB transaction'
                    : isDrivers
                    ? 'Each entry = 1 driver row · All inserted in a single DB transaction'
                    : isStaff
                    ? 'Each entry = 1 staff row + user lookup/creation · All inserted in a single DB transaction'
                    : isProducts
                    ? 'Each entry = 1 product row · All inserted in a single DB transaction'
                    : 'Each entry = 1 special package row · All inserted in a single DB transaction'}
                </div>
              </div>

              <button
                className={`btn-submit ${isLocations ? '' : isDrivers ? 'driver-submit-btn' : isStaff ? 'staff-submit-btn' : isProducts ? 'product-submit-btn' : 'package-submit-btn'}`}
                onClick={
                  isLocations 
                    ? handleSubmitLocations 
                    : isDrivers 
                    ? handleSubmitDrivers 
                    : isStaff 
                    ? handleSubmitStaff 
                    : isProducts
                    ? handleSubmitProducts
                    : handleSubmitPackages
                }
                disabled={!selectedLoungeId || entries.length === 0 || loading}
              >
                {loading 
                  ? <><span className="loading-dots">Inserting</span></> 
                  : `🚀 Bulk Insert ${isLocations ? 'Locations' : isDrivers ? 'Drivers' : isStaff ? 'Staff' : isProducts ? 'Products' : 'Packages'}`}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="progress-overlay">
          <div className="progress-card">
            <div className="spinner" />
            <div className="progress-title">Inserting into Supabase<span className="loading-dots"></span></div>
            <div className="progress-sub">
              Writing {entries.length}{' '}
              {isLocations 
                ? `location${entries.length !== 1 ? 's' : ''}` 
                : isDrivers 
                ? `driver${entries.length !== 1 ? 's' : ''}` 
                : isStaff 
                ? `staff member${entries.length !== 1 ? 's' : ''}` 
                : `product${entries.length !== 1 ? 's' : ''}`}{' '}
              in one transaction
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: '100%', animation: 'none', opacity: 0.5 }} />
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} />
    </div>
  );
}

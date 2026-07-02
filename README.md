# SmartTransit — Bulk Inserter

A web tool to bulk-insert **lounge transport locations** and their **prices** into the Supabase database in one transaction.

## Architecture

```
bulk-inserter/
├── backend/          # Node.js + Express + pg (direct Supabase connection)
│   ├── server.js
│   ├── .env
│   └── package.json
└── frontend/         # React app
    ├── src/
    │   ├── App.js
    │   ├── index.js
    │   └── index.css
    └── package.json
```

## How it works

1. **Select a lounge** from the dropdown (fetched from Supabase)
2. **Add entries** — each entry has all fields for `lounge_transport_locations` + `lounge_transport_location_prices`
3. **Click Bulk Insert** — the backend runs a single PostgreSQL transaction:
   - Inserts each location row → gets back the auto-generated `id`
   - Uses that `id` as `location_id` to insert the price row

## Setup & Run

### Backend
```bash
cd backend
npm install
npm run dev     # starts on port 4000
```

### Frontend
```bash
cd frontend
npm install
npm start       # starts on port 3000
```

Open http://localhost:3000

## DB Tables

- `lounge_transport_locations` — location, lat/lon, est_duration, distance
- `lounge_transport_location_prices` — three_wheeler_price, car_price, van_price (linked by location_id)

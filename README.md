# C18 Channel Manager

Web-based booking management and mini channel manager for C18 Company.

## What It Includes
- Secure role login for `Admin` and `Agent`
- Dashboard with arrivals, departures, occupancy, availability, upcoming bookings, and revenue
- Hotel-style monthly and weekly availability calendar
- Color-coded inventory: green available, red confirmed, yellow tentative hold, grey blocked
- Drag-and-drop booking moves with overlap checks
- Booking form with guest details, dates, property, room type, room, source, totals, balance, notes, and history
- Availability search with available rooms, occupied rooms, tentative holds, and suggested alternatives
- Admin management for properties, room types, rooms, capacities, inactive rooms, agents, and room blocks
- Reports for occupancy, revenue, and booking status
- Export bookings as CSV, Excel-compatible `.xls`, and print/PDF
- Local demo mode plus Google Apps Script/Google Sheets cloud database

## Seeded C18 Inventory
- Good Earth Homestay
- Camp Alpha

## Demo Login
- Admin: `C18 Admin`, PIN `1234`
- Agent: `Meera`, PIN `2222`
- Agent: `Rahul`, PIN `3333`

## Files
- `index.html` - app shell
- `styles.css` - responsive PMS interface
- `app.js` - frontend state, booking logic, reports, exports, and sync
- `apps-script/Code.gs` - Google Apps Script backend
- `apps-script/SETUP.md` - cloud database deployment guide

## Local Use
Open `index.html` in a browser. Without an Apps Script URL, the app runs in local demo mode using `localStorage`.

## Cloud Setup
Deploy `apps-script/Code.gs` as a Google Apps Script web app, then set the deployed `/exec` URL in `app.js`:

```js
const API_BASE = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
```

The Apps Script backend uses Google Sheets as the cloud database and `LockService` to prevent overlapping confirmed/hold/checked-in/blocked bookings during simultaneous agent writes.

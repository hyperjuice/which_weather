# Which Weather — Project Context

This file gives Claude Code full context on the Which Weather project so any new session can pick up exactly where the last one left off. Update this file at the end of each session.

---

## What This App Is

A web app that compares live weather between two cities side by side. Uses the **Open-Meteo API** (free, no API key needed). Weather API calls are client-side (browser → open-meteo.com). Now includes a Node.js/Express backend for email subscriptions and scheduled weather update emails via SendGrid.

**Main file:** `/Users/hyperjuice/claude_code/which_weather/index.html`  
**Size:** \~1110 lines of code  
**Backend:** `server/server.js` — Express + SendGrid + node-cron  
**Other file:** `Dockerfile` (Node.js/nginx hybrid, for Render deployment)

---

## Architecture

- Single `index.html` with inline `<style>` and `<script>` blocks  
- Backend: `server/server.js` — Node.js/Express; handles `POST /api/subscribe`, serves `index.html` as static, runs scheduled cron jobs  
- Email: SendGrid (`@sendgrid/mail`); requires `SENDGRID_API_KEY` and `FROM_EMAIL` env vars on Render  
- Scheduling: `node-cron` for daily 9am ET and nightly 8pm ET sends  
- Subscriptions stored in `/data/subscriptions.json` (persistent disk on Render)  
- Weather data: Open-Meteo Weather API ([https://api.open-meteo.com](https://api.open-meteo.com))  
- Geocoding: Open-Meteo Geocoding API ([https://geocoding-api.open-meteo.com](https://geocoding-api.open-meteo.com)) filtered to US for city search  
- Air quality: Open-Meteo Air Quality API ([https://air-quality-api.open-meteo.com](https://air-quality-api.open-meteo.com))  
- Deployment: Docker \+ Node.js on Render (port 3000)

---

## Current Features

### U.S. Cities Section (left panel)

- Two city tiles, each with a search box \+ autocomplete backed by Open-Meteo geocoding API  
- Each tile shows: temperature, feels-like, humidity, wind speed, cloud cover, weather icon (WMO codes, day/night aware), local time (live ticking, 24-hour format), AQI (color-coded), population  
- Stats laid out in a 3x2 grid: Feels Like, Humidity, Wind, Cloud Cover, AQI, Population  
- Temperature difference bar at the bottom showing which city is warmer and by how much  
- Local time ticks every second using the timezone returned by the Open-Meteo API

### World Capitals Section (right panel)

- Two capital tiles, each with a dropdown listing all \~195 countries in "Country — Capital" format  
- Same weather stats as U.S. tiles, including city population (not country name) as a stat  
- Default left: United States (Washington D.C.)  
- Default right: Australia (Canberra)  
- Has its own temperature difference bar

### Layout

- U.S. Cities and World Capitals sections sit side by side with a vertical divider  
- Each section labeled at the top ("U.S. Cities" / "World Capitals")  
- Cards are compact — reduced padding, tight font sizes, smaller gaps  
- Responsive: falls back to stacked layout on screens narrower than 600px

### Header

- Page header reads: "Compare any two U.S. cities or any two country capitals"

### AQI Color Scale

- Good → Green  
- Moderate → Yellow  
- Sensitive → Orange  
- Unhealthy → Red  
- Very Unhealthy → Purple  
- Hazardous → Dark Red

---

## Deployment

A Dockerfile exists in the project root using Node.js to run the backend server, which also serves `index.html`. To deploy on Render:

1. Create a new Web Service, connect the repo  
2. Set Environment to Docker  
3. Render builds and runs the container on port 3000  
4. Set environment variables: `SENDGRID_API_KEY`, `FROM_EMAIL`  
5. Add a Render Persistent Disk mounted at `/data` for subscription storage

---

## Key Decisions & Notes

- Open-Meteo was chosen because it's completely free with no API key required  
- Population for searched cities comes from the geocoding API response; default city populations are hardcoded  
- Military (24-hour) time was explicitly requested  
- The "Country" stat in world capital tiles was replaced with city-proper population  
- Cards were deliberately made compact so the 4-tile side-by-side layout works at narrower widths (600px breakpoint)  
- Israel was originally the default right capital, then switched to Australia

---

## What Was Last Worked On

Email subscription feature (May 20 session):
- Added email subscription widget to `index.html` — email input, frequency dropdown (Daily 9am ET / Nightly 8pm ET), subscribe button with success/error states
- Created `server/` backend: Node.js/Express server using SendGrid for email delivery and node-cron for scheduled sends; subscriptions persisted to `/data/subscriptions.json`
- Updated `Dockerfile` from nginx-based static serving to Node.js (`node:18-alpine`), now runs `server.js` on port 3000 and serves `index.html` as a static file

---

## Session History

| Date | What Happened |
|------|---------------|
| May 9, 2026 | Initial commit — basic two-city weather comparison app; added nginx Dockerfile for Render |
| May 10, 2026 | Added World Capitals section (right panel) with country dropdown; side-by-side layout tweaks; title change; population stat added to both US and capital tiles |
| May 19, 2026 | Added this CLAUDE.md project context file |
| May 20, 2026 | Added email subscription UI to index.html; built Node.js/Express backend (`server/`) with SendGrid + node-cron for scheduled weather emails; updated Dockerfile to Node.js |

---

## Next Steps / To Do

*(Update this section at the end of each session)*

- [ ] Deploy updated Dockerfile to Render (now Node.js instead of nginx — set SENDGRID_API_KEY and FROM_EMAIL env vars)
- [ ] Test subscription flow end-to-end

---

## How to Run Locally

cd /Users/hyperjuice/claude\_code/which\_weather

python3 \-m http.server 8888

\# Then open http://localhost:8888 in browser

Or via Docker:

docker build \-t which-weather .

docker run \-p 8080:80 which-weather

---

*Last updated: May 20, 2026, based on 11 Claude Code sessions. Update this file at the end of each session by asking: "Update CLAUDE.md with everything we did today."*  

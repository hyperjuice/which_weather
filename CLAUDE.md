# Which Weather — Project Context

This file gives Claude Code full context on the Which Weather project so any new session can pick up exactly where the last one left off. Update this file at the end of each session.

---

## What This App Is

A single-file web app (`index.html`) that compares live weather between two cities side by side. Uses the **Open-Meteo API** (free, no API key needed). All API calls are made client-side (browser → open-meteo.com). No build step, no framework, no dependencies — pure vanilla HTML/CSS/JS.

**Main file:** `/Users/hyperjuice/claude_code/which_weather/index.html`  
**Size:** \~947 lines of code  
**Other file:** `Dockerfile` (nginx-based, for Render deployment)

---

## Architecture

- Single `index.html` with inline `<style>` and `<script>` blocks  
- No backend, no API keys, no build tools  
- Weather data: Open-Meteo Weather API ([https://api.open-meteo.com](https://api.open-meteo.com))  
- Geocoding: Open-Meteo Geocoding API ([https://geocoding-api.open-meteo.com](https://geocoding-api.open-meteo.com)) filtered to US for city search  
- Air quality: Open-Meteo Air Quality API ([https://air-quality-api.open-meteo.com](https://air-quality-api.open-meteo.com))  
- Deployment: Docker \+ nginx on Render (static app, no build step needed)

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

A Dockerfile exists in the project root using nginx to serve the static file. To deploy on Render:

1. Create a new Web Service, connect the repo  
2. Set Environment to Docker  
3. Render builds and runs the container on port 80  
4. No environment variables needed — all API calls go to open-meteo.com from the browser

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

Population was added to world capital tiles (replacing the "Country" stat). Before that, the Dockerfile was created for Render deployment.

---

## Next Steps / To Do

*(Update this section at the end of each session)*

- [ ] Add automation (next focus)

---

## How to Run Locally

cd /Users/hyperjuice/claude\_code/which\_weather

python3 \-m http.server 8888

\# Then open http://localhost:8888 in browser

Or via Docker:

docker build \-t which-weather .

docker run \-p 8080:80 which-weather

---

*Last updated: May 2026, based on 9 Claude Code sessions. Update this file at the end of each session by asking: "Update CLAUDE.md with everything we did today."*  

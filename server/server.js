'use strict';
const express = require('express');
const cron    = require('node-cron');
const sgMail  = require('@sendgrid/mail');
const fs      = require('fs');
const path    = require('path');

const PORT      = process.env.PORT      || 3000;
const FROM_EMAIL = process.env.FROM_EMAIL || '';
const DATA_FILE  = process.env.DATA_FILE  || '/data/subscriptions.json';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// ── Subscription storage ───────────────────────────────────────────────────

function loadSubs() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}

function saveSubs(subs) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(subs, null, 2));
}

// ── Express ────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/subscribe', (req, res) => {
  const { email, frequency, city1, city2 } = req.body;
  if (!email || !frequency || !city1 || !city2) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (!['daily_9am', 'nightly_8pm'].includes(frequency)) {
    return res.status(400).json({ error: 'Invalid frequency' });
  }
  const subs = loadSubs();
  const filtered = subs.filter(s => !(s.email === email && s.frequency === frequency));
  filtered.push({
    email, frequency,
    city1: { name: city1.name, state: city1.state, lat: city1.lat, lon: city1.lon },
    city2: { name: city2.name, state: city2.state, lat: city2.lat, lon: city2.lon },
    createdAt: new Date().toISOString(),
  });
  saveSubs(filtered);
  res.json({ ok: true });
});

app.delete('/api/unsubscribe', (req, res) => {
  const { email, frequency } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });
  const subs = loadSubs();
  const filtered = frequency
    ? subs.filter(s => !(s.email === email && s.frequency === frequency))
    : subs.filter(s => s.email !== email);
  saveSubs(filtered);
  res.json({ ok: true });
});

// ── Weather fetching ───────────────────────────────────────────────────────

const WMO_LABELS = {
  0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
  45:'Foggy',48:'Icy fog',
  51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',
  61:'Light rain',63:'Rain',65:'Heavy rain',
  71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',
  80:'Light showers',81:'Showers',82:'Heavy showers',
  85:'Snow showers',86:'Heavy snow showers',
  95:'Thunderstorm',96:'Thunderstorm w/ hail',99:'Thunderstorm w/ hail',
};

function aqiInfo(aqi) {
  if (aqi == null)  return { label: 'N/A',             color: '#94a3b8' };
  if (aqi <= 50)    return { label: 'Good',             color: '#22c55e' };
  if (aqi <= 100)   return { label: 'Moderate',         color: '#eab308' };
  if (aqi <= 150)   return { label: 'Sensitive Groups', color: '#f97316' };
  if (aqi <= 200)   return { label: 'Unhealthy',        color: '#ef4444' };
  if (aqi <= 300)   return { label: 'Very Unhealthy',   color: '#a855f7' };
  return                   { label: 'Hazardous',        color: '#fca5a5' };
}

async function fetchWeatherForCity(city) {
  const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weathercode,cloud_cover,is_day` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
  const aUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.lat}&longitude=${city.lon}&current=us_aqi&timezone=auto`;

  const [wRes, aRes] = await Promise.all([fetch(wUrl), fetch(aUrl)]);
  const data = await wRes.json();
  const c = data.current;

  let aqi = null;
  try {
    if (aRes.ok) { const ad = await aRes.json(); aqi = ad.current.us_aqi; }
  } catch {}

  return {
    temp:      Math.round(c.temperature_2m),
    feels:     Math.round(c.apparent_temperature),
    humidity:  c.relative_humidity_2m,
    wind:      Math.round(c.wind_speed_10m),
    cloud:     c.cloud_cover,
    condition: WMO_LABELS[c.weathercode] || 'Unknown',
    aqi,
  };
}

// ── Email builder ──────────────────────────────────────────────────────────

function cityCell(city, w) {
  const name = city.state ? `${city.name}, ${city.state}` : city.name;
  const { label: aqiLabel, color: aqiColor } = aqiInfo(w.aqi);
  const aqiStr = w.aqi != null ? `${w.aqi} — ${aqiLabel}` : aqiLabel;
  return `
    <td width="50%" style="padding:0 8px;vertical-align:top;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
        <tr><td style="padding:18px 16px;text-align:center;">
          <div style="font-size:13px;font-weight:600;color:#475569;margin-bottom:6px;">${name}</div>
          <div style="font-size:40px;font-weight:700;color:#0f172a;line-height:1;">${w.temp}°F</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;margin-bottom:14px;">${w.condition}</div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:5px 4px;border-top:1px solid #f1f5f9;text-align:center;">
                <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;">Feels Like</div>
                <div style="font-size:13px;font-weight:600;color:#334155;">${w.feels}°F</div>
              </td>
              <td style="padding:5px 4px;border-top:1px solid #f1f5f9;text-align:center;">
                <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;">Humidity</div>
                <div style="font-size:13px;font-weight:600;color:#334155;">${w.humidity}%</div>
              </td>
            </tr>
            <tr>
              <td style="padding:5px 4px;border-top:1px solid #f1f5f9;text-align:center;">
                <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;">Wind</div>
                <div style="font-size:13px;font-weight:600;color:#334155;">${w.wind} mph</div>
              </td>
              <td style="padding:5px 4px;border-top:1px solid #f1f5f9;text-align:center;">
                <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;">Cloud Cover</div>
                <div style="font-size:13px;font-weight:600;color:#334155;">${w.cloud}%</div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding:5px 4px;border-top:1px solid #f1f5f9;text-align:center;">
                <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;">Air Quality</div>
                <div style="font-size:13px;font-weight:600;color:${aqiColor};">${aqiStr}</div>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td>`;
}

function buildEmailHtml(sub, w1, w2, timeLabel) {
  const n1 = sub.city1.state ? `${sub.city1.name}, ${sub.city1.state}` : sub.city1.name;
  const n2 = sub.city2.state ? `${sub.city2.name}, ${sub.city2.state}` : sub.city2.name;
  const diff = Math.abs(w1.temp - w2.temp).toFixed(1);
  let diffLine;
  if (parseFloat(diff) < 0.5) diffLine = 'Nearly identical temperatures';
  else if (w1.temp > w2.temp) diffLine = `${n1} is ${diff}°F warmer`;
  else                         diffLine = `${n2} is ${diff}°F warmer`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:22px 28px;text-align:center;">
        <div style="font-size:20px;font-weight:700;color:#60a5fa;">Which Weather?</div>
        <div style="font-size:12px;color:#64748b;margin-top:5px;">${timeLabel}</div>
      </td></tr>

      <tr><td style="background:#ffffff;padding:20px 16px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            ${cityCell(sub.city1, w1)}
            ${cityCell(sub.city2, w2)}
          </tr>
        </table>
      </td></tr>

      <tr><td style="background:#ffffff;padding:16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Temperature Difference</div>
            <div style="font-size:17px;font-weight:700;color:#f97316;">${diffLine}</div>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:14px 24px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#94a3b8;">
          You're receiving this because you subscribed at Which Weather.<br>
          Weather data from <a href="https://open-meteo.com" style="color:#60a5fa;text-decoration:none;">Open-Meteo</a>.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── Cron jobs ──────────────────────────────────────────────────────────────

async function sendForFrequency(frequency, timeLabel) {
  if (!process.env.SENDGRID_API_KEY || !FROM_EMAIL) {
    console.warn(`Skipping ${timeLabel} send: SENDGRID_API_KEY or FROM_EMAIL not set`);
    return;
  }
  const subs = loadSubs().filter(s => s.frequency === frequency);
  console.log(`[${new Date().toISOString()}] Sending ${timeLabel} to ${subs.length} subscribers`);
  for (const sub of subs) {
    try {
      const [w1, w2] = await Promise.all([
        fetchWeatherForCity(sub.city1),
        fetchWeatherForCity(sub.city2),
      ]);
      await sgMail.send({
        to:      sub.email,
        from:    FROM_EMAIL,
        subject: `Which Weather: ${timeLabel} — ${sub.city1.name} vs ${sub.city2.name}`,
        html:    buildEmailHtml(sub, w1, w2, timeLabel),
      });
      console.log(`  Sent to ${sub.email}`);
    } catch (err) {
      console.error(`  Failed for ${sub.email}:`, err.message);
    }
  }
}

// 9am ET daily
cron.schedule('0 9 * * *', () => sendForFrequency('daily_9am', 'Morning Report — 9am ET'), {
  timezone: 'America/New_York',
});

// 8pm ET nightly
cron.schedule('0 20 * * *', () => sendForFrequency('nightly_8pm', 'Evening Report — 8pm ET'), {
  timezone: 'America/New_York',
});

app.listen(PORT, () => {
  console.log(`Which Weather server running on port ${PORT}`);
  console.log(`Subscriptions stored at: ${DATA_FILE}`);
  if (!process.env.SENDGRID_API_KEY) console.warn('  Warning: SENDGRID_API_KEY not set — email sends will be skipped');
  if (!FROM_EMAIL)                   console.warn('  Warning: FROM_EMAIL not set — email sends will be skipped');
});

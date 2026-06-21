const fetch = require('node-fetch');

function aqiCategory(aqi) {
  if (aqi <= 50) return { label: 'Good', color: '#22c55e' };
  if (aqi <= 100) return { label: 'Moderate', color: '#eab308' };
  if (aqi <= 150) return { label: 'Unhealthy (Sensitive Groups)', color: '#f97316' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#ef4444' };
  if (aqi <= 300) return { label: 'Very Unhealthy', color: '#a855f7' };
  return { label: 'Hazardous', color: '#7f1d1d' };
}

async function fetchAQI(lat, lon) {
  const base = process.env.AQI_API_BASE || 'https://air-quality-api.open-meteo.com/v1/air-quality';
  const url = `${base}?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('AQI service unavailable');
  const data = await res.json();
  const c = data.current || {};
  const aqi = Math.round(c.us_aqi ?? 0);
  return {
    aqi,
    pm25: c.pm2_5,
    pm10: c.pm10,
    co: c.carbon_monoxide,
    no2: c.nitrogen_dioxide,
    ozone: c.ozone,
    ...aqiCategory(aqi),
    fetched_at: new Date().toISOString(),
  };
}

module.exports = { fetchAQI, aqiCategory };

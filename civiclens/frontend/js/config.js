// Change API_BASE to your deployed backend URL in production
// e.g. "https://nagrik360-api.onrender.com/api"
const CONFIG = {
  API_BASE: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : '/api', // change to your deployed backend URL, e.g. https://your-backend.onrender.com/api
};

const CATEGORIES = [
  { id: 'littering_dumping', label: 'Littering / Dumping', emoji: '🗑️' },
  { id: 'spitting_public', label: 'Public Spitting', emoji: '🚫' },
  { id: 'pothole', label: 'Pothole', emoji: '🕳️' },
  { id: 'dust_pollution', label: 'Road Dust', emoji: '💨' },
  { id: 'bad_aqi', label: 'Bad AQI', emoji: '🌫️' },
  { id: 'open_burning_waste', label: 'Open Burning', emoji: '🔥' },
  { id: 'tree_cutting_illegal', label: 'Illegal Tree Cutting', emoji: '🌳' },
  { id: 'vehicle_smoke_emission', label: 'Vehicle Smoke', emoji: '🚛' },
  { id: 'sewage_overflow', label: 'Sewage Overflow', emoji: '🚱' },
  { id: 'water_leakage', label: 'Water Leakage', emoji: '💧' },
  { id: 'broken_streetlight', label: 'Broken Streetlight', emoji: '💡' },
  { id: 'noise_pollution', label: 'Noise Pollution', emoji: '🔊' },
  { id: 'stray_animal_hazard', label: 'Stray Animal Hazard', emoji: '🐕' },
  { id: 'illegal_construction', label: 'Illegal Construction', emoji: '🏗️' },
  { id: 'other', label: 'Other', emoji: '⚠️' },
];

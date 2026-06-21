const API = {
  token: localStorage.getItem('nagrik360_token') || null,

  headers(json = true) {
    const h = {};
    if (json) h['Content-Type'] = 'application/json';
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  },

  async signup(name, email, password) {
    const res = await fetch(`${CONFIG.API_BASE}/auth/signup`, {
      method: 'POST', headers: this.headers(), body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');
    this.token = data.token; localStorage.setItem('nagrik360_token', data.token);
    localStorage.setItem('nagrik360_user', JSON.stringify(data.user));
    return data;
  },

  async login(email, password) {
    const res = await fetch(`${CONFIG.API_BASE}/auth/login`, {
      method: 'POST', headers: this.headers(), body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    this.token = data.token; localStorage.setItem('nagrik360_token', data.token);
    localStorage.setItem('nagrik360_user', JSON.stringify(data.user));
    return data;
  },

  async submitReport(formData) {
    const res = await fetch(`${CONFIG.API_BASE}/reports`, {
      method: 'POST',
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Submit failed');
    return data;
  },

  async listReports(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${CONFIG.API_BASE}/reports?${qs}`);
    return res.json();
  },

  async upvote(id, fingerprint) {
    const res = await fetch(`${CONFIG.API_BASE}/reports/${id}/upvote`, {
      method: 'POST', headers: this.headers(), body: JSON.stringify({ fingerprint }),
    });
    return res.json();
  },

  async reportToGov(id, complaintText) {
    const res = await fetch(`${CONFIG.API_BASE}/reports/${id}/report-to-gov`, {
      method: 'POST', headers: this.headers(), body: JSON.stringify({ complaint_text: complaintText }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not send to government');
    return data;
  },

  async stats() {
    const res = await fetch(`${CONFIG.API_BASE}/reports/stats/summary`);
    return res.json();
  },

  async getAQI(lat, lon) {
    const res = await fetch(`${CONFIG.API_BASE}/ai/aqi?lat=${lat}&lon=${lon}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'AQI fetch failed');
    return data;
  },

  async chat(messages) {
    const res = await fetch(`${CONFIG.API_BASE}/ai/chat`, {
      method: 'POST', headers: this.headers(), body: JSON.stringify({ messages }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Chat failed');
    return data;
  },

  async leaderboard() {
    const res = await fetch(`${CONFIG.API_BASE}/auth/leaderboard`);
    return res.json();
  },
};

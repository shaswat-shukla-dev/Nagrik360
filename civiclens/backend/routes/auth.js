const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const { getDB } = require('../db');

const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const db = await getDB();
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });

    const existing = await db.get('SELECT id FROM users WHERE email = ?', email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const id = uuid();
    await db.run('INSERT INTO users (id, name, email, password_hash) VALUES (?,?,?,?)', id, name, email, hash);

    const token = jwt.sign({ id, email }, process.env.JWT_SECRET || 'dev_secret', {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
    res.status(201).json({ token, user: { id, name, email, points: 0, badge: 'Newcomer' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const db = await getDB();
    const { email, password } = req.body;
    const user = await db.get('SELECT * FROM users WHERE email = ?', email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'dev_secret', {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
    delete user.password_hash;
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Leaderboard (gamification: points for verified reports) ----
router.get('/leaderboard', async (req, res) => {
  const db = await getDB();
  const users = await db.all('SELECT id, name, points, badge FROM users ORDER BY points DESC LIMIT 20');
  res.json({ leaderboard: users });
});

module.exports = router;

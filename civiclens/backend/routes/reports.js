const express = require('express');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const { getDB } = require('../db');
const { analyzeReport } = require('../utils/groqClient');
const { sendGovReport } = require('../utils/mailer');
const { uploadToR2 } = require('../utils/s3');

const router = express.Router();

// ---- Multer: keep files in memory so we can stream straight to R2.
//     No files ever touch the server disk — required for Render (ephemeral filesystem). ----
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (Number(process.env.MAX_FILE_SIZE_MB) || 8) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// ---- POST /api/reports — submit a new civic report ----
router.post(
  '/',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'verification_image', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const db = await getDB();
      const { category, description, latitude, longitude, address, user_id } = req.body;

      if (!category) return res.status(400).json({ error: 'category is required' });

      // Upload photos to Cloudflare R2; get back permanent public URLs.
      const imagePath = req.files?.image?.[0]
        ? await uploadToR2(req.files.image[0], 'reports')
        : null;
      const verificationPath = req.files?.verification_image?.[0]
        ? await uploadToR2(req.files.verification_image[0], 'reports/verification')
        : null;

      // ---- AI analysis via Groq ----
      let ai = {};
      try {
        ai = await analyzeReport({ category, description, latitude, longitude, hasImage: !!imagePath });
      } catch (e) {
        // AI failure must never block the report from being saved.
        ai = {
          severity: 'medium',
          confidence: 0.4,
          is_plausible: true,
          summary: description || category,
          health_impact: [],
          solutions: [],
          suggested_department: 'Municipal Corporation',
          gov_complaint_text: description || '',
          social_caption: '',
          ai_error: e.message,
        };
      }

      const id = uuid();
      await db.run(
        `INSERT INTO reports
          (id, user_id, category, description, image_path, image_path_verification,
           latitude, longitude, address, severity, ai_summary, ai_health_impact, ai_solutions,
           ai_verified, ai_confidence, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id,
          user_id || null,
          category,
          description || null,
          imagePath,
          verificationPath,
          latitude || null,
          longitude || null,
          address || null,
          ai.severity || 'medium',
          ai.summary || '',
          JSON.stringify(ai.health_impact || []),
          JSON.stringify(ai.solutions || []),
          ai.is_plausible ? 1 : 0,
          ai.confidence || 0.5,
          'submitted',
        ]
      );

      const report = await db.get('SELECT * FROM reports WHERE id = ?', id);
      res.status(201).json({ report, ai });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ---- GET /api/reports — list / filter reports ----
router.get('/', async (req, res) => {
  try {
    const db = await getDB();
    const { category, status, severity, near_lat, near_lon, radius_km, limit = 50 } = req.query;

    let query = 'SELECT * FROM reports WHERE 1=1';
    const params = [];

    if (category) { query += ' AND category = ?'; params.push(category); }
    if (status)   { query += ' AND status = ?';   params.push(status); }
    if (severity) { query += ' AND severity = ?'; params.push(severity); }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(Number(limit));

    let reports = await db.all(query, params);

    // Optional proximity filter (Haversine, done in JS since PostGIS not required at this scale)
    if (near_lat && near_lon) {
      const R = Number(radius_km) || 5;
      reports = reports.filter((r) => {
        if (!r.latitude || !r.longitude) return false;
        return haversine(Number(near_lat), Number(near_lon), r.latitude, r.longitude) <= R;
      });
    }

    res.json({ count: reports.length, reports });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- GET /api/reports/stats/summary — dashboard counters ----
router.get('/stats/summary', async (req, res) => {
  const db = await getDB();
  const total      = await db.get("SELECT COUNT(*) as c FROM reports");
  const byCategory = await db.all("SELECT category, COUNT(*) as count FROM reports GROUP BY category ORDER BY count DESC");
  const bySeverity = await db.all("SELECT severity, COUNT(*) as count FROM reports GROUP BY severity");
  const resolved   = await db.get("SELECT COUNT(*) as c FROM reports WHERE status = 'resolved'");
  const forwarded  = await db.get("SELECT COUNT(*) as c FROM reports WHERE reported_to_gov = 1");
  res.json({
    total: total.c,
    resolved: resolved.c,
    forwarded_to_gov: forwarded.c,
    by_category: byCategory,
    by_severity: bySeverity,
  });
});

// ---- GET /api/reports/:id — single report with comments ----
router.get('/:id', async (req, res) => {
  const db = await getDB();
  const report = await db.get('SELECT * FROM reports WHERE id = ?', req.params.id);
  if (!report) return res.status(404).json({ error: 'Not found' });
  const comments = await db.all(
    'SELECT * FROM report_comments WHERE report_id = ? ORDER BY created_at DESC',
    req.params.id
  );
  res.json({ report, comments });
});

// ---- POST /api/reports/:id/upvote — community confirm ----
router.post('/:id/upvote', async (req, res) => {
  try {
    const db = await getDB();
    const fingerprint = req.body.fingerprint || req.ip;
    await db.run(
      'INSERT INTO report_votes (id, report_id, user_fingerprint) VALUES (?,?,?) ON CONFLICT DO NOTHING',
      uuid(), req.params.id, fingerprint
    );
    await db.run(
      'UPDATE reports SET upvotes = (SELECT COUNT(*) FROM report_votes WHERE report_id = ?) WHERE id = ?',
      req.params.id, req.params.id
    );
    const report = await db.get('SELECT * FROM reports WHERE id = ?', req.params.id);
    res.json({ report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- POST /api/reports/:id/comments — add a comment ----
router.post('/:id/comments', async (req, res) => {
  const db = await getDB();
  const { author, comment } = req.body;
  if (!comment) return res.status(400).json({ error: 'comment required' });
  const id = uuid();
  await db.run(
    'INSERT INTO report_comments (id, report_id, author, comment) VALUES (?,?,?,?)',
    id, req.params.id, author || 'Anonymous', comment
  );
  const comments = await db.all(
    'SELECT * FROM report_comments WHERE report_id = ? ORDER BY created_at DESC',
    req.params.id
  );
  res.status(201).json({ comments });
});

// ---- POST /api/reports/:id/report-to-gov — email the grievance cell ----
router.post('/:id/report-to-gov', async (req, res) => {
  try {
    const db = await getDB();
    const report = await db.get('SELECT * FROM reports WHERE id = ?', req.params.id);
    if (!report) return res.status(404).json({ error: 'Not found' });

    const complaintText = req.body.complaint_text || report.ai_summary || report.description || '';
    const result = await sendGovReport({ report, complaintText });

    await db.run(
      `UPDATE reports
       SET reported_to_gov = 1, gov_ref_id = ?, status = 'forwarded_to_authorities', updated_at = NOW()
       WHERE id = ?`,
      result.refId, req.params.id
    );

    const updated = await db.get('SELECT * FROM reports WHERE id = ?', req.params.id);
    res.json({ report: updated, gov_result: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- PATCH /api/reports/:id/status — update status (admin/officer) ----
router.patch('/:id/status', async (req, res) => {
  const db = await getDB();
  const { status } = req.body;
  const allowed = ['submitted', 'forwarded_to_authorities', 'in_progress', 'resolved', 'rejected'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'invalid status' });
  await db.run(
    'UPDATE reports SET status = ?, updated_at = NOW() WHERE id = ?',
    status, req.params.id
  );
  const report = await db.get('SELECT * FROM reports WHERE id = ?', req.params.id);
  res.json({ report });
});

// ---- Haversine distance (km) — used for proximity filtering ----
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = router;

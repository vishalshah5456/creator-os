const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { randomUUID } = require('crypto');
require('dotenv').config();

const db = require('./database/db');
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

const productionOrigins = [
  'https://creatorcrm.online',
  'https://www.creatorcrm.online',
  'https://app.creatorcrm.online',
  'https://creator-os-frontend.onrender.com',
];
const developmentOrigins = ['http://localhost:3000', 'http://localhost:5173'];
const allowedOrigins = (process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
  : process.env.NODE_ENV === 'production'
    ? productionOrigins
    : [...productionOrigins, ...developmentOrigins]);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));
app.use(express.json({ limit: '100kb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

const DEAL_STAGES = new Set(['outreach', 'negotiation', 'contract', 'delivered', 'paid']);
const DEAL_STATUSES = new Set(['lead', 'active', 'completed', 'cancelled']);
const CONTENT_STATUSES = new Set(['draft', 'scheduled', 'published']);
const CONTENT_TYPES = new Set(['post', 'story', 'reel', 'video', 'carousel', 'blog_post']);
const PLATFORMS = new Set(['instagram', 'youtube', 'tiktok', 'twitter', 'facebook', 'linkedin', 'blog', 'other']);
const INCOME_STATUSES = new Set(['received', 'pending']);
const INCOME_CATEGORIES = new Set(['brand_deal', 'affiliate', 'ad_revenue', 'product', 'consulting', 'other']);
const MAX_PLATFORMS = 10;
const MAX_DELIVERABLES = 25;
const MAX_SERVICES = 50;
const MAX_PRICING_TIERS = 50;

function cleanString(value, max = 500) {
  if (value === undefined || value === null) return undefined;
  const cleaned = String(value).trim();
  return cleaned.slice(0, max);
}

function cleanOptionalString(value, max = 500) {
  const cleaned = cleanString(value, max);
  return cleaned === '' ? null : cleaned;
}

function cleanNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1000000000) return null;
  return number;
}

function cleanCurrency(value) {
  const currency = cleanString(value || 'USD', 3).toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

function cleanDate(value) {
  if (!value) return null;
  const date = cleanString(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : date;
}

function requireValid(condition, message, errors) {
  if (!condition) errors.push(message);
}

function sendValidation(res, errors) {
  return res.status(400).json({ error: errors.join(' ') });
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function validateIdParam(req, res, next) {
  if (!isUuid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid resource id' });
  }
  next();
}

function auditEvent(req, action, entity, entityId, metadata = {}) {
  db.run(
    `INSERT INTO audit_events (id, user_id, action, entity, entity_id, metadata, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      req.userId || null,
      action,
      entity,
      entityId || null,
      JSON.stringify(metadata),
      req.ip,
      req.get('user-agent') || null,
    ],
    () => {}
  );
}

function getUser(req, res) {
  const authUser = req.authUser;
  const metadata = authUser?.user_metadata || {};
  const email = authUser?.email;
  const name = cleanString(metadata.name || metadata.full_name || email?.split('@')[0] || 'Creator', 120);
  const handle = cleanString(metadata.handle || metadata.preferred_username || email?.split('@')[0] || 'creator', 80);
  const avatar = cleanOptionalString(metadata.avatar_url || metadata.picture, 500);

  db.run(
    `INSERT INTO users (id, auth_id, email, name, handle, avatar, has_password)
     VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT has_password FROM users WHERE id = ?), FALSE))
     ON CONFLICT (id) DO UPDATE SET
       auth_id = COALESCE(users.auth_id, EXCLUDED.auth_id),
       email = EXCLUDED.email,
       name = COALESCE(users.name, EXCLUDED.name),
       handle = COALESCE(users.handle, EXCLUDED.handle),
       avatar = COALESCE(users.avatar, EXCLUDED.avatar)`,
    [req.userId, authUser.id, email, name, handle, avatar, req.userId],
    (err) => {
      if (err) return res.status(500).json({ error: 'Unable to load user profile' });

      db.get(
        'SELECT id, email, name, handle, avatar, bio, niche, followers, platforms, has_password FROM users WHERE id = ?',
        [req.userId],
        (userErr, user) => {
          if (userErr || !user) return res.status(404).json({ error: 'User not found' });
          user.platforms = parseJson(user.platforms, []);
          res.json(user);
        }
      );
    }
  );
}

app.post('/api/auth/password-set', authMiddleware, (req, res) => {
  db.run('UPDATE users SET has_password = TRUE WHERE id = ?', [req.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Unable to update password state' });
    auditEvent(req, 'password_set', 'user', req.userId);
    res.json({ updated: this.changes });
  });
});

app.get('/api/auth/me', authMiddleware, getUser);

app.put('/api/profile', authMiddleware, (req, res) => {
  const errors = [];
  const name = cleanString(req.body.name, 120);
  const handle = cleanString(req.body.handle, 80);
  const bio = cleanOptionalString(req.body.bio, 1000);
  const niche = cleanOptionalString(req.body.niche, 120);
  const followers = cleanNumber(req.body.followers, 0);
  const platforms = Array.isArray(req.body.platforms)
    ? req.body.platforms.filter(platform => PLATFORMS.has(platform)).slice(0, MAX_PLATFORMS)
    : [];

  requireValid(Boolean(name), 'Name is required.', errors);
  requireValid(Boolean(handle), 'Creator handle is required.', errors);
  requireValid(followers !== null, 'Followers must be a valid number.', errors);

  if (errors.length) return sendValidation(res, errors);

  db.run(
    `UPDATE users
     SET name = ?, handle = ?, bio = ?, niche = ?, followers = ?, platforms = ?
     WHERE id = ?`,
    [name, handle, bio, niche, followers, JSON.stringify(platforms), req.userId],
    function(err) {
      if (err) return res.status(500).json({ error: 'Unable to update profile' });
      auditEvent(req, 'profile_update', 'user', req.userId);
      getUser(req, res);
    }
  );
});

app.post('/api/audit/export', authMiddleware, (req, res) => {
  const reportName = cleanString(req.body.report_name || 'report', 120);
  const scope = cleanString(req.body.scope || 'filtered', 30);
  const rowCount = cleanNumber(req.body.row_count, 0);
  const filters = req.body.filters && typeof req.body.filters === 'object' && !Array.isArray(req.body.filters)
    ? req.body.filters
    : {};

  auditEvent(req, 'export', 'report', reportName, {
    report_name: reportName,
    scope,
    row_count: rowCount,
    filters,
  });

  res.json({ logged: true });
});

app.get('/api/deals', authMiddleware, (req, res) => {
  db.all('SELECT * FROM deals WHERE user_id = ? ORDER BY created_at DESC', [req.userId], (err, deals) => {
    if (err) return res.status(500).json({ error: 'Unable to load deals' });
    deals = deals || [];
    deals.forEach(d => {
      d.deliverables = parseJson(d.deliverables, []);
      d.platforms = parseJson(d.platforms, []);
    });
    res.json(deals);
  });
});

app.post('/api/deals', authMiddleware, (req, res) => {
  const errors = [];
  const brandName = cleanString(req.body.brand_name, 120);
  const contactEmail = cleanOptionalString(req.body.contact_email, 254);
  const value = cleanNumber(req.body.value, 0);
  const currency = cleanCurrency(req.body.currency);
  const status = cleanString(req.body.status || 'lead', 30);
  const pipelineStage = cleanString(req.body.pipeline_stage || 'outreach', 30);
  const platforms = Array.isArray(req.body.platforms) ? req.body.platforms.filter(p => PLATFORMS.has(p)).slice(0, MAX_PLATFORMS) : [];
  const deliverables = Array.isArray(req.body.deliverables) ? req.body.deliverables.map(d => cleanString(d, 120)).filter(Boolean).slice(0, MAX_DELIVERABLES) : [];

  requireValid(Boolean(brandName), 'Brand name is required.', errors);
  requireValid(!contactEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail), 'Contact email is invalid.', errors);
  requireValid(value !== null, 'Deal value must be a positive number.', errors);
  requireValid(Boolean(currency), 'Currency must be a 3-letter code.', errors);
  requireValid(DEAL_STATUSES.has(status), 'Deal status is invalid.', errors);
  requireValid(DEAL_STAGES.has(pipelineStage), 'Pipeline stage is invalid.', errors);
  if (errors.length) return sendValidation(res, errors);

  const id = randomUUID();
  const payload = [
    id,
    req.userId,
    brandName,
    cleanOptionalString(req.body.brand_logo, 500),
    cleanOptionalString(req.body.contact_name, 120),
    contactEmail,
    value,
    currency,
    status,
    pipelineStage,
    cleanOptionalString(req.body.description, 2000),
    JSON.stringify(deliverables),
    cleanDate(req.body.start_date),
    cleanDate(req.body.end_date),
    cleanOptionalString(req.body.notes, 4000),
    JSON.stringify(platforms),
  ];

  db.run(
    `INSERT INTO deals (id, user_id, brand_name, brand_logo, contact_name, contact_email,
      value, currency, status, pipeline_stage, description, deliverables, start_date, end_date, notes, platforms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    payload,
    function(err) {
      if (err) return res.status(500).json({ error: 'Unable to create deal' });
      auditEvent(req, 'create', 'deal', id, { brandName, pipelineStage });

      if (pipelineStage === 'paid') {
        const incomeId = randomUUID();
        return db.run(
          `INSERT INTO income (id, user_id, source, amount, currency, date, deal_id, description, category, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [incomeId, req.userId, brandName, value, currency, new Date().toISOString().split('T')[0], id, 'Auto: Deal paid - ' + brandName, 'brand_deal', 'received'],
          function(incomeErr) {
            if (incomeErr) return res.status(500).json({ error: 'Deal created, but income sync failed' });
            auditEvent(req, 'create', 'income', incomeId, { linkedDealId: id });
            res.json({ id, user_id: req.userId, incomeCreated: true });
          }
        );
      }

      res.json({ id, user_id: req.userId });
    }
  );
});

app.put('/api/deals/:id', authMiddleware, validateIdParam, (req, res) => {
  db.get('SELECT * FROM deals WHERE id = ? AND user_id = ?', [req.params.id, req.userId], (err, currentDeal) => {
    if (err) return res.status(500).json({ error: 'Unable to load deal' });
    if (!currentDeal) return res.status(404).json({ error: 'Deal not found' });

    const errors = [];
    const brandName = req.body.brand_name !== undefined ? cleanString(req.body.brand_name, 120) : currentDeal.brand_name;
    const contactEmail = req.body.contact_email !== undefined ? cleanOptionalString(req.body.contact_email, 254) : currentDeal.contact_email;
    const value = req.body.value !== undefined ? cleanNumber(req.body.value, 0) : currentDeal.value;
    const currency = req.body.currency !== undefined ? cleanCurrency(req.body.currency) : currentDeal.currency;
    const nextStage = req.body.pipeline_stage !== undefined ? cleanString(req.body.pipeline_stage, 30) : currentDeal.pipeline_stage;
    const platforms = req.body.platforms !== undefined && Array.isArray(req.body.platforms)
      ? req.body.platforms.filter(p => PLATFORMS.has(p))
      : parseJson(currentDeal.platforms, []);
    const cappedPlatforms = Array.isArray(platforms) ? platforms.slice(0, MAX_PLATFORMS) : [];

    requireValid(Boolean(brandName), 'Brand name is required.', errors);
    requireValid(!contactEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail), 'Contact email is invalid.', errors);
    requireValid(value !== null, 'Deal value must be a positive number.', errors);
    requireValid(Boolean(currency), 'Currency must be a 3-letter code.', errors);
    requireValid(DEAL_STAGES.has(nextStage), 'Pipeline stage is invalid.', errors);
    if (errors.length) return sendValidation(res, errors);

    const wasPaid = currentDeal.pipeline_stage === 'paid';
    const isNowPaid = nextStage === 'paid';

    db.run(
      `UPDATE deals SET
        brand_name = ?, contact_email = ?, pipeline_stage = ?, value = ?, notes = ?,
        platforms = ?, description = ?, contact_name = ?, currency = ?,
        start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [
        brandName,
        contactEmail,
        nextStage,
        value,
        req.body.notes !== undefined ? cleanOptionalString(req.body.notes, 4000) : currentDeal.notes,
        JSON.stringify(cappedPlatforms),
        req.body.description !== undefined ? cleanOptionalString(req.body.description, 2000) : currentDeal.description,
        req.body.contact_name !== undefined ? cleanOptionalString(req.body.contact_name, 120) : currentDeal.contact_name,
        currency,
        req.body.start_date !== undefined ? cleanDate(req.body.start_date) : currentDeal.start_date,
        req.body.end_date !== undefined ? cleanDate(req.body.end_date) : currentDeal.end_date,
        req.params.id,
        req.userId,
      ],
      function(updateErr) {
        if (updateErr) return res.status(500).json({ error: 'Unable to update deal' });
        auditEvent(req, 'update', 'deal', req.params.id, { from: currentDeal.pipeline_stage, to: nextStage });

        if (isNowPaid) {
          return db.get('SELECT id FROM income WHERE deal_id = ? AND user_id = ? LIMIT 1', [req.params.id, req.userId], (incomeErr, income) => {
            if (incomeErr) return res.status(500).json({ error: 'Unable to sync linked income' });

            if (income) {
              return db.run(
                `UPDATE income SET source = ?, amount = ?, currency = ?, description = ?, category = ?, status = ?
                 WHERE id = ? AND user_id = ?`,
                [brandName, value, currency, 'Auto: Deal paid - ' + brandName, 'brand_deal', 'received', income.id, req.userId],
                function(syncErr) {
                  if (syncErr) return res.status(500).json({ error: 'Unable to update linked income' });
                  auditEvent(req, 'update', 'income', income.id, { linkedDealId: req.params.id });
                  res.json({ updated: this.changes, incomeUpdated: true });
                }
              );
            }

            const incomeId = randomUUID();
            db.run(
              `INSERT INTO income (id, user_id, source, amount, currency, date, deal_id, description, category, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [incomeId, req.userId, brandName, value, currency, new Date().toISOString().split('T')[0], req.params.id, 'Auto: Deal paid - ' + brandName, 'brand_deal', 'received'],
              function(createIncomeErr) {
                if (createIncomeErr) return res.status(500).json({ error: 'Unable to create linked income' });
                auditEvent(req, 'create', 'income', incomeId, { linkedDealId: req.params.id });
                res.json({ updated: this.changes, incomeCreated: true });
              }
            );
          });
        }

        if (wasPaid && !isNowPaid) {
          return db.run('DELETE FROM income WHERE deal_id = ? AND user_id = ?', [req.params.id, req.userId], function(deleteErr) {
            if (deleteErr) return res.status(500).json({ error: 'Unable to remove linked income' });
            auditEvent(req, 'delete', 'income', null, { linkedDealId: req.params.id });
            res.json({ updated: this.changes, incomeDeleted: true });
          });
        }

        res.json({ updated: this.changes });
      }
    );
  });
});

app.delete('/api/deals/:id', authMiddleware, validateIdParam, (req, res) => {
  db.run('DELETE FROM income WHERE deal_id = ? AND user_id = ?', [req.params.id, req.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Unable to delete linked income' });

    db.run('DELETE FROM deals WHERE id = ? AND user_id = ?', [req.params.id, req.userId], function(dealErr) {
      if (dealErr) return res.status(500).json({ error: 'Unable to delete deal' });
      auditEvent(req, 'delete', 'deal', req.params.id);
      res.json({ deleted: this.changes });
    });
  });
});

app.get('/api/content', authMiddleware, (req, res) => {
  db.all('SELECT * FROM content WHERE user_id = ? ORDER BY scheduled_date DESC', [req.userId], (err, content) => {
    if (err) return res.status(500).json({ error: 'Unable to load content' });
    content = content || [];
    content.forEach(c => {
      c.performance_metrics = parseJson(c.performance_metrics, {});
    });
    res.json(content);
  });
});

app.post('/api/content', authMiddleware, (req, res) => {
  const errors = [];
  const title = cleanString(req.body.title, 180);
  const platform = cleanString(req.body.platform, 40);
  const contentType = cleanString(req.body.content_type || 'post', 40);
  const status = cleanString(req.body.status || 'draft', 30);

  requireValid(Boolean(title), 'Title is required.', errors);
  requireValid(PLATFORMS.has(platform), 'Platform is invalid.', errors);
  requireValid(CONTENT_TYPES.has(contentType), 'Content type is invalid.', errors);
  requireValid(CONTENT_STATUSES.has(status), 'Content status is invalid.', errors);
  if (errors.length) return sendValidation(res, errors);

  const id = randomUUID();
  db.run(
    'INSERT INTO content (id, user_id, title, platform, content_type, status, scheduled_date, deal_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.userId, title, platform, contentType, status, cleanDate(req.body.scheduled_date), cleanOptionalString(req.body.deal_id, 80)],
    function(err) {
      if (err) return res.status(500).json({ error: 'Unable to create content' });
      auditEvent(req, 'create', 'content', id, { status });
      res.json({ id, user_id: req.userId });
    }
  );
});

app.put('/api/content/:id', authMiddleware, validateIdParam, (req, res) => {
  db.get('SELECT * FROM content WHERE id = ? AND user_id = ?', [req.params.id, req.userId], (err, currentContent) => {
    if (err) return res.status(500).json({ error: 'Unable to load content' });
    if (!currentContent) return res.status(404).json({ error: 'Content not found' });

    const errors = [];
    const title = req.body.title !== undefined ? cleanString(req.body.title, 180) : currentContent.title;
    const platform = req.body.platform !== undefined ? cleanString(req.body.platform, 40) : currentContent.platform;
    const contentType = req.body.content_type !== undefined ? cleanString(req.body.content_type, 40) : currentContent.content_type;
    const status = req.body.status !== undefined ? cleanString(req.body.status, 30) : currentContent.status;
    const publishedDate = req.body.published_date !== undefined
      ? cleanDate(req.body.published_date)
      : status === 'published' && !currentContent.published_date
        ? new Date().toISOString().split('T')[0]
        : currentContent.published_date;

    requireValid(Boolean(title), 'Title is required.', errors);
    requireValid(PLATFORMS.has(platform), 'Platform is invalid.', errors);
    requireValid(CONTENT_TYPES.has(contentType), 'Content type is invalid.', errors);
    requireValid(CONTENT_STATUSES.has(status), 'Content status is invalid.', errors);
    if (errors.length) return sendValidation(res, errors);

    db.run(
      `UPDATE content SET
        title = ?, platform = ?, content_type = ?, status = ?,
        scheduled_date = ?, published_date = ?, deal_id = ?
       WHERE id = ? AND user_id = ?`,
      [
        title,
        platform,
        contentType,
        status,
        req.body.scheduled_date !== undefined ? cleanDate(req.body.scheduled_date) : currentContent.scheduled_date,
        publishedDate,
        req.body.deal_id !== undefined ? cleanOptionalString(req.body.deal_id, 80) : currentContent.deal_id,
        req.params.id,
        req.userId,
      ],
      function(updateErr) {
        if (updateErr) return res.status(500).json({ error: 'Unable to update content' });
        auditEvent(req, 'update', 'content', req.params.id, { from: currentContent.status, to: status });
        res.json({ updated: this.changes });
      }
    );
  });
});

app.delete('/api/content/:id', authMiddleware, validateIdParam, (req, res) => {
  db.run('DELETE FROM content WHERE id = ? AND user_id = ?', [req.params.id, req.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Unable to delete content' });
    auditEvent(req, 'delete', 'content', req.params.id);
    res.json({ deleted: this.changes });
  });
});

app.get('/api/income', authMiddleware, (req, res) => {
  db.all('SELECT * FROM income WHERE user_id = ? ORDER BY date DESC', [req.userId], (err, income) => {
    if (err) return res.status(500).json({ error: 'Unable to load income' });
    res.json(income || []);
  });
});

app.post('/api/income', authMiddleware, (req, res) => {
  const errors = [];
  const source = cleanString(req.body.source, 160);
  const amount = cleanNumber(req.body.amount, null);
  const currency = cleanCurrency(req.body.currency);
  const date = cleanDate(req.body.date);
  const category = cleanString(req.body.category || 'brand_deal', 40);
  const status = cleanString(req.body.status || 'received', 30);

  requireValid(Boolean(source), 'Income source is required.', errors);
  requireValid(amount !== null, 'Amount must be a positive number.', errors);
  requireValid(Boolean(currency), 'Currency must be a 3-letter code.', errors);
  requireValid(Boolean(date), 'Date must be YYYY-MM-DD.', errors);
  requireValid(INCOME_CATEGORIES.has(category), 'Income category is invalid.', errors);
  requireValid(INCOME_STATUSES.has(status), 'Income status is invalid.', errors);
  if (errors.length) return sendValidation(res, errors);

  const id = randomUUID();
  db.run(
    'INSERT INTO income (id, user_id, source, amount, currency, date, deal_id, description, category, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.userId, source, amount, currency, date, cleanOptionalString(req.body.deal_id, 80), cleanOptionalString(req.body.description, 2000), category, status],
    function(err) {
      if (err) return res.status(500).json({ error: 'Unable to create income' });
      auditEvent(req, 'create', 'income', id, { status });
      res.json({ id, user_id: req.userId });
    }
  );
});

app.put('/api/income/:id', authMiddleware, validateIdParam, (req, res) => {
  db.get('SELECT * FROM income WHERE id = ? AND user_id = ?', [req.params.id, req.userId], (err, currentIncome) => {
    if (err) return res.status(500).json({ error: 'Unable to load income record' });
    if (!currentIncome) return res.status(404).json({ error: 'Income record not found' });

    const errors = [];
    const source = req.body.source !== undefined ? cleanString(req.body.source, 160) : currentIncome.source;
    const amount = req.body.amount !== undefined ? cleanNumber(req.body.amount, null) : currentIncome.amount;
    const currency = req.body.currency !== undefined ? cleanCurrency(req.body.currency) : currentIncome.currency;
    const date = req.body.date !== undefined ? cleanDate(req.body.date) : currentIncome.date;
    const category = req.body.category !== undefined ? cleanString(req.body.category, 40) : currentIncome.category;
    const status = req.body.status !== undefined ? cleanString(req.body.status, 30) : currentIncome.status;

    requireValid(Boolean(source), 'Income source is required.', errors);
    requireValid(amount !== null, 'Amount must be a positive number.', errors);
    requireValid(Boolean(currency), 'Currency must be a 3-letter code.', errors);
    requireValid(Boolean(date), 'Date must be YYYY-MM-DD.', errors);
    requireValid(INCOME_CATEGORIES.has(category), 'Income category is invalid.', errors);
    requireValid(INCOME_STATUSES.has(status), 'Income status is invalid.', errors);
    if (errors.length) return sendValidation(res, errors);

    db.run(
      `UPDATE income SET
        source = ?, amount = ?, currency = ?, date = ?,
        description = ?, category = ?, status = ?
       WHERE id = ? AND user_id = ?`,
      [
        source,
        amount,
        currency,
        date,
        req.body.description !== undefined ? cleanOptionalString(req.body.description, 2000) : currentIncome.description,
        category,
        status,
        req.params.id,
        req.userId,
      ],
      function(updateErr) {
        if (updateErr) return res.status(500).json({ error: 'Unable to update income' });
        auditEvent(req, 'update', 'income', req.params.id, { from: currentIncome.status, to: status });

        if (currentIncome.deal_id) {
          return db.run(
            `UPDATE deals SET brand_name = ?, value = ?, currency = ?, pipeline_stage = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND user_id = ?`,
            [source, amount, currency, status === 'pending' ? 'delivered' : 'paid', currentIncome.deal_id, req.userId],
            function(dealErr) {
              if (dealErr) return res.status(500).json({ error: 'Unable to update linked deal' });
              auditEvent(req, 'update', 'deal', currentIncome.deal_id, { linkedIncomeId: req.params.id });
              res.json({ updated: this.changes, dealUpdated: true });
            }
          );
        }

        res.json({ updated: this.changes, dealUpdated: false });
      }
    );
  });
});

app.delete('/api/income/:id', authMiddleware, validateIdParam, (req, res) => {
  db.get('SELECT * FROM income WHERE id = ? AND user_id = ?', [req.params.id, req.userId], (err, income) => {
    if (err) return res.status(500).json({ error: 'Unable to load income record' });
    if (!income) return res.status(404).json({ error: 'Income record not found' });

    if (income.deal_id) {
      return db.run('DELETE FROM income WHERE id = ? AND user_id = ?', [req.params.id, req.userId], function(deleteIncomeErr) {
        if (deleteIncomeErr) return res.status(500).json({ error: 'Unable to delete income' });

        db.run('DELETE FROM deals WHERE id = ? AND user_id = ?', [income.deal_id, req.userId], function(deleteDealErr) {
          if (deleteDealErr) return res.status(500).json({ error: 'Unable to delete linked deal' });
          auditEvent(req, 'delete', 'income', req.params.id, { linkedDealDeleted: income.deal_id });
          auditEvent(req, 'delete', 'deal', income.deal_id, { linkedIncomeDeleted: req.params.id });
          res.json({ deleted: 1, dealDeleted: true });
        });
      });
    }

    db.run('DELETE FROM income WHERE id = ? AND user_id = ?', [req.params.id, req.userId], function(deleteErr) {
      if (deleteErr) return res.status(500).json({ error: 'Unable to delete income' });
      auditEvent(req, 'delete', 'income', req.params.id);
      res.json({ deleted: this.changes, dealDeleted: false });
    });
  });
});

app.get('/api/dashboard', authMiddleware, (req, res) => {
  const userId = req.userId;

  db.get('SELECT COUNT(*) as total_deals FROM deals WHERE user_id = ?', [userId], (dealsErr, dealsCount) => {
    if (dealsErr) return res.status(500).json({ error: 'Unable to load dashboard' });
    db.get('SELECT COUNT(*) as total_content FROM content WHERE user_id = ?', [userId], (contentErr, contentCount) => {
      if (contentErr) return res.status(500).json({ error: 'Unable to load dashboard' });
      db.all('SELECT status, COUNT(*) as count FROM content WHERE user_id = ? GROUP BY status', [userId], (statusErr, contentStatusStats) => {
        if (statusErr) return res.status(500).json({ error: 'Unable to load dashboard' });
        db.get("SELECT SUM(amount) as total_income FROM income WHERE user_id = ? AND status = 'received'", [userId], (incomeErr, incomeSum) => {
          if (incomeErr) return res.status(500).json({ error: 'Unable to load dashboard' });
          db.get("SELECT COUNT(*) as active_deals FROM deals WHERE user_id = ? AND pipeline_stage != 'paid'", [userId], (activeErr, activeDeals) => {
            if (activeErr) return res.status(500).json({ error: 'Unable to load dashboard' });
            db.all("SELECT TO_CHAR(date::date, 'YYYY-MM') as month, SUM(amount) as amount FROM income WHERE user_id = ? GROUP BY month ORDER BY month DESC LIMIT 6", [userId], (monthlyErr, monthlyIncome) => {
              if (monthlyErr) return res.status(500).json({ error: 'Unable to load dashboard' });
              db.all('SELECT pipeline_stage, COUNT(*) as count FROM deals WHERE user_id = ? GROUP BY pipeline_stage', [userId], (pipelineErr, pipelineStats) => {
                if (pipelineErr) return res.status(500).json({ error: 'Unable to load dashboard' });
                db.all("SELECT source, SUM(amount) as amount FROM income WHERE user_id = ? AND status = 'received' GROUP BY source ORDER BY amount DESC LIMIT 5", [userId], (sourcesErr, incomeSources) => {
                  if (sourcesErr) return res.status(500).json({ error: 'Unable to load dashboard' });
                  res.json({
                    stats: {
                      totalDeals: dealsCount?.total_deals || 0,
                      totalContent: contentCount?.total_content || 0,
                      totalIncome: incomeSum?.total_income || 0,
                      activeDeals: activeDeals?.active_deals || 0,
                    },
                    monthlyIncome: monthlyIncome || [],
                    pipelineStats: pipelineStats || [],
                    contentStatusStats: contentStatusStats || [],
                    incomeSources: incomeSources || [],
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

app.get('/api/rate-cards', authMiddleware, (req, res) => {
  db.all('SELECT * FROM rate_cards WHERE user_id = ?', [req.userId], (err, cards) => {
    if (err) return res.status(500).json({ error: 'Unable to load rate cards' });
    cards = cards || [];
    cards.forEach(c => {
      c.platforms = parseJson(c.platforms, []);
      c.services = parseJson(c.services, []);
      c.pricing_tiers = parseJson(c.pricing_tiers, []);
      c.demographics = parseJson(c.demographics, {});
    });
    res.json(cards);
  });
});

app.post('/api/rate-cards', authMiddleware, (req, res) => {
  const errors = [];
  const name = cleanString(req.body.name, 120);
  const audienceSize = cleanNumber(req.body.audience_size, 0);
  const engagementRate = cleanNumber(req.body.engagement_rate, 0);
  const platforms = Array.isArray(req.body.platforms) ? req.body.platforms.filter(p => PLATFORMS.has(p)).slice(0, MAX_PLATFORMS) : [];
  const services = Array.isArray(req.body.services) ? req.body.services.map(s => cleanString(s, 120)).filter(Boolean).slice(0, MAX_SERVICES) : [];
  const pricingTiers = Array.isArray(req.body.pricing_tiers)
    ? req.body.pricing_tiers.slice(0, MAX_PRICING_TIERS).map(tier => ({
        service: cleanString(tier?.service, 120) || 'Service',
        price: cleanNumber(tier?.price, 0) || 0,
        description: cleanOptionalString(tier?.description, 500),
      }))
    : [];

  requireValid(Boolean(name), 'Rate card name is required.', errors);
  requireValid(audienceSize !== null, 'Audience size must be a positive number.', errors);
  requireValid(engagementRate !== null, 'Engagement rate must be a positive number.', errors);
  if (errors.length) return sendValidation(res, errors);

  const id = randomUUID();
  db.run(
    'INSERT INTO rate_cards (id, user_id, name, platforms, services, audience_size, engagement_rate, demographics, pricing_tiers, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.userId, name, JSON.stringify(platforms), JSON.stringify(services), audienceSize, engagementRate, JSON.stringify({}), JSON.stringify(pricingTiers), req.body.is_default ? 1 : 0],
    function(err) {
      if (err) return res.status(500).json({ error: 'Unable to create rate card' });
      auditEvent(req, 'create', 'rate_card', id);
      res.json({ id, user_id: req.userId });
    }
  );
});

app.use((err, req, res, next) => {
  if (err.message === 'Origin is not allowed by CORS') {
    return res.status(403).json({ error: 'Origin is not allowed' });
  }
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

db.ready.then(() => {
  app.listen(PORT, () => {
    console.log('CreatorOS API running on port ' + PORT);
  });
});

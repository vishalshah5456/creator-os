const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const db = require('./database/db');
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'creator-os-secret-key-2026';

app.use(cors());
app.use(express.json());

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, handle } = req.body;

  db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
    if (row) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();

    db.run(
      'INSERT INTO users (id, email, password, name, handle) VALUES (?, ?, ?, ?, ?)',
      [id, email, hashedPassword, name, handle],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id, email, name, handle } });
      }
    );
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        handle: user.handle,
        avatar: user.avatar,
        followers: user.followers,
        niche: user.niche
      } 
    });
  });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  db.get('SELECT id, email, name, handle, avatar, bio, niche, followers, platforms FROM users WHERE id = ?', 
    [req.userId], 
    (err, user) => {
      if (err || !user) {
        return res.status(404).json({ error: 'User not found' });
      }
      user.platforms = JSON.parse(user.platforms || '[]');
      res.json(user);
    }
  );
});

// Deals routes
app.get('/api/deals', authMiddleware, (req, res) => {
  db.all('SELECT * FROM deals WHERE user_id = ? ORDER BY created_at DESC', 
    [req.userId], 
    (err, deals) => {
      if (err) return res.status(500).json({ error: err.message });
      deals = deals || [];
      deals.forEach(d => {
        d.deliverables = JSON.parse(d.deliverables || '[]');
        d.platforms = JSON.parse(d.platforms || '[]');
      });
      res.json(deals);
    }
  );
});

app.post('/api/deals', authMiddleware, (req, res) => {
  const { brand_name, brand_logo, contact_name, contact_email, value, currency, 
          status, pipeline_stage, description, deliverables, start_date, end_date, notes, platforms } = req.body;

  const id = uuidv4();
  db.run(
    `INSERT INTO deals (id, user_id, brand_name, brand_logo, contact_name, contact_email, 
      value, currency, status, pipeline_stage, description, deliverables, start_date, end_date, notes, platforms) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, req.userId, brand_name, brand_logo, contact_name, contact_email, 
     value || 0, currency || 'USD', status || 'lead', pipeline_stage || 'outreach', 
     description, JSON.stringify(deliverables || []), start_date, end_date, notes, JSON.stringify(platforms || [])],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, ...req.body, user_id: req.userId });
    }
  );
});

app.put('/api/deals/:id', authMiddleware, (req, res) => {
  const { pipeline_stage, value, notes, platforms, description, contact_name, currency, start_date, end_date } = req.body;

  db.get('SELECT * FROM deals WHERE id = ? AND user_id = ?', [req.params.id, req.userId], (err, currentDeal) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!currentDeal) return res.status(404).json({ error: 'Deal not found' });

    const wasPaid = currentDeal.pipeline_stage === 'paid';
    const isNowPaid = pipeline_stage === 'paid';

    db.run(
      `UPDATE deals SET 
        pipeline_stage = ?, value = ?, notes = ?, 
        platforms = ?, description = ?, contact_name = ?, currency = ?, 
        start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ? AND user_id = ?`,
      [
        pipeline_stage || currentDeal.pipeline_stage, 
        value !== undefined ? value : currentDeal.value, 
        notes !== undefined ? notes : currentDeal.notes,
        platforms ? JSON.stringify(platforms) : currentDeal.platforms,
        description !== undefined ? description : currentDeal.description,
        contact_name !== undefined ? contact_name : currentDeal.contact_name,
        currency || currentDeal.currency,
        start_date !== undefined ? start_date : currentDeal.start_date,
        end_date !== undefined ? end_date : currentDeal.end_date,
        req.params.id, req.userId
      ],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });

        if (isNowPaid && !wasPaid) {
          const dealValue = value || currentDeal.value || 0;
          const dealCurrency = currency || currentDeal.currency || 'USD';
          const brandName = currentDeal.brand_name || 'Brand Deal';
          const incomeId = uuidv4();

          db.run(
            `INSERT INTO income (id, user_id, source, amount, currency, date, deal_id, description, category, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              incomeId, req.userId, brandName, dealValue, dealCurrency,
              new Date().toISOString().split('T')[0], req.params.id,
              'Auto: Deal paid - ' + brandName, 'brand_deal', 'received'
            ],
            function(err) {
              if (err) console.log('Auto-income error:', err);
              res.json({ 
                updated: this.changes, 
                incomeCreated: !err,
                message: 'Deal updated. Income automatically logged.'
              });
            }
          );
        } else {
          res.json({ updated: this.changes });
        }
      }
    );
  });
});

app.delete('/api/deals/:id', authMiddleware, (req, res) => {
  db.run('DELETE FROM deals WHERE id = ? AND user_id = ?', [req.params.id, req.userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// Content routes
app.get('/api/content', authMiddleware, (req, res) => {
  db.all('SELECT * FROM content WHERE user_id = ? ORDER BY scheduled_date DESC', 
    [req.userId], 
    (err, content) => {
      if (err) return res.status(500).json({ error: err.message });
      content = content || [];
      content.forEach(c => {
        c.performance_metrics = JSON.parse(c.performance_metrics || '{}');
      });
      res.json(content);
    }
  );
});

app.post('/api/content', authMiddleware, (req, res) => {
  const { title, platform, content_type, status, scheduled_date, deal_id } = req.body;
  const id = uuidv4();
  db.run(
    'INSERT INTO content (id, user_id, title, platform, content_type, status, scheduled_date, deal_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.userId, title, platform, content_type, status || 'draft', scheduled_date, deal_id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, ...req.body, user_id: req.userId });
    }
  );
});

// Income routes
app.get('/api/income', authMiddleware, (req, res) => {
  db.all('SELECT * FROM income WHERE user_id = ? ORDER BY date DESC', 
    [req.userId], 
    (err, income) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(income || []);
    }
  );
});

app.post('/api/income', authMiddleware, (req, res) => {
  const { source, amount, currency, date, deal_id, description, category, status } = req.body;
  const id = uuidv4();
  db.run(
    'INSERT INTO income (id, user_id, source, amount, currency, date, deal_id, description, category, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.userId, source, amount, currency || 'USD', date, deal_id, description, category || 'brand_deal', status || 'received'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, ...req.body, user_id: req.userId });
    }
  );
});

// Dashboard stats
app.get('/api/dashboard', authMiddleware, (req, res) => {
  const userId = req.userId;

  db.get('SELECT COUNT(*) as total_deals FROM deals WHERE user_id = ?', [userId], (err, dealsCount) => {
    db.get('SELECT COUNT(*) as total_content FROM content WHERE user_id = ?', [userId], (err, contentCount) => {
      db.get("SELECT SUM(amount) as total_income FROM income WHERE user_id = ? AND status = 'received'", [userId], (err, incomeSum) => {
        db.get("SELECT COUNT(*) as active_deals FROM deals WHERE user_id = ? AND pipeline_stage != 'paid'", [userId], (err, activeDeals) => {
          db.all("SELECT TO_CHAR(date::date, 'YYYY-MM') as month, SUM(amount) as amount FROM income WHERE user_id = ? GROUP BY month ORDER BY month DESC LIMIT 6", [userId], (err, monthlyIncome) => {
            db.all('SELECT pipeline_stage, COUNT(*) as count FROM deals WHERE user_id = ? GROUP BY pipeline_stage', [userId], (err, pipelineStats) => {
              db.all("SELECT source, SUM(amount) as amount FROM income WHERE user_id = ? AND status = 'received' GROUP BY source ORDER BY amount DESC LIMIT 5", [userId], (err, incomeSources) => {
                res.json({
                  stats: {
                    totalDeals: dealsCount?.total_deals || 0,
                    totalContent: contentCount?.total_content || 0,
                    totalIncome: incomeSum?.total_income || 0,
                    activeDeals: activeDeals?.active_deals || 0
                  },
                  monthlyIncome: monthlyIncome || [],
                  pipelineStats: pipelineStats || [],
                  incomeSources: incomeSources || []
                });
              });
            });
          });
        });
      });
    });
  });
});

// Rate cards
app.get('/api/rate-cards', authMiddleware, (req, res) => {
  db.all('SELECT * FROM rate_cards WHERE user_id = ?', [req.userId], (err, cards) => {
    if (err) return res.status(500).json({ error: err.message });
    cards = cards || [];
    cards.forEach(c => {
      c.platforms = JSON.parse(c.platforms || '[]');
      c.services = JSON.parse(c.services || '[]');
      c.pricing_tiers = JSON.parse(c.pricing_tiers || '[]');
      c.demographics = JSON.parse(c.demographics || '{}');
    });
    res.json(cards);
  });
});

app.post('/api/rate-cards', authMiddleware, (req, res) => {
  const { name, platforms, services, audience_size, engagement_rate, demographics, pricing_tiers, is_default } = req.body;
  const id = uuidv4();
  db.run(
    'INSERT INTO rate_cards (id, user_id, name, platforms, services, audience_size, engagement_rate, demographics, pricing_tiers, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.userId, name, JSON.stringify(platforms), JSON.stringify(services), audience_size, engagement_rate, JSON.stringify(demographics), JSON.stringify(pricing_tiers), is_default ? 1 : 0],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, ...req.body, user_id: req.userId });
    }
  );
});

app.listen(PORT, () => {
  console.log('CreatorOS API running on port ' + PORT);
});

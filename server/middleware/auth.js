const { createClient } = require('@supabase/supabase-js');
const db = require('../database/db');

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');
const SESSION_TIMEOUT_MS = Number(process.env.SESSION_TIMEOUT_MS || 15 * 60 * 1000);

function getUserProfileId(authUser) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id FROM users WHERE auth_id = ? OR (auth_id IS NULL AND LOWER(email) = LOWER(?)) LIMIT 1',
      [authUser.id, authUser.email],
      (err, user) => {
        if (err) return reject(err);
        resolve(user?.id || authUser.id);
      }
    );
  });
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

function verifyIdleSession(authId, tokenIssuedAt) {
  return new Promise((resolve, reject) => {
    db.get('SELECT last_seen_at FROM auth_sessions WHERE auth_id = ?', [authId], (err, session) => {
      if (err) return reject(err);

      const now = Date.now();
      const lastSeen = session?.last_seen_at ? new Date(session.last_seen_at).getTime() : null;
      const tokenIssuedAtMs = tokenIssuedAt ? tokenIssuedAt * 1000 : 0;

      if (lastSeen && now - lastSeen > SESSION_TIMEOUT_MS && tokenIssuedAtMs <= lastSeen) {
        return resolve(false);
      }

      db.run(
        `INSERT INTO auth_sessions (auth_id, last_seen_at)
         VALUES (?, CURRENT_TIMESTAMP)
         ON CONFLICT (auth_id) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP`,
        [authId],
        (updateErr) => {
          if (updateErr) return reject(updateErr);
          resolve(true);
        }
      );
    });
  });
}

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const tokenPayload = decodeJwtPayload(token);
    const sessionAllowed = await verifyIdleSession(data.user.id, tokenPayload.iat);
    if (!sessionAllowed) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }

    req.authUser = data.user;
    req.userId = await getUserProfileId(data.user);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

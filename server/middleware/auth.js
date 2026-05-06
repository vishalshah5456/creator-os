const { createClient } = require('@supabase/supabase-js');
const db = require('../database/db');

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');

function getUserProfileId(authUser) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id FROM users WHERE auth_id = ? OR email = ? LIMIT 1',
      [authUser.id, authUser.email],
      (err, user) => {
        if (err) return reject(err);
        resolve(user?.id || authUser.id);
      }
    );
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

    req.authUser = data.user;
    req.userId = await getUserProfileId(data.user);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

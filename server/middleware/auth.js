const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');

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
    req.userId = data.user.id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

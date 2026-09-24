// Authentication: bcrypt password hashing, Google sign-in verified on the server,
// and a signed session cookie so the server knows who is making each request.
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const GOOGLE_CLIENT_ID = '14363939556-rfd3scpioaorp8a4tj65on03hblb5rs9.apps.googleusercontent.com';
const SESSION_COOKIE = 'booked_session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.warn('JWT_SECRET is not set; using a random secret, so sessions reset when the server restarts');
  jwtSecret = crypto.randomBytes(32).toString('hex');
}

const isBcryptHash = (value) => /^\$2[aby]\$\d{2}\$/.test(value || '');

function setSession(req, res, username) {
  const token = jwt.sign({ username }, jwtSecret, { expiresIn: SESSION_MAX_AGE_MS / 1000 });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: SESSION_MAX_AGE_MS,
  });
}

function getSessionUsername(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  try {
    return jwt.verify(token, jwtSecret).username;
  } catch {
    return null;
  }
}

function requireSession(req, res, next) {
  const username = getSessionUsername(req);
  if (!username) return res.status(401).send('Please log in');
  req.sessionUsername = username;
  next();
}

// Ask Google who an access token belongs to, and make sure it was issued to our app
async function verifyGoogleAccessToken(accessToken) {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
  if (!response.ok) return null;
  const info = await response.json();
  if (info.aud !== GOOGLE_CLIENT_ID || !info.sub) return null;
  return { googleId: info.sub, email: info.email };
}

function validateUsername(username) {
  if (typeof username !== 'string' || !/^[A-Za-z0-9_.-]{3,30}$/.test(username)) {
    return 'Username must be 3-30 characters: letters, numbers, dots, dashes or underscores';
  }
  return null;
}

function registerAuthRoutes(app, User) {
  app.post('/api/auth/register', async (req, res) => {
    const username = req.body.username?.trim();
    const { password } = req.body;
    const usernameError = validateUsername(username);
    if (usernameError) return res.status(400).send(usernameError);
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).send('Password must be at least 8 characters');
    }

    try {
      if (await User.exists({ username })) {
        return res.status(400).send('Username is already taken');
      }
      await User.create({ username, password: await bcrypt.hash(password, 10) });
      setSession(req, res, username);
      res.status(201).json({ username });
    } catch (err) {
      console.error('Error creating user:', err);
      res.status(400).send('Error creating user');
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const username = req.body.username?.trim();
    const { password } = req.body;
    if (!username || typeof password !== 'string') {
      return res.status(400).send('Invalid username or password');
    }

    try {
      const user = await User.findOne({ username });
      if (!user) return res.status(400).send('Invalid username or password');

      let valid;
      if (isBcryptHash(user.password)) {
        valid = await bcrypt.compare(password, user.password);
      } else {
        // Accounts created before hashing stored plain text; upgrade them on login
        const stored = Buffer.from(user.password || '');
        const given = Buffer.from(password);
        valid = stored.length === given.length && crypto.timingSafeEqual(stored, given);
        if (valid) {
          user.password = await bcrypt.hash(password, 10);
          await user.save();
        }
      }
      if (!valid) return res.status(400).send('Invalid username or password');

      setSession(req, res, user.username);
      res.status(200).json({ username: user.username });
    } catch (err) {
      console.error('Error during login:', err);
      res.status(500).send('Internal server error');
    }
  });

  // One endpoint for Google sign-in and sign-up. Without `username` it logs in an
  // existing account; if none exists it answers needsUsername so the page can ask for one.
  app.post('/api/auth/google', async (req, res) => {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).send('Missing Google token');

    try {
      const google = await verifyGoogleAccessToken(accessToken);
      if (!google) return res.status(401).send('Could not verify your Google account');

      const existing = await User.findOne({ googleId: google.googleId });
      if (existing) {
        setSession(req, res, existing.username);
        return res.status(200).json({ username: existing.username });
      }

      const username = req.body.username?.trim();
      if (!username) return res.status(404).json({ needsUsername: true });

      const usernameError = validateUsername(username);
      if (usernameError) return res.status(400).send(usernameError);
      if (await User.exists({ username })) {
        return res.status(400).send('Username is already taken');
      }

      // Google accounts have no password; store an unguessable hash so password login can't match
      await User.create({
        username,
        googleId: google.googleId,
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
      });
      setSession(req, res, username);
      res.status(201).json({ username });
    } catch (err) {
      console.error('Error during Google sign-in:', err);
      res.status(500).send('Internal server error');
    }
  });

  app.get('/api/auth/me', (req, res) => {
    const username = getSessionUsername(req);
    if (!username) return res.status(401).json({ loggedIn: false });
    res.json({ loggedIn: true, username });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: req.secure });
    res.status(200).send('Logged out');
  });
}

module.exports = { registerAuthRoutes, requireSession, setSession };

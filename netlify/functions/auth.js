import bcrypt from 'bcryptjs';
import cookie from 'cookie';
import { randomUUID } from 'crypto';

// NOTE: In-memory storage is ephemeral in serverless functions.
// Data will be lost when the function instance is recycled (cold starts).
// For production, use a database (Supabase, MongoDB, etc.).
// This is a scaffold for demonstration purposes.
const users = [];
const sessions = new Map();
const resetTokens = new Map();

const headers = {
  'Access-Control-Allow-Origin': '*', // Adjust for production
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export const handler = async (event, context) => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Parse path to determine action
  // Assumes redirect rule: /api/auth/* -> /.netlify/functions/auth
  // So path might be /api/auth/login or just /login depending on how it's invoked
  let path = event.path.replace('/.netlify/functions/auth', '');
  if (path.startsWith('/api/auth')) {
    path = path.replace('/api/auth', '');
  }
  
  // Ensure path starts with /
  if (!path.startsWith('/')) path = '/' + path;

  let body = {};
  try {
    if (event.body) body = JSON.parse(event.body);
  } catch (e) {
    console.error('Failed to parse body', e);
  }

  // Helper to get session
  const getSession = () => {
    const cookies = cookie.parse(event.headers.cookie || '');
    const sessionId = cookies.session_id;
    if (!sessionId) return null;
    const session = sessions.get(sessionId);
    if (!session || session.expiresAt < new Date()) return null;
    return session;
  };

  try {
    console.log(`[Auth] ${event.httpMethod} ${path}`);

    // POST /signup
    if (path === '/signup' && event.httpMethod === 'POST') {
      const { email, password, displayName } = body;
      if (!email || !password) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email and password required' }) };
      }

      if (users.find(u => u.email === email)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email already exists' }) };
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = {
        id: randomUUID(),
        email,
        password: hashedPassword,
        displayName,
        username: email,
        createdAt: new Date().toISOString()
      };
      users.push(user);

      const sessionId = randomUUID();
      sessions.set(sessionId, { userId: user.id, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
      
      const cookieHeader = cookie.serialize('session_id', sessionId, {
        httpOnly: true,
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        sameSite: 'lax'
      });

      const { password: _, ...safeUser } = user;
      return {
        statusCode: 200,
        headers: { ...headers, 'Set-Cookie': cookieHeader },
        body: JSON.stringify({ user: safeUser })
      };
    }

    // POST /login
    if (path === '/login' && event.httpMethod === 'POST') {
      const { email, password } = body;
      const user = users.find(u => u.email === email);
      
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials' }) };
      }

      const sessionId = randomUUID();
      sessions.set(sessionId, { userId: user.id, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
      
      const cookieHeader = cookie.serialize('session_id', sessionId, {
        httpOnly: true,
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        sameSite: 'lax'
      });

      const { password: _, ...safeUser } = user;
      return {
        statusCode: 200,
        headers: { ...headers, 'Set-Cookie': cookieHeader },
        body: JSON.stringify({ user: safeUser })
      };
    }

    // POST /logout
    if (path === '/logout' && event.httpMethod === 'POST') {
      const cookies = cookie.parse(event.headers.cookie || '');
      if (cookies.session_id) sessions.delete(cookies.session_id);
      
      const cookieHeader = cookie.serialize('session_id', '', {
        httpOnly: true,
        path: '/',
        maxAge: -1
      });

      return {
        statusCode: 200,
        headers: { ...headers, 'Set-Cookie': cookieHeader },
        body: JSON.stringify({ success: true })
      };
    }

    // GET /me
    if (path === '/me' && event.httpMethod === 'GET') {
      const session = getSession();
      if (!session) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
      }
      
      const user = users.find(u => u.id === session.userId);
      if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'User not found' }) };
      }

      const { password: _, ...safeUser } = user;
      return { statusCode: 200, headers, body: JSON.stringify({ user: safeUser }) };
    }

    // POST /request-password-reset
    if (path === '/request-password-reset' && event.httpMethod === 'POST') {
      const { email } = body;
      const user = users.find(u => u.email === email);
      
      if (user) {
        const token = randomUUID();
        resetTokens.set(token, { userId: user.id, expiresAt: new Date(Date.now() + 3600000) });
        console.log(`[Auth] Reset token for ${email}: ${token}`);
      }
      
      // Always return success
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // POST /reset-password
    if (path === '/reset-password' && event.httpMethod === 'POST') {
      const { token, password } = body;
      const resetData = resetTokens.get(token);
      
      if (!resetData || resetData.expiresAt < new Date()) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid or expired token' }) };
      }

      const user = users.find(u => u.id === resetData.userId);
      if (user) {
        user.password = await bcrypt.hash(password, 10);
        resetTokens.delete(token);
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: `Not found: ${path}` }) };

  } catch (error) {
    console.error('Auth error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};

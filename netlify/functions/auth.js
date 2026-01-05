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

// Helper to build CORS headers
const getCorsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json',
});

export const handler = async (event, context) => {
  const origin = event.headers.origin || event.headers.Origin || '*';
  const headers = getCorsHeaders(origin);

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Parse path to determine action - get the last segment
  const segments = event.path.split('/').filter(Boolean);
  const action = segments.length > 0 ? segments[segments.length - 1] : '';

  let body = {};
  try {
    if (event.body) body = JSON.parse(event.body);
  } catch (e) {
    console.error('Failed to parse body', e);
  }

  // Helper to get session from cookie OR Authorization header (for mobile)
  const getSession = () => {
    // Try Authorization header first (for mobile apps)
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const session = sessions.get(token);
      if (session && session.expiresAt > new Date()) {
        return session;
      }
    }

    // Fall back to cookies (for web)
    const cookies = cookie.parse(event.headers.cookie || '');
    const sessionId = cookies.session_id;
    if (!sessionId) return null;
    const session = sessions.get(sessionId);
    if (!session || session.expiresAt < new Date()) return null;
    return session;
  };

  // Helper to create session and return appropriate auth mechanism
  const createSessionResponse = (user, headers) => {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    sessions.set(sessionId, { userId: user.id, expiresAt });

    const { password: _, ...safeUser } = user;

    // Set cookie for web browsers
    const cookieHeader = cookie.serialize('session_id', sessionId, {
      httpOnly: true,
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      sameSite: 'lax',
      secure: true, // Required for HTTPS on Netlify
    });

    return {
      statusCode: 200,
      headers: { ...headers, 'Set-Cookie': cookieHeader },
      body: JSON.stringify({ 
        user: safeUser,
        token: sessionId, // Also return token for mobile apps
      }),
    };
  };

  try {
    console.log(`[Auth] ${event.httpMethod} ${event.path} -> Action: ${action}`);

    // POST /signup
    if (action === 'signup' && event.httpMethod === 'POST') {
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
        displayName: displayName || email.split('@')[0],
        username: email,
        createdAt: new Date().toISOString(),
      };
      users.push(user);

      return createSessionResponse(user, headers);
    }

    // POST /login
    if (action === 'login' && event.httpMethod === 'POST') {
      const { email, password } = body;
      if (!email || !password) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email and password required' }) };
      }

      const user = users.find(u => u.email === email);
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials' }) };
      }

      return createSessionResponse(user, headers);
    }

    // POST /logout
    if (action === 'logout' && event.httpMethod === 'POST') {
      // Clear session from both cookie and header
      const authHeader = event.headers.authorization || event.headers.Authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        sessions.delete(authHeader.substring(7));
      }
      const cookies = cookie.parse(event.headers.cookie || '');
      if (cookies.session_id) {
        sessions.delete(cookies.session_id);
      }

      const cookieHeader = cookie.serialize('session_id', '', {
        httpOnly: true,
        path: '/',
        maxAge: -1,
        secure: true,
      });

      return {
        statusCode: 200,
        headers: { ...headers, 'Set-Cookie': cookieHeader },
        body: JSON.stringify({ success: true }),
      };
    }

    // GET /me
    if (action === 'me' && event.httpMethod === 'GET') {
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
    if (action === 'request-password-reset' && event.httpMethod === 'POST') {
      const { email } = body;
      const user = users.find(u => u.email === email);

      if (user) {
        const token = randomUUID();
        resetTokens.set(token, { userId: user.id, expiresAt: new Date(Date.now() + 3600000) });
        console.log(`[Auth] Reset token for ${email}: ${token}`);
        // TODO: Send email with reset link
      }

      // Always return success to prevent email enumeration
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // POST /reset-password
    if (action === 'reset-password' && event.httpMethod === 'POST') {
      const { token, password } = body;
      if (!token || !password) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Token and password required' }) };
      }

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

    return { statusCode: 404, headers, body: JSON.stringify({ error: `Not found: ${action}` }) };

  } catch (error) {
    console.error('Auth error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error', details: error.message }) };
  }
};

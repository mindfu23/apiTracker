import bcrypt from 'bcryptjs';
import cookie from 'cookie';
import { randomUUID } from 'crypto';
import { neon } from '@neondatabase/serverless';

/**
 * Authentication handler with Neon PostgreSQL persistence
 *
 * Required environment variable:
 * - DATABASE_URL: Neon PostgreSQL connection string
 *
 * Database schema (run once in Neon console):
 *
 * CREATE TABLE IF NOT EXISTS users (
 *   id VARCHAR(36) PRIMARY KEY,
 *   email TEXT UNIQUE NOT NULL,
 *   username TEXT UNIQUE NOT NULL,
 *   password TEXT NOT NULL,
 *   display_name TEXT NOT NULL,
 *   created_at TIMESTAMP DEFAULT NOW()
 * );
 *
 * CREATE TABLE IF NOT EXISTS sessions (
 *   id VARCHAR(36) PRIMARY KEY,
 *   user_id VARCHAR(36) NOT NULL REFERENCES users(id),
 *   expires_at TIMESTAMP NOT NULL,
 *   created_at TIMESTAMP DEFAULT NOW()
 * );
 *
 * CREATE TABLE IF NOT EXISTS password_reset_tokens (
 *   token VARCHAR(36) PRIMARY KEY,
 *   user_id VARCHAR(36) NOT NULL REFERENCES users(id),
 *   expires_at TIMESTAMP NOT NULL,
 *   created_at TIMESTAMP DEFAULT NOW()
 * );
 */

// Get database connection (lazy init)
let sql = null;
function getDb() {
  if (!sql && process.env.DATABASE_URL) {
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

// Check if database is configured
function hasDatabase() {
  return !!process.env.DATABASE_URL;
}

// In-memory fallback for development/demo (ephemeral)
const memoryUsers = [];
const memorySessions = new Map();
const memoryResetTokens = new Map();

// Helper to build CORS headers
const getCorsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json',
});

// Database operations with fallback to in-memory
const db = {
  async getUserByEmail(email) {
    const sql = getDb();
    if (sql) {
      const rows = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
      return rows[0] || null;
    }
    return memoryUsers.find(u => u.email === email) || null;
  },

  async getUserById(id) {
    const sql = getDb();
    if (sql) {
      const rows = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
      return rows[0] || null;
    }
    return memoryUsers.find(u => u.id === id) || null;
  },

  async createUser({ id, email, username, password, displayName }) {
    const sql = getDb();
    if (sql) {
      await sql`
        INSERT INTO users (id, email, username, password, display_name, created_at)
        VALUES (${id}, ${email}, ${username}, ${password}, ${displayName}, NOW())
      `;
      return { id, email, username, password, displayName, createdAt: new Date().toISOString() };
    }
    const user = { id, email, username, password, displayName, createdAt: new Date().toISOString() };
    memoryUsers.push(user);
    return user;
  },

  async updateUserPassword(userId, hashedPassword) {
    const sql = getDb();
    if (sql) {
      await sql`UPDATE users SET password = ${hashedPassword} WHERE id = ${userId}`;
      return;
    }
    const user = memoryUsers.find(u => u.id === userId);
    if (user) user.password = hashedPassword;
  },

  async createSession(sessionId, userId, expiresAt) {
    const sql = getDb();
    if (sql) {
      await sql`
        INSERT INTO sessions (id, user_id, expires_at, created_at)
        VALUES (${sessionId}, ${userId}, ${expiresAt.toISOString()}, NOW())
      `;
      return;
    }
    memorySessions.set(sessionId, { userId, expiresAt });
  },

  async getSession(sessionId) {
    const sql = getDb();
    if (sql) {
      const rows = await sql`
        SELECT * FROM sessions WHERE id = ${sessionId} AND expires_at > NOW() LIMIT 1
      `;
      if (rows[0]) {
        return { userId: rows[0].user_id, expiresAt: new Date(rows[0].expires_at) };
      }
      return null;
    }
    const session = memorySessions.get(sessionId);
    if (session && session.expiresAt > new Date()) {
      return session;
    }
    return null;
  },

  async deleteSession(sessionId) {
    const sql = getDb();
    if (sql) {
      await sql`DELETE FROM sessions WHERE id = ${sessionId}`;
      return;
    }
    memorySessions.delete(sessionId);
  },

  async createResetToken(token, userId, expiresAt) {
    const sql = getDb();
    if (sql) {
      await sql`
        INSERT INTO password_reset_tokens (token, user_id, expires_at, created_at)
        VALUES (${token}, ${userId}, ${expiresAt.toISOString()}, NOW())
      `;
      return;
    }
    memoryResetTokens.set(token, { userId, expiresAt });
  },

  async getResetToken(token) {
    const sql = getDb();
    if (sql) {
      const rows = await sql`
        SELECT * FROM password_reset_tokens WHERE token = ${token} AND expires_at > NOW() LIMIT 1
      `;
      if (rows[0]) {
        return { userId: rows[0].user_id, expiresAt: new Date(rows[0].expires_at) };
      }
      return null;
    }
    const data = memoryResetTokens.get(token);
    if (data && data.expiresAt > new Date()) {
      return data;
    }
    return null;
  },

  async deleteResetToken(token) {
    const sql = getDb();
    if (sql) {
      await sql`DELETE FROM password_reset_tokens WHERE token = ${token}`;
      return;
    }
    memoryResetTokens.delete(token);
  },

  // Cleanup expired sessions and tokens (call periodically)
  async cleanup() {
    const sql = getDb();
    if (sql) {
      await sql`DELETE FROM sessions WHERE expires_at < NOW()`;
      await sql`DELETE FROM password_reset_tokens WHERE expires_at < NOW()`;
    }
  }
};

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
  const getSession = async () => {
    // Try Authorization header first (for mobile apps)
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const session = await db.getSession(token);
      if (session) return { ...session, sessionId: token };
    }

    // Fall back to cookies (for web)
    const cookies = cookie.parse(event.headers.cookie || '');
    const sessionId = cookies.session_id;
    if (!sessionId) return null;
    const session = await db.getSession(sessionId);
    if (session) return { ...session, sessionId };
    return null;
  };

  // Helper to create session and return appropriate auth mechanism
  const createSessionResponse = async (user, headers) => {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.createSession(sessionId, user.id, expiresAt);

    const { password: _, ...safeUser } = user;

    // Set cookie for web browsers
    const cookieHeader = cookie.serialize('session_id', sessionId, {
      httpOnly: true,
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      sameSite: 'lax',
      secure: true,
    });

    return {
      statusCode: 200,
      headers: { ...headers, 'Set-Cookie': cookieHeader },
      body: JSON.stringify({
        user: safeUser,
        token: sessionId,
      }),
    };
  };

  try {
    const usingDatabase = hasDatabase();
    console.log(`[Auth] ${event.httpMethod} ${event.path} -> Action: ${action} (DB: ${usingDatabase})`);

    // POST /signup
    if (action === 'signup' && event.httpMethod === 'POST') {
      const { email, password, displayName } = body;
      if (!email || !password) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email and password required' }) };
      }

      const existingUser = await db.getUserByEmail(email);
      if (existingUser) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email already exists' }) };
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await db.createUser({
        id: randomUUID(),
        email,
        username: email,
        password: hashedPassword,
        displayName: displayName || email.split('@')[0],
      });

      return await createSessionResponse(user, headers);
    }

    // POST /login
    if (action === 'login' && event.httpMethod === 'POST') {
      const { email, password } = body;
      if (!email || !password) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email and password required' }) };
      }

      const user = await db.getUserByEmail(email);
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials' }) };
      }

      return await createSessionResponse(user, headers);
    }

    // POST /logout
    if (action === 'logout' && event.httpMethod === 'POST') {
      const session = await getSession();
      if (session?.sessionId) {
        await db.deleteSession(session.sessionId);
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
      const session = await getSession();
      if (!session) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      const user = await db.getUserById(session.userId);
      if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'User not found' }) };
      }

      const { password: _, ...safeUser } = user;
      return { statusCode: 200, headers, body: JSON.stringify({ user: safeUser }) };
    }

    // POST /request-password-reset
    if (action === 'request-password-reset' && event.httpMethod === 'POST') {
      const { email } = body;
      const user = await db.getUserByEmail(email);

      if (user) {
        const token = randomUUID();
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour
        await db.createResetToken(token, user.id, expiresAt);
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

      const resetData = await db.getResetToken(token);
      if (!resetData) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid or expired token' }) };
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await db.updateUserPassword(resetData.userId, hashedPassword);
      await db.deleteResetToken(token);

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // GET /status - Check if auth is configured (for UI to know if login is available)
    if (action === 'status' && event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          authEnabled: true,
          databaseConfigured: hasDatabase(),
          message: hasDatabase()
            ? 'Authentication is fully configured with persistent storage.'
            : 'Authentication available with in-memory storage (data will not persist across deployments).'
        })
      };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: `Not found: ${action}` }) };

  } catch (error) {
    console.error('Auth error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error', details: error.message }) };
  }
};

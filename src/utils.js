export function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'cloudflare-storage-salt');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password, hash) {
  const newHash = await hashPassword(password);
  return newHash === hash;
}

export async function createSession(env, userId, email) {
  const sessionId = generateId();
  const sessionData = {
    id: sessionId,
    userId,
    email,
    createdAt: Date.now()
  };
  await env.STORAGE.put(`session:${sessionId}`, JSON.stringify(sessionData), { expirationTtl: 60 * 60 * 24 * 7 });
  return sessionData;
}

export async function getSession(request, env) {
  const sessionId = request.headers.get('X-Session-ID');
  if (!sessionId) {
    return null;
  }
  const data = await env.STORAGE.get(`session:${sessionId}`);
  if (!data) {
    return null;
  }
  const session = JSON.parse(data);
  const userData = await env.STORAGE.get(`user:${session.email}`);
  if (!userData) {
    return null;
  }
  const user = JSON.parse(userData);
  return { ...session, role: user.role };
}

export function jsonResponse(data, corsHeaders = {}, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

export function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-ID',
    'Access-Control-Allow-Credentials': 'true'
  };
}

export function errorResponse(message, status = 400, corsHeaders = {}) {
  return jsonResponse({ error: message }, corsHeaders, status);
}

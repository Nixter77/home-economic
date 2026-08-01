/**
 * Cloud sync API — single shared household by default (personal app).
 *
 * GET  /api/sync
 * PUT  /api/sync  body: { payload, baseEtag? }
 *
 * Optional multi-room: ?code=HE-XXXX-XXXX or body.code
 * Default room id: "main" (all devices on this deployment share it).
 */

const { put, get, BlobPreconditionFailedError } = require('@vercel/blob');

const CODE_RE = /^HE-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
const DEFAULT_ROOM = 'main';
const PATH_PREFIX = 'households/';
const MAX_BODY_BYTES = 1_500_000;

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    const err = new Error('BLOB_READ_WRITE_TOKEN is not configured');
    err.code = 'NO_BLOB_TOKEN';
    throw err;
  }
  return token;
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-None-Match, If-Match');
  res.setHeader('Access-Control-Expose-Headers', 'ETag, X-Sync-ETag');
}

function json(res, status, body, extraHeaders = {}) {
  Object.entries(extraHeaders).forEach(([k, v]) => res.setHeader(k, v));
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function resolveRoom(raw) {
  if (raw == null || raw === '' || raw === 'main' || raw === 'default') {
    return DEFAULT_ROOM;
  }
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  if (code === 'MAIN' || code === 'DEFAULT') return DEFAULT_ROOM;
  return CODE_RE.test(code) ? code : null;
}

function pathnameFor(room) {
  return `${PATH_PREFIX}${room}.json`;
}

async function streamToString(stream) {
  if (!stream) return '';
  if (typeof Response !== 'undefined') {
    return new Response(stream).text();
  }
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function isValidPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (!Array.isArray(payload.transactions)) return false;
  if (!Array.isArray(payload.categories)) return false;
  if (payload.transactions.length > 50_000) return false;
  if (payload.categories.length > 500) return false;
  return true;
}

function normalizeEtag(etag) {
  if (!etag || typeof etag !== 'string') return null;
  // Strip weak validator prefix that some proxies add
  return etag.replace(/^W\//i, '').trim();
}

async function readHousehold(room, ifNoneMatch) {
  const pathname = pathnameFor(room);
  const result = await get(pathname, {
    access: 'private',
    useCache: false,
    token: blobToken(),
    ifNoneMatch: ifNoneMatch || undefined
  });

  if (!result) {
    return { status: 404, etag: null, payload: null };
  }

  if (result.statusCode === 304) {
    return { status: 304, etag: normalizeEtag(result.blob.etag), payload: null };
  }

  const text = await streamToString(result.stream);
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return { status: 500, etag: null, payload: null, error: 'corrupt_blob' };
  }

  return { status: 200, etag: normalizeEtag(result.blob.etag), payload };
}

module.exports = async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    if (req.method === 'GET') {
      const room = resolveRoom(req.query?.code);
      if (!room) {
        return json(res, 400, { error: 'invalid_code' });
      }

      const ifNoneMatch = normalizeEtag(
        (typeof req.headers['if-none-match'] === 'string' && req.headers['if-none-match']) ||
        (typeof req.query?.etag === 'string' && req.query.etag) ||
        ''
      ) || undefined;

      const result = await readHousehold(room, ifNoneMatch);

      if (result.status === 404) {
        // Empty room — not an error for default shared store
        return json(res, 200, {
          payload: {
            version: 1,
            updatedAt: null,
            transactions: [],
            categories: [],
            deletedTransactionIds: [],
            empty: true
          },
          etag: null,
          room
        });
      }
      if (result.status === 304) {
        res.statusCode = 304;
        if (result.etag) {
          res.setHeader('ETag', result.etag);
          res.setHeader('X-Sync-ETag', result.etag);
        }
        res.setHeader('Cache-Control', 'no-store');
        res.end();
        return;
      }
      if (result.status === 500) {
        return json(res, 500, { error: result.error || 'server_error' });
      }

      return json(
        res,
        200,
        { payload: result.payload, etag: result.etag, room },
        result.etag ? { ETag: result.etag, 'X-Sync-ETag': result.etag } : {}
      );
    }

    if (req.method === 'PUT') {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          return json(res, 400, { error: 'invalid_json' });
        }
      }
      if (!body || typeof body !== 'object') {
        return json(res, 400, { error: 'invalid_body' });
      }

      const room = resolveRoom(body.code);
      if (!room) {
        return json(res, 400, { error: 'invalid_code' });
      }

      const payload = body.payload;
      if (!isValidPayload(payload)) {
        return json(res, 400, { error: 'invalid_payload' });
      }

      const serialized = JSON.stringify(payload);
      if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) {
        return json(res, 413, { error: 'payload_too_large' });
      }

      const baseEtag = normalizeEtag(
        (typeof body.baseEtag === 'string' && body.baseEtag) ||
        (typeof req.headers['if-match'] === 'string' && req.headers['if-match']) ||
        ''
      );

      const pathname = pathnameFor(room);
      const stamp = {
        ...payload,
        version: 1,
        updatedAt: new Date().toISOString()
      };
      const bodyStr = JSON.stringify(stamp);

      try {
        const putOpts = {
          access: 'private',
          contentType: 'application/json',
          addRandomSuffix: false,
          cacheControlMaxAge: 60,
          allowOverwrite: true,
          token: blobToken()
        };
        if (baseEtag) {
          putOpts.ifMatch = baseEtag;
        }

        const saved = await put(pathname, bodyStr, putOpts);
        const etag = normalizeEtag(saved.etag);
        return json(
          res,
          200,
          { ok: true, etag, updatedAt: stamp.updatedAt, room },
          etag ? { ETag: etag, 'X-Sync-ETag': etag } : {}
        );
      } catch (err) {
        if (err instanceof BlobPreconditionFailedError || err?.name === 'BlobPreconditionFailedError') {
          const current = await readHousehold(room);
          return json(res, 409, {
            error: 'conflict',
            payload: current.payload,
            etag: current.etag,
            room
          });
        }
        throw err;
      }
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (err) {
    console.error('[api/sync]', err);
    return json(res, 500, { error: 'server_error', message: err?.message || String(err) });
  }
};

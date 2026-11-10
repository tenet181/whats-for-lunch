export function ok(res, data, status = 200) {
  res.status(status).json({ ok: true, data });
}

export function fail(res, status, code, message, fields) {
  const error = { code, message };
  if (fields && Object.keys(fields).length > 0) error.fields = fields;
  res.status(status).json({ ok: false, error });
}

export function clientIp(req) {
  const raw = req.ip || (req.socket && req.socket.remoteAddress) || '';
  return String(raw).replace(/^::ffff:/, '');
}

export function isJsonRequest(req) {
  const type = String(req.headers['content-type'] || '');
  return type.toLowerCase().includes('application/json');
}

export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return url.host === req.headers.host;
  } catch {
    return false;
  }
}

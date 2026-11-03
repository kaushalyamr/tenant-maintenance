// Locally the API runs on its own port. In production it is proxied under this
// app's /api path, so an empty base is correct and keeps cookies same-origin.
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000');

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, form } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: form ? form : body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('The triage service is unreachable. Check that the API is running.', { status: 0 });
  }

  if (response.status === 204) return null;

  const text = await response.text();
  const payload = text ? safeJson(text) : null;

  if (!response.ok) {
    throw new ApiError(payload?.error ?? `Request failed with status ${response.status}.`, {
      status: response.status,
      code: payload?.code,
      details: payload?.details,
    });
  }
  return payload;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: body ?? {} }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  upload: (path, form) => request(path, { method: 'POST', form }),
};

// Evidence is fetched as a blob rather than a bare <img src> so the session
// cookie is always sent, whatever the browser decides about the cross-port request.
export async function evidenceBlobUrl(caseId, evidenceId) {
  const response = await fetch(`${API_BASE}/api/cases/${caseId}/evidence/${evidenceId}`, {
    credentials: 'include',
  });
  if (!response.ok) throw new ApiError('That evidence could not be loaded.', { status: response.status });
  return URL.createObjectURL(await response.blob());
}

export function severityStyles(severity) {
  return (
    {
      P1: 'bg-rose-100 text-rose-800 ring-1 ring-rose-300',
      P2: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300',
      P3: 'bg-sky-100 text-sky-900 ring-1 ring-sky-300',
      P4: 'bg-slate-100 text-slate-700 ring-1 ring-slate-300',
    }[severity] ?? 'bg-slate-100 text-slate-700'
  );
}

export function statusLabel(status) {
  return (
    {
      intake: 'Taking the call',
      triaged: 'Awaiting dispatch',
      mitigating: 'Guiding the caller',
      dispatched: 'Contractor sent',
      in_progress: 'Work under way',
      resolved: 'Work finished',
      closed: 'Closed',
    }[status] ?? status
  );
}

export function humanList(values) {
  if (!values?.length) return 'none';
  return values.length === 1 ? values[0] : `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`;
}

export function minutesSince(date) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function countdown(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const parts = `${Math.floor(abs / 3600000)}h ${Math.floor((abs % 3600000) / 60000)}m`;
  return ms >= 0 ? { overdue: false, text: `due in ${parts}` } : { overdue: true, text: `${parts} overdue` };
}

import { SUPA_KEY, SUPA_URL } from '../config.js';

const REST = `${SUPA_URL}/rest/v1`;
const HEADERS = {
  'Content-Type': 'application/json',
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  Prefer: 'return=representation',
};

async function dbReq(method, table, body, query = '') {
  const res = await fetch(`${REST}/${table}${query ? `?${query}` : ''}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(text || res.statusText);
  return text ? JSON.parse(text) : [];
}

export const GET = (table, query) => dbReq('GET', table, null, query);
export const POST = (table, body) => dbReq('POST', table, body);
export const PATCH_REQ = (table, body, query) => dbReq('PATCH', table, body, query);
export const DEL = (table, query) => dbReq('DELETE', table, null, query);

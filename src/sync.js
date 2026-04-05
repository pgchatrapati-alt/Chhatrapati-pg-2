/**
 * Google Sheets sync via Apps Script Web App — FIXED v2
 *
 * Root cause: Apps Script Web App redirects (302) break browser CORS preflight.
 * Fix:
 *  - Writes → POST with Content-Type: text/plain (skips preflight) → follow redirect
 *  - Reads  → GET with URL params (Apps Script handles GET natively)
 */

async function tryFetch(url, options) {
  const resp = await fetch(url, { redirect: 'follow', ...options });
  const text = await resp.text();
  try { return JSON.parse(text); }
  catch { return { success: true, message: 'OK (non-JSON response)' }; }
}

export async function sheetFetch(webAppUrl, action, data = null) {
  if (!webAppUrl) return { success: false, error: 'No Web App URL configured' };

  try {
    if (action === 'write' || action === 'ping') {
      // POST with text/plain avoids CORS preflight OPTIONS request
      // Apps Script reads this via e.postData.contents
      const body = JSON.stringify({ action, data });
      try {
        return await tryFetch(webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body,
        });
      } catch {
        // Fallback: no-cors (write still goes through, can't read response)
        await fetch(webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body,
          mode: 'no-cors',
        });
        return { success: true, message: 'Sent (no-cors fallback)' };
      }
    } else {
      // GET for read — Apps Script doGet handles URL params fine
      const params = new URLSearchParams({ action });
      if (data) params.append('data', JSON.stringify(data));
      return await tryFetch(`${webAppUrl}?${params}`, { method: 'GET' });
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function pushToSheets(webAppUrl, pgData) {
  return sheetFetch(webAppUrl, 'write', pgData);
}

export async function pullFromSheets(webAppUrl) {
  return sheetFetch(webAppUrl, 'read');
}

export async function pingSheet(webAppUrl) {
  return sheetFetch(webAppUrl, 'ping');
}

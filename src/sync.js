/**
 * Google Sheets sync — Fire & Forget write for max speed
 * Write: no-cors POST (doesn't wait for response — instant return)
 * Read:  GET with full response
 */

export async function pushToSheets(webAppUrl, pgData) {
  if (!webAppUrl) return { success: false, error: 'No URL' };
  try {
    // Fire-and-forget: no-cors means browser sends immediately, doesn't wait
    fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'write', data: pgData }),
      mode: 'no-cors',   // skip preflight + skip waiting for response
      keepalive: true,   // send even if page navigates away
    });
    return { success: true, message: 'Sent' };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

export async function pullFromSheets(webAppUrl) {
  if (!webAppUrl) return { success: false, error: 'No URL' };
  try {
    const params = new URLSearchParams({ action: 'read' });
    const resp = await fetch(`${webAppUrl}?${params}`, {
      method: 'GET',
      redirect: 'follow',
    });
    const text = await resp.text();
    return JSON.parse(text);
  } catch(e) {
    return { success: false, error: e.message };
  }
}

export async function pingSheet(webAppUrl) {
  if (!webAppUrl) return { success: false, error: 'No URL' };
  try {
    const resp = await fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'ping' }),
      redirect: 'follow',
    });
    const text = await resp.text();
    return JSON.parse(text);
  } catch(e) {
    return { success: false, error: e.message };
  }
}

/**
 * Google Sheets sync via Apps Script Web App
 * Uses JSONP-style GET requests to avoid CORS issues
 */

export async function sheetFetch(webAppUrl, action, data = null) {
  if (!webAppUrl) return { success: false, error: 'No Web App URL configured' };

  const params = new URLSearchParams({ action });
  if (data) params.append('data', JSON.stringify(data));

  try {
    const resp = await fetch(`${webAppUrl}?${params.toString()}`, {
      method: 'GET',
      redirect: 'follow',
    });
    const text = await resp.text();
    return JSON.parse(text);
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

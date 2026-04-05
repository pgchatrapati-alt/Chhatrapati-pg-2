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
  console.log('📥 Response text (first 300): ', text.substring(0, 300));
  try { return JSON.parse(text); }
  catch { return { success: true, message: 'OK (non-JSON response)' }; }
}

export async function sheetFetch(webAppUrl, action, data = null) {
  if (!webAppUrl) return { success: false, error: 'No Web App URL configured' };

  try {
    if (action === 'write' || action === 'ping') {
      // POST with text/plain avoids CORS preflight OPTIONS request
      // Apps Script reads this via e.postData.contents
      
      let body;
      if (action === 'write' && data) {
        // For write: spread pgData directly so body is {action, Sunshine: [...], Haridarshan: [...], ...}
        // This avoids issues with undefined values in nested structures
        console.log('📡 [BUILD WRITE BODY] Spreading pgData directly');
        body = JSON.stringify({ action, ...data });
      } else {
        // For ping: normal structure
        body = JSON.stringify({ action, data });
      }
      
      console.log('📡 [BEFORE SEND] Final POST body (first 500): ', body.substring(0, 500));
      console.log('📡 [BEFORE SEND] Body length: ', body.length);
      
      try {
        return await tryFetch(webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body,
        });
      } catch (err) {
        console.error('❌ POST fetch error:', err.message);
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
    console.error('❌ sheetFetch error:', e.message);
    return { success: false, error: e.message };
  }
}

export async function pushToSheets(webAppUrl, pgData) {
  console.log('🔵 === pushToSheets CALLED ===');
  console.log('  Checking input pgData...');
  console.log('  Type:', typeof pgData);
  console.log('  Is null:', pgData === null);
  console.log('  Keys:', pgData ? Object.keys(pgData) : 'N/A');
  
  if (!pgData || typeof pgData !== 'object' || Array.isArray(pgData)) {
    console.error('❌ EARLY FAIL: Invalid pgData', pgData);
    return { success: false, error: 'Invalid pgData' };
  }
  
  console.log('  ✓ pgData structure looks good');
  
  // Build sanitized - INCLUDE ALL PGs (even empty arrays)
  const sanitized = {};
  let pgCount = 0;
  let totalTenants = 0;
  
  Object.keys(pgData).forEach(pgName => {
    const tenants = pgData[pgName];
    // Include ALL PGs, even if array is empty
    if (Array.isArray(tenants)) {
      sanitized[pgName] = tenants;
      pgCount++;
      totalTenants += tenants.length;
      console.log(`  ✓ Added ${pgName}: ${tenants.length} tenants`);
    } else if (tenants && typeof tenants === 'object' && !Array.isArray(tenants)) {
      // If it's an object but not array, might be issue, but try to handle
      console.log(`  ⚠️ ${pgName}: Not an array (type=${typeof tenants}), skipping`);
    } else {
      console.log(`  ✗ Skipped ${pgName}: invalid value`);
    }
  });
  
  console.log(`✓ Sanitized: ${pgCount} PGs with ${totalTenants} total tenants`);
  console.log('  Sanitized keys:', Object.keys(sanitized));
  
  if (Object.keys(sanitized).length === 0) {
    console.error('❌ SANITIZATION FAILED: Empty result!');
    console.log('  Original pgData keys:', Object.keys(pgData));
    Object.keys(pgData).forEach(key => {
      const val = pgData[key];
      console.log(`    ${key}: type=${typeof val}, isArray=${Array.isArray(val)}, value=${JSON.stringify(val).substring(0, 100)}`);
    });
    return { success: false, error: 'Sanitization produced empty data' };
  }
  
  // Build the body - spread pgData directly with action
  const body = JSON.stringify({ action: 'write', ...sanitized });
  console.log('📡 POST body created:');
  console.log('  Body length:', body.length, 'chars');
  console.log('  Verifying structure - keys in body:', Object.keys(JSON.parse(body)));
  
  // CRITICAL: Show what each PG in the body looks like
  const parsed = JSON.parse(body);
  Object.keys(parsed).forEach(key => {
    if (key !== 'action') {
      const val = parsed[key];
      console.log(`  📦 Body.${key}: ${Array.isArray(val) ? val.length + ' items' : typeof val}`);
    }
  });
  
  return sheetFetch(webAppUrl, 'write', sanitized);
}

export async function pullFromSheets(webAppUrl) {
  return sheetFetch(webAppUrl, 'read');
}

export async function pingSheet(webAppUrl) {
  return sheetFetch(webAppUrl, 'ping');
}

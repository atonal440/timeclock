/**
 * Cloudflare Worker for Timeclock Sync Layer
 *
 * Handles sync operations between phone/desktop clients and Cloudflare KV.
 * - GET /api/sync: fetch all entries
 * - POST /api/sync: push entries (upsert)
 * - Scheduled handler for hourly cron (exports to hledger format)
 */

const KV_NAMESPACE = 'timeclock-sync'

/**
 * Entry key format: DATETIME:TYPE (e.g., "2025-06-01T09:00:00Z:i")
 * This ensures uniqueness by {datetime, type} tuple
 */
function getEntryKey(datetime, type) {
  return `${datetime}:${type}`
}

/**
 * Validate entry object structure
 */
function isValidEntry(entry) {
  if (!entry || typeof entry !== 'object') return false
  if (!entry.type || !['i', 'o'].includes(entry.type)) return false
  if (!entry.datetime || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(entry.datetime)) return false
  // account is optional for 'o' type, required for 'i' type
  if (entry.type === 'i' && !entry.account) return false
  return true
}

/**
 * GET /api/sync - Fetch all entries from KV
 */
async function handleGetSync(env) {
  try {
    const kv = env[KV_NAMESPACE]
    if (!kv) {
      return new Response(
        JSON.stringify({ error: 'KV namespace not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // List all keys with ":" (entry keys, not timeclock.journal)
    const listResult = await kv.list({ prefix: '2' }) // dates start with year digit
    const entries = []
    const now = new Date().toISOString()

    for (const key of listResult.keys) {
      if (!key.name.includes(':')) continue // skip non-entry keys
      const data = await kv.get(key.name, 'json')
      if (data) entries.push(data)
    }

    // Sort by datetime
    entries.sort((a, b) => a.datetime.localeCompare(b.datetime))

    return new Response(
      JSON.stringify({ entries, lastSync: now }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Error in GET /api/sync:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * POST /api/sync - Upsert entries to KV
 */
async function handlePostSync(env, request) {
  try {
    const kv = env[KV_NAMESPACE]
    if (!kv) {
      return new Response(
        JSON.stringify({ error: 'KV namespace not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body = await request.json()
    if (!Array.isArray(body.entries)) {
      return new Response(
        JSON.stringify({ error: 'Expected {entries: [...]}' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const errors = []
    let synced = 0

    for (const entry of body.entries) {
      if (!isValidEntry(entry)) {
        errors.push(`Invalid entry: ${JSON.stringify(entry)}`)
        continue
      }

      const key = getEntryKey(entry.datetime, entry.type)
      const now = new Date().toISOString()
      const entryWithTimestamp = { ...entry, syncedAt: entry.syncedAt || now }

      await kv.put(key, JSON.stringify(entryWithTimestamp))
      synced++
    }

    return new Response(
      JSON.stringify({ success: true, synced, errors: errors.length > 0 ? errors : undefined }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Error in POST /api/sync:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Scheduled handler - runs hourly to export entries to hledger format
 */
async function handleScheduled(env) {
  try {
    const kv = env[KV_NAMESPACE]
    if (!kv) {
      console.error('KV namespace not configured')
      return
    }

    // Fetch all entries
    const listResult = await kv.list({ prefix: '2' })
    const entries = []

    for (const key of listResult.keys) {
      if (!key.name.includes(':')) continue
      const data = await kv.get(key.name, 'json')
      if (data) entries.push(data)
    }

    // Sort by datetime
    entries.sort((a, b) => a.datetime.localeCompare(b.datetime))

    // Convert to hledger format
    const lines = []
    for (const entry of entries) {
      const dt = new Date(entry.datetime)
      const dateStr = dt.toISOString().split('T')[0].replace(/-/g, '/')
      const timeStr = dt.toISOString().split('T')[1].substring(0, 5)

      if (entry.type === 'i') {
        lines.push(`i ${dateStr} ${timeStr} ${entry.account}`)
      } else if (entry.type === 'o') {
        lines.push(`o ${dateStr} ${timeStr}`)
      }
    }

    const hledgerContent = lines.join('\n')

    // Store as backup in KV
    await kv.put('timeclock.journal', hledgerContent, { expirationTtl: 86400 * 30 }) // 30 day retention

    console.log(`Exported ${entries.length} entries to timeclock.journal`)
  } catch (err) {
    console.error('Error in scheduled handler:', err)
  }
}

/**
 * Main request handler
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // Route requests
    if (url.pathname === '/api/sync') {
      if (request.method === 'GET') {
        const response = await handleGetSync(env)
        // Add CORS headers to response
        for (const [key, value] of Object.entries(corsHeaders)) {
          response.headers.set(key, value)
        }
        return response
      } else if (request.method === 'POST') {
        const response = await handlePostSync(env, request)
        for (const [key, value] of Object.entries(corsHeaders)) {
          response.headers.set(key, value)
        }
        return response
      }
    }

    return new Response('Not Found', { status: 404 })
  },

  async scheduled(event, env, ctx) {
    await handleScheduled(env)
  },
}

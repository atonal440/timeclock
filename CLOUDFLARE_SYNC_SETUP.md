# Cloudflare Sync Layer Setup Guide

This guide walks through deploying the Cloudflare Worker that powers the sync layer for TimeClock.

## Architecture Overview

```
Phone (PWA) → Worker API → Cloudflare KV ← Desktop (PWA)
                ↓
            [Hourly cron job exports to hledger format]
```

- **Phone**: Clock in/out, auto-pushes new entries to cloud, stores locally
- **Worker**: Handles `/api/sync` endpoints (GET to fetch all entries, POST to upsert)
- **KV**: Single source of truth, stores entries by `{datetime}:{type}` key
- **Desktop**: Can pull latest entries from cloud to stay in sync
- **Cron**: Hourly job exports all entries to hledger format for backup/audit

## Prerequisites

1. **Cloudflare Account** — Free account is sufficient
2. **Wrangler CLI** — Install via `npm install -g @cloudflare/wrangler` or `npm i wrangler` locally
3. **Git** — To manage the code

## Deployment Steps

### 1. Create a Cloudflare KV Namespace

```bash
# Authenticate with Cloudflare
wrangler login

# Create a KV namespace for production
wrangler kv:namespace create "timeclock-sync"

# (Optional) Create a preview namespace for testing
wrangler kv:namespace create "timeclock-sync" --preview
```

Note the namespace IDs returned—you'll need these in the next step.

### 2. Update `wrangler.toml`

Edit `wrangler.toml` and fill in your Cloudflare credentials:

```toml
account_id = "your-account-id"        # Found in Cloudflare dashboard
workers_dev = true

[[kv_namespaces]]
binding = "timeclock-sync"
id = "production-namespace-id"         # From step 1
preview_id = "preview-namespace-id"    # From step 1

[triggers]
crons = ["0 * * * *"]                  # Hourly at :00
```

### 3. Update the Sync Endpoint URL in `index.html`

Find this line in `index.html` (around line 475):

```javascript
const SYNC_ENDPOINT = 'https://timeclock.example.com/api/sync';
```

Replace with your actual Worker URL after deployment (you'll get this from Wrangler). Initially, use your `workers.dev` URL:

```javascript
const SYNC_ENDPOINT = 'https://timeclock-sync.your-username.workers.dev/api/sync';
```

### 4. Deploy the Worker

```bash
wrangler publish
# or for newer versions:
wrangler deploy
```

This will:
- Create a Worker at `https://timeclock-sync.your-username.workers.dev/`
- Create the `/api/sync` endpoint
- Enable hourly cron job (runs at minute 0 of each hour)

### 5. (Optional) Set Up Custom Domain

If you want to use a custom domain (e.g., `timeclock.yourdomain.com`):

1. Add the domain to your Cloudflare zone
2. In `wrangler.toml`, set:
   ```toml
   [env.production]
   route = "https://timeclock.yourdomain.com/api/sync"
   zone_id = "your-zone-id"
   ```
3. Redeploy: `wrangler publish`

## Testing

### Test the Worker Locally

```bash
wrangler dev
# This starts a local server at http://localhost:8787
```

Open a new terminal and test the endpoints:

```bash
# Test GET
curl http://localhost:8787/api/sync

# Test POST
curl -X POST http://localhost:8787/api/sync \
  -H "Content-Type: application/json" \
  -d '{"entries":[{"type":"i","datetime":"2025-06-01T09:00:00Z","account":"Client:Project"}]}'
```

### Test from the App

1. Navigate to `http://localhost:8000` (or your deployment URL)
2. Clock in/out normally
3. Click the ☁ sync button (top-right)
4. Should see a toast "Synced X entries"
5. Check browser console for any errors

## Monitoring & Debugging

### View Worker Logs

```bash
wrangler tail
# Shows real-time logs from your Worker
```

### View KV Data

```bash
wrangler kv:key list --namespace-id your-namespace-id
# List all keys in KV

wrangler kv:key get "2025-06-01T09:00:00Z:i" --namespace-id your-namespace-id
# Get a specific entry
```

### Check Cron Job Runs

Cron jobs are logged in `wrangler tail`. Look for "Exported N entries to timeclock.journal" messages at :00 of each hour.

## Troubleshooting

**Issue: "CORS error" when syncing**
- This shouldn't happen as the Worker has CORS headers enabled
- Check browser console for full error message
- Ensure `SYNC_ENDPOINT` in `index.html` is correct

**Issue: Sync button not working**
- Check if `SYNC_ENDPOINT` in `index.html` matches your deployed Worker URL
- Open browser console (F12) and check for network errors
- Try `wrangler dev` locally to test without deploying

**Issue: Cron job not running**
- Check `wrangler tail` to see if it's being triggered
- Verify `crons = ["0 * * * *"]` is in `wrangler.toml`
- Cron runs at minute 0 of each hour UTC
- Logs should appear every hour at :00

**Issue: KV not retaining data**
- KV should persist indefinitely; check you're using the right namespace binding
- Try querying KV via `wrangler kv:key list` to verify data is there
- If entries disappear, check if `expirationTtl` is set too short

## Security Notes

- This implementation has **CORS enabled for all origins** (`*`)
- For production, consider restricting to your domain:
  ```javascript
  'Access-Control-Allow-Origin': 'https://yourdomain.com'
  ```

- KV data is stored in Cloudflare's database; it's encrypted at rest
- If you need extra privacy, implement token-based auth on the Worker

## Next Steps

1. **Verify your Worker is running** via `wrangler tail`
2. **Update `index.html` sync endpoint** to your actual Worker URL
3. **Test locally first** with `wrangler dev` before production deployment
4. **Monitor the cron job** to ensure hourly exports work
5. **Back up your data** by periodically downloading the hledger exports

## Manual Export from KV

If you need to export entries as hledger format without waiting for the cron:

```bash
# Get the timeclock.journal content from KV
wrangler kv:key get "timeclock.journal" --namespace-id your-namespace-id > timeclock.journal
```

Then import into your local app via the "Log" tab → "Import & Merge".

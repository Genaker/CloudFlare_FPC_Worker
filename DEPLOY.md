# CloudFlare FPC Worker — Deployment Guide

Full-page cache worker for Magento 2 running on Cloudflare Workers with KV + R2 storage.

---

## Quick start (recommended)

### Option A — Python (no wrangler CLI required)

```bash
pip install -r requirements.txt
python deploy.py
```

Interactive menu that calls the Cloudflare REST API directly.
Credentials are saved to `.fpc-deploy.json` for re-use.

### Option B — Bash + Wrangler

```bash
chmod +x install.sh
./install.sh
```

Creates KV/R2 via `wrangler` CLI, patches `wrangler.toml`, and deploys.

---

## Method 1 — Wrangler CLI (manual)

### Prerequisites

- Node.js 18+
- Wrangler: `npm install -g wrangler`
- A Cloudflare account with Workers, KV Storage, and R2 access

### Step 1 — Authenticate

```bash
wrangler login
```

### Step 2 — Create KV namespace

```bash
wrangler kv namespace create "FPC_KV"
```

Copy the `id` from the output and paste it into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "KV"
id      = "<paste id here>"
```

Optionally create a preview namespace for `wrangler dev`:

```bash
wrangler kv namespace create "FPC_KV" --preview
```

Uncomment and fill in `preview_id` in `wrangler.toml`.

### Step 3 — Create R2 bucket

```bash
wrangler r2 bucket create fpc-cache
```

The bucket name is already set in `wrangler.toml`. Change `bucket_name` if you used a different name.

### Step 4 — Configure routes

Edit the `routes` section of `wrangler.toml`:

```toml
routes = [
  { pattern = "example.com/*", zone_name = "example.com" }
]
```

Replace `example.com` with your actual domain.

### Step 5 — Set environment variables

Edit the `[vars]` section of `wrangler.toml` to adjust defaults:

| Variable | Default | Description |
|---|---|---|
| `ENV_DEBUG` | `false` | Expose internal cache headers |
| `ENV_SPECULATION_ENABLED` | `true` | Inject Speculation Rules |
| `ENV_R2_STALE` | `true` | Serve stale R2 while fresh copy fetches |
| `ENV_R2_SERVER_RACE` | `true` | Race R2 vs origin |
| `ENV_REVALIDATE_AGE` | `360` | Revalidate CDN entries older than N seconds |
| `ENV_GOD_MOD` | `false` | Lock all cache invalidations (100 % static) |
| `ENV_PWA_ENABLED` | `true` | Inject PWA manifest link |

### Step 6 — Set secrets

Secrets must never go in `wrangler.toml`. Use `wrangler secret put`:

```bash
wrangler secret put ENV_CLOUDFLARE_API_KEY
```

### Step 7 — Deploy

```bash
wrangler deploy
```

To deploy to the preview environment:

```bash
wrangler deploy --env preview
```

### Verify

```bash
curl -sI https://example.com/ | grep -i 'x-html-edge-cache-status\|cache-control\|cf-cache-status'
```

A cold request returns `Miss` or `FetchedOrigin`. The second request returns `Hit`.

---

## Method 2 — Python deploy tool (no wrangler, no Terraform)

`deploy.py` talks directly to the Cloudflare REST API. It is the fastest way to deploy from any machine with Python 3.10+ — no Node.js or wrangler CLI required.

### Prerequisites

- Python 3.10+
- A Cloudflare API token (same permissions as above)

### Step 1 — Install dependencies

```bash
pip install -r requirements.txt
```

`requests` is required. `rich` is optional but strongly recommended for the coloured interactive interface.

### Step 2 — Run

```bash
python deploy.py
```

The tool presents a numbered menu:

```
  1.  Deploy / update worker
  2.  Update environment variables only
  3.  Purge cache  (increment version)
  4.  Check live cache status
  5.  Show saved config
  6.  Delete worker + route
  7.  Exit
```

On first run, choose **1** — you will be prompted for your API token, Account ID, Zone ID, domain, and resource names. All values are saved to `.fpc-deploy.json` for subsequent runs.

> **Keep `.fpc-deploy.json` out of version control** — it contains your API token.

### Non-interactive (CI / scripts)

After an initial interactive run, re-deploy without prompts:

```bash
python deploy.py --deploy
```

Use a custom config path:

```bash
python deploy.py --config /path/to/secrets.json --deploy
```

### Environment variables

Choose **2** from the menu to edit variables without touching credentials, then optionally re-deploy immediately.

### Cache management from the menu

| Option | What it does |
|---|---|
| 3 | Sends `GET /?cf-version=purge` → HTTP 222, increments version |
| 4 | Hits the live URL and prints all cache-related response headers |

---

## Method 3 — Terraform (infrastructure as code)

Terraform manages the KV namespace, R2 bucket, worker script, and route as declarative resources. Ideal for team environments or automated CI/CD pipelines.

### Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) 1.3+
- A Cloudflare API token with these permissions:
  - Workers Scripts: Edit
  - Workers KV Storage: Edit
  - Workers R2 Storage: Edit
  - Zone: Zone: Read
  - Zone: Zone Settings: Edit

### Step 1 — Configure variables

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
cloudflare_api_token  = "YOUR_API_TOKEN"
cloudflare_account_id = "YOUR_ACCOUNT_ID"
cloudflare_zone_id    = "YOUR_ZONE_ID"
domain                = "example.com"
```

Find IDs in the Cloudflare dashboard:
- **Account ID** → Workers & Pages → Overview (right sidebar)
- **Zone ID** → your domain → Overview (right sidebar)

> **NEVER commit `terraform.tfvars`** — add it to `.gitignore`.

### Step 2 — Initialize

```bash
cd terraform
terraform init
```

### Step 3 — Plan

```bash
terraform plan
```

Review the planned changes before applying.

### Step 4 — Apply

```bash
terraform apply
```

Terraform will create:
- `cloudflare_workers_kv_namespace.fpc_kv`
- `cloudflare_r2_bucket.fpc_cache`
- `cloudflare_worker_script.fpc`
- `cloudflare_worker_route.fpc_route`

The KV namespace ID and other values are printed as outputs.

### Outputs

| Output | Description |
|---|---|
| `kv_namespace_id` | KV namespace ID (also written to `wrangler.toml` if using Wrangler) |
| `r2_bucket_name` | R2 bucket name |
| `worker_name` | Deployed worker name |
| `worker_route` | Route pattern the worker handles |

### Updating the worker

After editing `FPC.js`, re-run:

```bash
terraform apply
```

Terraform detects the script content change and redeploys automatically.

### Destroy

```bash
terraform destroy
```

---

## Cache management

### Check cache status

```bash
curl -sI https://example.com/ | grep x-html-edge-cache-status
```

Status values: `Miss`, `FetchedOrigin`, `CachingAsync`, `Hit`, `Stale`, `BYPASS`

### Purge all pages (increment cache version)

```bash
curl -s "https://example.com/?cf-version=purge"
```

Returns HTTP 222. All cached pages become stale and are re-fetched on next request.

### Purge a single URL

```bash
curl -s "https://example.com/path/to/page?cf-delete=true"
```

Returns HTTP 211 with `Deleted: true`.

### View current cache version

```bash
curl -sI "https://example.com/?cf-version" | grep x-html-edge-cache-version
```

---

## Worker routes

The worker intercepts all requests matching `example.com/*`. Certain URL patterns bypass the cache automatically:

| Pattern | Bypass reason |
|---|---|
| `/checkout*` | Checkout flow |
| `/customer*` | Account pages |
| `/cart*` | Cart |
| `/rest/*` | REST API |
| `?cfw=false` | Manual bypass |
| Admin cookie present | Logged-in admin |

---

## Development & preview

Deploy to the preview environment (separate KV + R2):

```bash
wrangler deploy --env preview
```

Run locally with Miniflare (no live site required):

```bash
npm install
npm run test:unit
```

---

## Troubleshooting

**Worker not caching pages**
- Check that the route pattern matches your domain exactly.
- Verify the KV namespace ID is set correctly in `wrangler.toml`.
- Enable debug mode (`ENV_DEBUG = "true"`) and inspect `x-html-edge-cache-status`.

**R2 not serving cached pages**
- Confirm the R2 bucket name in `wrangler.toml` matches the created bucket.
- Verify `ENV_R2_STALE = "true"` and `ENV_R2_SERVER_RACE = "true"`.

**Terraform apply fails — "resource already exists"**
- Import the existing resource: `terraform import cloudflare_workers_kv_namespace.fpc_kv <namespace_id>`

**Wrangler deploy fails — "KV namespace not found"**
- Confirm you used `wrangler kv namespace create` (not just `list`) and pasted the correct `id` into `wrangler.toml`.

---

## File reference

| File | Purpose |
|---|---|
| `FPC.js` | Worker source — the only file deployed to Cloudflare |
| `deploy.py` | Python interactive deploy tool (no wrangler needed) |
| `requirements.txt` | Python dependencies for `deploy.py` |
| `wrangler.toml` | Wrangler deployment config (routes, bindings, vars) |
| `install.sh` | Interactive bash auto-install script (uses wrangler) |
| `terraform/main.tf` | Terraform resource definitions |
| `terraform/variables.tf` | Input variable declarations |
| `terraform/outputs.tf` | Output values after apply |
| `terraform/terraform.tfvars.example` | Variable template (copy → `terraform.tfvars`) |
| `TESTING.md` | Test suite documentation |
| `.fpc-deploy.json` | Saved config for `deploy.py` (auto-created, do not commit) |

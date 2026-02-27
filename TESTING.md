# CloudFlare FPC Worker — Test Suite

Integration tests for the Magento 2 CloudFlare Full Page Cache Worker.

All tests make real HTTP requests to a live site running the deployed worker.
There is no mock layer — the suite validates actual caching behaviour.

---

## Test suites

| Suite | File | Requires live site? | Runner |
|---|---|---|---|
| **Unit** | `fpc.unit.test.js` | No — all fetches mocked | Vitest + Miniflare |
| **Integration** | `fpc.test.js` | **Yes** — `TEST_URL` must point to a deployed worker | Jest |

---

## Prerequisites

**Unit tests** — no live site required:
- Docker with a glibc-based image (see below), **or** Node.js 18+ locally

**Integration tests** — require:
- A Magento 2 site with the CloudFlare FPC Worker **already deployed**
- The site must be reachable over HTTPS
- Either **Docker** (recommended) or **Node.js 18+** installed locally

---

## Unit Tests (offline, no live site)

Unit tests run FPC.js inside **Miniflare** (the local Cloudflare Workers runtime).
All outbound `fetch()` calls are intercepted — no real network traffic.

### Build the unit-test image

Uses `node:20-slim` (Debian/glibc) because Miniflare's embedded `workerd`
binary requires glibc and cannot run on Alpine.

```bash
docker build -f Dockerfile.unit -t fpc-unit-tests /tmp/CloudFlare_FPC_Worker
```

### Run unit tests

```bash
docker run --rm fpc-unit-tests
```

No environment variables required. Exit code 0 = all 58 tests passed.

### Run unit tests locally (no Docker)

```bash
cd /tmp/CloudFlare_FPC_Worker
npm install
npm run test:unit          # single run
npm run test:unit:watch    # watch mode for development
```

---

## Integration Tests (requires live site)

## Running with Docker (recommended)

### 1. Build the image

```bash
docker build -t fpc-tests /tmp/CloudFlare_FPC_Worker
```

### 2. Run the tests

Pass `TEST_URL` at runtime — it must end with a trailing slash:

```bash
docker run --rm -e TEST_URL=https://www.yoursite.com/ fpc-tests
```

The container exits with code `0` on success, non-zero on any failure.

---

## Running with docker-compose

### 1. Copy the environment file

```bash
cp /tmp/CloudFlare_FPC_Worker/.env.example /tmp/CloudFlare_FPC_Worker/.env
```

### 2. Edit `.env` and set your site URL

```env
TEST_URL=https://www.yoursite.com/
```

### 3. Run

```bash
docker compose -f /tmp/CloudFlare_FPC_Worker/docker-compose.yml up --build
```

---

## Running locally (without Docker)

### 1. Install dependencies

```bash
cd /tmp/CloudFlare_FPC_Worker
npm install
```

### 2. Export `TEST_URL`

```bash
export TEST_URL=https://www.yoursite.com/
```

### 3. Run tests

| Command | Description |
|---|---|
| `npm test` | Standard run |
| `npm run test:verbose` | Show each test name as it runs |
| `npm run test:watch` | Re-run on file changes (development) |
| `npm run test:ci` | CI mode — serial, force-exit, no interactivity |

---

## CI / GitHub Actions example

```yaml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run offline unit tests
        run: |
          docker build -f Dockerfile.unit -t fpc-unit-tests .
          docker run --rm fpc-unit-tests

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests          # only run integration if unit tests pass
    steps:
      - uses: actions/checkout@v4
      - name: Run integration tests against live site
        run: |
          docker build -t fpc-tests .
          docker run --rm -e TEST_URL=${{ secrets.TEST_URL }} fpc-tests
```

Store the site URL as a repository secret named `TEST_URL`.

---

## Unit test coverage (58 tests, offline)

| Group | What is tested |
|---|---|
| **URL Bypass Patterns** | checkout, customer, cart, REST, PayPal, admin, ajax — all set `bypass-worker: true`; BYPASS_URL wins over CACHE_ALWAYS |
| **Cookie-Based Bypass** | `admin=` cookie → bypass; `X-Magento-Vary` is a VERSION_COOKIE, not a bypass; `form_key` not bypassed |
| **cfw=false Bypass** | `?cfw=false` sets bypass; `?cfw=true` does not |
| **HTTP Methods** | POST/PUT/DELETE/PATCH — no bypass-worker (no method-based bypass in FPC.js); no cache debug headers on non-GET |
| **Special Commands** | cf-purge → 222; cf-version → 223 with correct version; cf-delete → 211 with Deleted: true; version increments monotonically |
| **Cache Hit/Miss Flow** | Miss on first request (x-html-edge-cache-status contains Miss/FetchedOrigin); Hit on second (contains Hit); independent entries per URL |
| **FILTER_GET** | UTM params, fbclid, gclid, _ga, msclkid stripped → HIT from same cache entry; non-filtered params (page=) → separate cache entries |
| **CSP-RO Removal** | CSPRO absent on miss and hit; CSPRO preserved on bypass path (behaviour documented) |
| **Speculation Rules** | Uncached prerender → 406; cached prerender → 200; regular GET after 406 succeeds |
| **Non-Cacheable Status Codes** | 404 → 404; 500 → 500; non-200 responses not cached |
| **Speculation Rules JSON** | /rules/speculation.json → 200 application/speculationrules+json |
| **Timing Headers** | Worker-Time, JS-Time, Server-Timing always present on GET responses |
| **Cache Version** | x-html-edge-cache-version always a non-negative integer; cf-version= sets it for subsequent requests |

---

## Integration test coverage (live site required)

| Group | What is tested |
|---|---|
| **Caching basics** | Miss → Hit flow, cache headers present |
| **HTTP method bypass** | POST/PUT/DELETE never cached; HEAD cacheable |
| **Cookie-based bypass** | Admin cookie, X-Magento-Vary, form_key behaviour |
| **URL-pattern bypass** | `/checkout`, `/customer`, `/cart`, REST API, PayPal, etc. |
| **Worker bypass param** | `cfw=false` forces BYPASS,WORKER,MISS |
| **FILTER_GET stripping** | UTM params, fbclid, gclid, _ga, msclkid, etc. removed from cache key |
| **Version endpoint** | `cf-version=N` returns 223, sets cache-version header |
| **CSP-RO removal** | `content-security-policy-report-only` stripped from responses |
| **Non-cacheable codes** | 404 and 302 responses stay DYNAMIC |
| **R2 race parameter** | `r2-race=0/false` disables R2 parallel fetch |
| **Cache key integrity** | Key present on HIT, embeds version, version header always set |
| **Status state machine** | Miss → FetchedOrigin → CachingAsync → Hit → Stale after purge |
| **Speculation Rules** | Uncached prerender → 406; cached prerender → 200 |
| **Delete endpoint** | `cf-delete` returns 211, marks entry deleted |

---

## Troubleshooting

**`TEST_URL is not set`**
Supply `-e TEST_URL=https://yoursite.com/` to `docker run` or set it in `.env`.

**Tests time out**
The default timeout is 120 s per test. If your origin is slow, increase `testTimeout` in `jest.config.cjs`.

**All tests skipped / warnings about unexpected status codes**
The worker must be deployed on the target site. A plain Magento site without the worker will return unexpected headers.

**`npm install` vulnerabilities reported**
The warnings come from `js-crawler`'s transitive dependencies (test tooling only). They do not affect the worker itself (`FPC.js` has no npm dependencies at runtime).

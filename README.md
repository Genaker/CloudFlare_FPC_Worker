CloudFlare(CF) CDN Worker Full Page Cache(FPC) Layer for Magento 2.
It has become true. Now, it is Open Source and free. 
The original idea was the Shopify FPC cache from the CloudFlare CDN, AWS Cloud Front Lambda Edge S3 Buket, Akamai EdgeWorkers with Object Storage etc. and it is a part of our true Magento SaaS solution(Magneto)

![image](https://github.com/user-attachments/assets/1dcb535e-3d0d-4e0a-b399-9f331807420d)

# Deployment

You can deploy the worker in several ways:

## Deploy via Cloudflare Dashboard (Quick Start)

1. Create a Worker in Cloudflare Dashboard → Workers & Pages → Create Worker
2. Edit Code → Insert Code from Git → Connect to `https://github.com/Genaker/CloudFlare_FPC_Worker`
3. Configure KV binding and deploy
4. Add a route for your domain (e.g. `*yoursite.com/*`)

See the [Installation](#installation) section below for detailed steps.

## Deploy via Wrangler CLI

If you use Wrangler:

```bash
git clone https://github.com/Genaker/CloudFlare_FPC_Worker.git
cd CloudFlare_FPC_Worker
npm install
cp wrangler.toml.example wrangler.toml   # if available
# Edit wrangler.toml with your KV namespace and account ID
npx wrangler deploy
```

## Deploy via CI/CD (GitHub Actions, etc.)

You can add the worker to your CI pipeline. Example GitHub Actions step:

```yaml
- name: Deploy Cloudflare Worker
  run: |
    npm install -g wrangler
    wrangler deploy
  env:
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

Store your secrets in the repository settings and ensure your `wrangler.toml` has the correct KV namespace binding.

## Deploy via Terraform

Use the [cloudflare Terraform provider](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs) to deploy the worker as infrastructure-as-code:

```hcl
terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

variable "cloudflare_account_id" {}
variable "cloudflare_api_token" {}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

resource "cloudflare_workers_kv_namespace" "fpc_kv" {
  account_id = var.cloudflare_account_id
  title      = "fpc-cache"
}

resource "cloudflare_worker_script" "fpc" {
  account_id = var.cloudflare_account_id
  name       = "magento-fpc"
  content    = file("${path.module}/FPC.js")

  kv_namespace_binding {
    name         = "KV"
    namespace_id = cloudflare_workers_kv_namespace.fpc_kv.id
  }
}

resource "cloudflare_worker_route" "fpc_route" {
  zone_id     = var.cloudflare_zone_id
  pattern     = "*yoursite.com/*"
  script_name = cloudflare_worker_script.fpc.name
}
```

Run `terraform init`, `terraform plan`, then `terraform apply`. Ensure `FPC.js` and any required files are in the Terraform module path.

## Deploy via Python (cloudflare Python SDK)

Use the [cloudflare Python package](https://github.com/cloudflare/cloudflare-python) to deploy programmatically:

```python
from cloudflare import Cloudflare

api = Cloudflare(api_token="YOUR_API_TOKEN")
account_id = "YOUR_ACCOUNT_ID"

# Read worker script
with open("FPC.js", "r") as f:
    script_content = f.read()

# Create or update worker
api.workers.scripts.upload(
    account_id=account_id,
    script_name="magento-fpc",
    body={"script": script_content},
)

# Add KV binding (create namespace first via API or dashboard)
# api.workers.scripts.settings.update(...)
```

Install: `pip install cloudflare`. For full deployment including KV bindings and routes, use the Workers API endpoints for [Workers Scripts](https://developers.cloudflare.com/api/operations/worker-scripts-upload-worker), [KV Namespaces](https://developers.cloudflare.com/api/operations/workers-kv-namespace-create-namespace), and [Worker Routes](https://developers.cloudflare.com/api/operations/worker-routes-create-route).

# How it works
The Edge Worker Magento full-page cache feature helps you optimize eCommerce performance by caching your Magento backend server's generated HTML or API response. 

# Integration Jest tests
All functionality is covered with the Jest integration tests. You can test your website and you rule as well. 
Running the test:
```
export TEST_URL="https://******.com/"
npm install
npm test
```

## Run integration tests with Docker

```bash
TEST_URL=https://yoursite.com/ docker compose run --rm fpc-tests
```

## Unit tests (Vitest + Miniflare)

Unit tests run locally without a live site. They use Miniflare to emulate the Cloudflare Workers runtime.

```bash
npm run test:unit
```

Or with Docker:

```bash
docker compose run --rm fpc-unit
```

# Generate static HTML objects 
Run next command
```
node generate.js
```

# HTML CACHE VERSION
CF Edge Worker Magent Full-page cache intercepts incoming requests and checks if a cached version of the requested content is available in the CloudFlare locations or in the cache Reserve. This check for the cached version can have the following outcomes, depending on its state:

 - If a cached version is found and it's not stale, then the cached content is served to the user. No request is made to the Magento Server.
 - If a cached version is found and it is stale, then the cached content is served to the user. The CF worker is executed in the background and requests a new version of the page caches from the Magento backend server for future requests. CF FPC is revalidated from the server asynchronously after 5 minutes or so, but you can change the time and logic.
 - If a cached version isn't found, the CF FPC worker sends a request to the Magento server to be used for future requests.

CF Worker “softpurge” the cache by changing cache Version stored in the KV(Key Value)storage. Cloud flare serve the stale content untill it will not be updayed asynchronously (in the background) fetches the new page. Cloud Front ignores any cache rules from Magento and has own logic which serve web pages from the CDN cache even if Magento 2 website is broken. 
<br/>
Now, you can set *HTML_CACHE_VERSION* via the Cloud Flare dashboard by adding the variable **ENV_HTML_CACHE_VERSION**. It will override the default cache version logic and can't be purged except to set a new version from the dashboard.
<img width="401" alt="image" src="https://github.com/user-attachments/assets/0da62145-fe10-4b05-9fb6-23c12780567d">

# ENV VARIABLES
You can override many variables by setting the from the dashboard by adding **ENV_** prefix to the var name:
![image](https://github.com/user-attachments/assets/6fdc73d8-fe6e-41ad-ba7e-abc88aa1e12d)

# Worker GET parameters:

- **&cfw=false** - disable Cloud worker, bypass all worker logic 
- **&cf-cdn=false** - bypass Cloud Flare EDGE CDN cache, but R2 cache still works
- **&r2-cdn=false** - bypass R2 cache
- **&cf-revalidate=true** - revalidate URL in the cache
- **&cf-delete=true** - delete from the edge cache but not from R2
- **&cf-purge** - purge entire cache by changing cache version. called ONCE(1) - soft purge. TWICE(2) - hard purge. 

# Speculative Rules
Speculation is added to the worker response.

To Debug speculative rules, go to **DevTools** → Application → Speculative Load → Speculation:
![image](https://github.com/user-attachments/assets/9a14a6fe-9f5b-490d-a78e-a85d8d1eae40)


# Caching criteria
For CF FPC Worker to consider a response from a Magento backend as cacheable, the response must meet the following criteria:

 - Be a response to a GET request
 - Have a 2XX or 3XX status code.
 - Have a public Cache-Control header set with a non-zero max-age, or s-maxage, value
 - Url doesn't match the worker's blacklist

# Aditional features
- URL Query String Filtering and sorting 
- Traffic filtering and control
- Cache logic adjustment. You don't need any VCL now you can do everething in pure JavaScript
- Content manipulation
- Speculation rules prerender and prefetch
- Link header resource preload
- Custom CORS
- ESI (Edge Server Include - AJAX requests) blocks with auth and HTTPS support. Easy to use with microservices.
- GOD MOD - cache can't be invalidated. It can be but not easy.
- PWA installable APP 

# R2 and Cache Reserve

When R2 is configured (Ultra version), the worker can store and serve cached content from Cloudflare R2. This provides a persistent cache layer beyond the edge. The worker races R2 and the origin — whichever responds first is served. When the origin wins, the response is marked as `server-first` or `r2-null-server` in the `R2-cache` header. Both outcomes are valid; the cache is updated asynchronously.

Cache Reserve uses R2 under the hood and integrates with the worker for higher hit rates. Enable Cache Reserve in the Cloudflare dashboard to improve cache persistence.

# Worker and CF cache limitations:
 - The full-page cache is designed to work with the default magento cache, which is PHP Built-in FPC, FAST FPC (See repo: https://github.com/Genaker/FastFPC), or Varnish. You can try to use it as a main cache (see Cache Reserve), but it is not what it was designed for. ***The main idea of the CF Worker FPC Cache is Magento 2 pages are always served from the CF cache with async revalidation.**
 - You can't clear the cache by page. You can clear the entire cache only. That is why you need a default magento cache. However, it is designed to work without any cache clears. The worker will update it asynchronously. You mark the entire cache stale by changing its version. To hard clear the cache, you need to change the version twice. CF Worker checks the previous cache version to see if it is a stale cache.

## Installation

**Navigation:** Cloudflare Dashboard → **Workers & Pages** (or go to [dash.cloudflare.com](https://dash.cloudflare.com) and select Workers & Pages from the sidebar).

![image](https://github.com/user-attachments/assets/9366da1d-8c40-4d38-9834-7f16f9805c3b)

It is better to Upgrade the plan to a Bundle of 5$ per month. It is better and has no limitations.

![image](https://github.com/user-attachments/assets/51a1cbc3-0089-4b2b-bd3a-4ddf2ec35f55)

Bundle: 
![image](https://github.com/user-attachments/assets/9bcbee80-fe05-47a9-a075-6c9f5ee73c32)

Workers features
Includes 10 million requests per month 3

Up to 50ms CPU time per request
Always lowest latency
Key-value storage features 4
10 million read operations per month
1 million write, delete, list operations per month

# Create KV (KeyValue) Storage to keep the cache version and some global settings 

![image](https://github.com/user-attachments/assets/243248a6-1a90-4a66-a569-3561f94e3df7)
**Path:** Workers & Pages → **KV** → Create a namespace. (Alternatively: create the Worker first, then add a KV binding under Settings → Bindings; you can create a new namespace from there.) 
![image](https://github.com/user-attachments/assets/c1ec9f72-e60f-4a38-9f14-38439f3b8528)


# Create Worker 

**Path:** Workers & Pages → **Create** (or **Create application**) → Create Worker. If using Git: choose **Clone and bootstrap a public repository** and enter `https://github.com/Genaker/CloudFlare_FPC_Worker`, then Deploy.

![image](https://github.com/user-attachments/assets/1f9b47eb-e5b7-473b-9d0f-f226f836cf97)

![image](https://github.com/user-attachments/assets/9ccc8bb9-2279-40bf-ab15-6a04029db33f)

# Insert CF Worker FPC Code from The repo 
![image](https://github.com/user-attachments/assets/bc2f608f-5df0-46cf-98c6-641bf785bca7)
**Path:** Edit Code → **Insert Code from Git** (or Connect to Git). Connect to `https://github.com/Genaker/CloudFlare_FPC_Worker`. If you created the worker from the Git repo in the previous step, skip this. 

![image](https://github.com/user-attachments/assets/5a39b35a-3b21-4f53-963d-7678b47b40f4)


# Configure Worker
**Path:** Your Worker → **Settings** → **Variables and Secrets** (for ENV vars) and **Settings** → **Bindings** (for KV).
![image](https://github.com/user-attachments/assets/3ba61a60-1f19-488a-903e-88416054911e)

![image](https://github.com/user-attachments/assets/ccb4ba67-bc60-492e-a6d7-99ac6cdf983b)

![image](https://github.com/user-attachments/assets/1d8955ec-a08f-44a6-a4fb-e0c0a46fc600)

![image](https://github.com/user-attachments/assets/3b27e50d-40c8-4b1c-872a-671b863d515e)

Worker *Variable name* must be **KV**. KV name doesn't matter (Select from the drop-down) <br/>
**R2** storage is not available in the open source version, only in the ***Ultra*** Version. Please contact for more details.  <br/>

NOTE: OTHER_HOST is not required settings 

![image](https://github.com/user-attachments/assets/8500a84b-931d-448f-9a7c-578e109399a4)
Configure the **OTHER_HOST** variable with your actual domain (e.g. `www.yoursite.com`) to test the worker through the worker domain. This replaces the worker domain with your staging or prod domain so responses are fetched from your Magento server. This variable is not required for production. 

NOTE: OTHER_HOST is not required settings 


# Set your website route and worker to trigger:
**Path:** Your Worker → **Settings** → **Triggers** (or **Routes**). Add route pattern e.g. `*yoursite.com/*` or `yoursite.com/*` (replace with your domain).

![image](https://github.com/user-attachments/assets/405b8681-ed58-470f-8627-d5cde01f3dfc)

![image](https://github.com/user-attachments/assets/da91073b-7982-4b12-8b2a-b0fb92424168)

![image](https://github.com/user-attachments/assets/0d410e59-41bf-4a58-9d4e-4b62ca107b43)


Done! Test it using Dev Console. 

![image](https://github.com/user-attachments/assets/7545b416-b5e5-4f3e-82c2-142e7edb2522)

You can also exclude some page rules, such as static and media, from workers. It will save money on request. 

![image](https://github.com/user-attachments/assets/2b6efc70-99ae-49a7-bbba-3eb4f174e636)

Also, Enable CF Cache Reserve to increase edge cache HIT rate. To reduce CF costs, you can exclude media and static from the cache reserve. However, cache reserve is a nice stuff, and you can benefit from storing images in it. 

![image](https://github.com/user-attachments/assets/0c1bc4df-483e-45c8-b3a2-44cfe6dab817)

Disable Cloudflare Cache for Static and Media; save and serve from the **Cache Reserve** <br/>
**Path:** Select your domain (zone) → **Caching** → **Cache Rules**
![image](https://github.com/user-attachments/assets/bb3cca02-d45e-4f2b-bf5a-18bfee851c46)

Add Rule 

![image](https://github.com/user-attachments/assets/24233c85-4a75-4462-b78c-2bd3c91f4b11)
Expression : 

```
(http.request.full_uri wildcard "*.yoursite.com/static/*") or (http.request.full_uri wildcard "*.yoursite.com/media/*")
```
Replace **yoursite** with your domain. <br/>

Please update this documentation when you will do it yourself. It is just a fast-written manual. 
For detailed information, check the Worker code. 

If you have any issues, create an issue or email me: egorshitikov[A]gmail.com

# Magento extension 

We also developed a Magento Extension designed to enhance communication and performance between CF Workers and the cache system. <br\>
While this extension is not yet publicly available, feel free to contact me directly if you’re interested in receiving it.

# Cache Debug Cockies
You can add any cookies you want just by changing the script.

# Default Cookies: 
![image](https://github.com/user-attachments/assets/cdc29850-b8cf-4549-ad73-6b494927931a)

# Cloud Flare Default cookies: 

![image](https://github.com/user-attachments/assets/94f38f9f-1fa1-4119-96ef-1ffa4c7867b2)

# Cache Reserve 

Cache Reserve is a large, persistent data store implemented on top of CF R2. Your website’s cacheable FPC content will be written to Cache Reserve. Cache Reserve serves as the ultimate upper-tier cache, reserving storage space for your FPC for as long as you want. This ensures that your FPC is served from the cache. Cache Reserve is a CF feature that allows the use of Claud Flare as a main cache solution. 

![image](https://github.com/user-attachments/assets/e8facd2a-0240-4c69-941d-8dd04b18055c)

Like the standard CDN, Cache Reserve also uses the cf-cache-status header to indicate cache statuses like MISS, HIT, and REVALIDATED. Cache Reserve cache misses and hits are factored into the dashboard’s cache hit ratio.

Individual sampled requests that were filled or were served by Cache Reserve are viewable via the CacheReserveUsed Logpush field.

Cache Reserve monthly operations and storage usage are viewable in the dashboard.

# Statistic

With the CF FPC Workers, you can achieve 91%+ page cache rate from CDN

![image](https://github.com/user-attachments/assets/481cf2a3-bb7a-477f-a2cf-a014123a3643)

# Test 
Open the page. Check **Cf-Cache-Status** header.
![image](https://github.com/user-attachments/assets/859734b2-4aa1-489c-b16a-56dbd8b4481c)

![image](https://github.com/user-attachments/assets/4a37c78f-08a4-4572-94b4-d5ee0d4535d9)

Timing: Server response time must be less than 60ms. 
![image](https://github.com/user-attachments/assets/5d20a929-e2c3-4a42-9adf-7f703c9a2a2b)


# Verification and Troubleshooting

**Check cache status:** Open DevTools → Network, select a request, and look at the response headers. `Cf-Cache-Status: HIT` means the page was served from cache. `DYNAMIC` or `MISS` means it was fetched from the origin.

**Worker debug headers:** The worker adds `x-html-edge-cache-status`, `x-html-edge-cache-version`, `worker-time`, and `js-time` headers. Use these to verify the worker is running and to debug cache behavior.

**Bypass worker for testing:** Add `&cfw=false` to any URL to bypass the worker and compare behavior.

**R2 race:** When using `cf-cdn=false`, responses can come from R2 or from the origin (race). If you see `R2-cache: server-first` or `r2-null-server`, the origin responded first — this is normal. The cache is updated asynchronously.

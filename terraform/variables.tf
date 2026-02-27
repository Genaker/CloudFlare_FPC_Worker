variable "cloudflare_api_token" {
  description = "Cloudflare API token with Workers, KV, R2, and Zone permissions."
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID (found in the dashboard sidebar)."
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Zone ID of the domain to attach the worker route to."
  type        = string
}

variable "domain" {
  description = "Your site domain, e.g. example.com (used to build the route pattern)."
  type        = string
}

variable "worker_name" {
  description = "Name of the deployed Cloudflare Worker."
  type        = string
  default     = "fpc-worker"
}

variable "kv_namespace_title" {
  description = "Display title for the KV namespace (cache version counter)."
  type        = string
  default     = "FPC_KV"
}

variable "r2_bucket_name" {
  description = "Name of the R2 bucket used for full-page cache backup / stale serving."
  type        = string
  default     = "fpc-cache"
}

# ── Worker environment variables ──────────────────────────────────────────────

variable "env_debug" {
  description = "Set to \"true\" to expose internal cache debug headers."
  type        = string
  default     = "false"
}

variable "env_speculation_enabled" {
  description = "Inject Speculation Rules for prefetch/prerender."
  type        = string
  default     = "true"
}

variable "env_r2_stale" {
  description = "Serve stale R2 content while a fresh copy is fetched."
  type        = string
  default     = "true"
}

variable "env_r2_server_race" {
  description = "Race R2 and origin — serve whichever responds first."
  type        = string
  default     = "true"
}

variable "env_revalidate_age" {
  description = "Revalidate stale CDN cache entries older than N seconds."
  type        = string
  default     = "360"
}

variable "env_god_mod" {
  description = "Lock all cache invalidations (100 % static mode)."
  type        = string
  default     = "false"
}

variable "env_pwa_enabled" {
  description = "Inject PWA manifest link into HTML responses."
  type        = string
  default     = "true"
}

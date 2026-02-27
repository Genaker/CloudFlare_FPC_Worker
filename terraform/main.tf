terraform {
  required_version = ">= 1.3.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# ---------------------------------------------------------------------------
# KV Namespace — cache version counter
# ---------------------------------------------------------------------------
resource "cloudflare_workers_kv_namespace" "fpc_kv" {
  account_id = var.cloudflare_account_id
  title      = var.kv_namespace_title
}

# ---------------------------------------------------------------------------
# R2 Bucket — full-page cache backup / stale serving
# ---------------------------------------------------------------------------
resource "cloudflare_r2_bucket" "fpc_cache" {
  account_id = var.cloudflare_account_id
  name       = var.r2_bucket_name
}

# ---------------------------------------------------------------------------
# Worker Script
# ---------------------------------------------------------------------------
resource "cloudflare_worker_script" "fpc" {
  account_id = var.cloudflare_account_id
  name       = var.worker_name
  content    = file("${path.module}/../FPC.js")

  # KV binding
  kv_namespace_binding {
    name         = "KV"
    namespace_id = cloudflare_workers_kv_namespace.fpc_kv.id
  }

  # R2 binding
  r2_bucket_binding {
    name        = "R2"
    bucket_name = cloudflare_r2_bucket.fpc_cache.name
  }

  # Environment variables
  plain_text_binding {
    name = "ENV_DEBUG"
    text = var.env_debug
  }
  plain_text_binding {
    name = "ENV_SPECULATION_ENABLED"
    text = var.env_speculation_enabled
  }
  plain_text_binding {
    name = "ENV_R2_STALE"
    text = var.env_r2_stale
  }
  plain_text_binding {
    name = "ENV_R2_SERVER_RACE"
    text = var.env_r2_server_race
  }
  plain_text_binding {
    name = "ENV_REVALIDATE_AGE"
    text = var.env_revalidate_age
  }
  plain_text_binding {
    name = "ENV_GOD_MOD"
    text = var.env_god_mod
  }
  plain_text_binding {
    name = "ENV_PWA_ENABLED"
    text = var.env_pwa_enabled
  }
}

# ---------------------------------------------------------------------------
# Worker Route — attach to your domain
# ---------------------------------------------------------------------------
resource "cloudflare_worker_route" "fpc_route" {
  zone_id     = var.cloudflare_zone_id
  pattern     = "${var.domain}/*"
  script_name = cloudflare_worker_script.fpc.name

  depends_on = [cloudflare_worker_script.fpc]
}

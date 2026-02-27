output "kv_namespace_id" {
  description = "ID of the KV namespace (paste into wrangler.toml if not using Terraform for deployment)."
  value       = cloudflare_workers_kv_namespace.fpc_kv.id
}

output "r2_bucket_name" {
  description = "Name of the R2 bucket."
  value       = cloudflare_r2_bucket.fpc_cache.name
}

output "worker_name" {
  description = "Deployed worker name."
  value       = cloudflare_worker_script.fpc.name
}

output "worker_route" {
  description = "Route pattern the worker is attached to."
  value       = cloudflare_worker_route.fpc_route.pattern
}

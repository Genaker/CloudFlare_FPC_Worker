#!/usr/bin/env python3
"""
CloudFlare FPC Worker — Interactive Python Deploy Tool

Deploys FPC.js directly via the Cloudflare REST API.
No wrangler CLI required — only Python 3.8+ and pip packages below.

Usage:
    python deploy.py                    # interactive menu
    python deploy.py --deploy           # non-interactive, uses saved config
    python deploy.py --config my.json   # use a custom config file
"""

from __future__ import annotations

import argparse
import getpass
import json
import pathlib
import sys
import time
import urllib.request
from typing import Any, Optional

# ── Dependency checks ──────────────────────────────────────────────────────

def _require(pkg: str, install_name: str | None = None) -> Any:
    import importlib
    try:
        return importlib.import_module(pkg)
    except ImportError:
        name = install_name or pkg
        print(f"ERROR: '{name}' not installed. Run:  pip install {name}")
        sys.exit(1)

requests = _require("requests")

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.prompt import Confirm, Prompt
    from rich.table import Table
    console = Console()
    HAS_RICH = True
except ImportError:
    console = None  # type: ignore[assignment]
    HAS_RICH = False

# ── Constants ──────────────────────────────────────────────────────────────

CF_API      = "https://api.cloudflare.com/client/v4"
SCRIPT_DIR  = pathlib.Path(__file__).parent
FPC_JS      = SCRIPT_DIR / "FPC.js"
CONFIG_FILE = SCRIPT_DIR / ".fpc-deploy.json"

DEFAULT_VARS: dict[str, str] = {
    "ENV_DEBUG":                "false",
    "ENV_SPECULATION_ENABLED":  "true",
    "ENV_R2_STALE":             "true",
    "ENV_R2_SERVER_RACE":       "true",
    "ENV_REVALIDATE_AGE":       "360",
    "ENV_GOD_MOD":              "false",
    "ENV_PWA_ENABLED":          "true",
}

# ── UI helpers ─────────────────────────────────────────────────────────────

def _plain_tag(tag: str, msg: str) -> None:
    print(f"  [{tag}]  {msg}")

def info(msg: str)    -> None: console.print(f"  [cyan][INFO][/cyan]  {msg}") if HAS_RICH else _plain_tag("INFO", msg)
def ok(msg: str)      -> None: console.print(f"  [green][OK][/green]    {msg}") if HAS_RICH else _plain_tag("OK  ", msg)
def warn(msg: str)    -> None: console.print(f"  [yellow][WARN][/yellow]  {msg}") if HAS_RICH else _plain_tag("WARN", msg)
def error(msg: str)   -> None: console.print(f"  [red][ERROR][/red] {msg}") if HAS_RICH else _plain_tag("ERR ", msg)
def die(msg: str)     -> None: error(msg); sys.exit(1)

def banner() -> None:
    if HAS_RICH:
        console.print(Panel(
            "[bold cyan]CloudFlare FPC Worker[/bold cyan]  —  Interactive Deploy Tool\n"
            "[dim]Deploys FPC.js via Cloudflare REST API · no wrangler CLI required[/dim]",
            style="blue", padding=(1, 4),
        ))
    else:
        border = "=" * 62
        print(f"\n{border}")
        print("  CloudFlare FPC Worker — Interactive Deploy Tool")
        print("  Deploys FPC.js via Cloudflare REST API (no wrangler needed)")
        print(f"{border}\n")

def step_header(n: int | str, title: str) -> None:
    if HAS_RICH:
        console.print(f"\n[bold blue]Step {n}[/bold blue]  {title}")
    else:
        print(f"\n--- Step {n}: {title} ---")

def ask(question: str, default: str | None = None, password: bool = False) -> str:
    """Single-line interactive prompt with optional default."""
    if HAS_RICH and not password:
        return Prompt.ask(f"  {question}", default=default or "")
    if HAS_RICH and password:
        # Rich Prompt.ask with password=True
        return Prompt.ask(f"  {question}", password=True, default=default or "")
    # Plain fallback
    default_hint = f" [{default}]" if default else ""
    if password:
        val = getpass.getpass(f"  {question}{default_hint}: ")
    else:
        val = input(f"  {question}{default_hint}: ").strip()
    return val or default or ""

def ask_bool(question: str, default: bool = True) -> bool:
    if HAS_RICH:
        return Confirm.ask(f"  {question}", default=default)
    hint = " [Y/n]" if default else " [y/N]"
    raw = input(f"  {question}{hint}: ").strip().lower()
    if not raw:
        return default
    return raw in ("y", "yes")

def print_kv_table(rows: list[tuple[str, str]], title: str = "") -> None:
    if HAS_RICH:
        t = Table(title=title, show_header=False, box=None, padding=(0, 2))
        t.add_column("key",   style="cyan",  no_wrap=True)
        t.add_column("value", style="white")
        for k, v in rows:
            t.add_row(k, v)
        console.print(t)
    else:
        if title:
            print(f"  {title}")
        for k, v in rows:
            print(f"    {k:30s}  {v}")

# ── Config persistence ─────────────────────────────────────────────────────

def load_config(path: pathlib.Path) -> dict:
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            pass
    return {}

def save_config(cfg: dict, path: pathlib.Path) -> None:
    path.write_text(json.dumps(cfg, indent=2))
    ok(f"Config saved to {path}")

# ── Cloudflare REST API client ─────────────────────────────────────────────

class CloudflareAPI:
    def __init__(self, api_token: str) -> None:
        self._session = requests.Session()
        self._session.headers.update({
            "Authorization": f"Bearer {api_token}",
            "Accept":        "application/json",
        })

    # ── internals ────────────────────────────────────────────────────────

    def _check(self, resp: Any) -> Any:
        try:
            data = resp.json()
        except Exception:
            resp.raise_for_status()
            return {}
        if not data.get("success"):
            errs = data.get("errors", [])
            msg  = "; ".join(str(e.get("message", e)) for e in errs)
            raise RuntimeError(f"API error ({resp.status_code}): {msg}")
        return data.get("result", {})

    def _get(self, path: str, **kw: Any) -> Any:
        return self._check(self._session.get(f"{CF_API}{path}", **kw))

    def _post(self, path: str, **kw: Any) -> Any:
        return self._check(self._session.post(f"{CF_API}{path}", **kw))

    def _put(self, path: str, **kw: Any) -> Any:
        return self._check(self._session.put(f"{CF_API}{path}", **kw))

    def _delete(self, path: str) -> None:
        resp = self._session.delete(f"{CF_API}{path}")
        if resp.status_code not in (200, 404):
            self._check(resp)

    # ── auth ─────────────────────────────────────────────────────────────

    def verify_token(self) -> dict:
        return self._get("/user/tokens/verify")

    def get_account_name(self, account_id: str) -> str:
        try:
            return self._get(f"/accounts/{account_id}").get("name", account_id)
        except Exception:
            return account_id

    def get_zone_name(self, zone_id: str) -> str:
        try:
            return self._get(f"/zones/{zone_id}").get("name", zone_id)
        except Exception:
            return zone_id

    # ── KV namespaces ─────────────────────────────────────────────────────

    def list_kv_namespaces(self, account_id: str) -> list[dict]:
        result = self._get(
            f"/accounts/{account_id}/storage/kv/namespaces",
            params={"per_page": 100},
        )
        return result if isinstance(result, list) else []

    def create_kv_namespace(self, account_id: str, title: str) -> dict:
        return self._post(
            f"/accounts/{account_id}/storage/kv/namespaces",
            json={"title": title},
        )

    # ── R2 buckets ────────────────────────────────────────────────────────

    def list_r2_buckets(self, account_id: str) -> list[dict]:
        result = self._get(f"/accounts/{account_id}/r2/buckets")
        return result.get("buckets", []) if isinstance(result, dict) else []

    def create_r2_bucket(self, account_id: str, name: str) -> dict:
        return self._post(
            f"/accounts/{account_id}/r2/buckets",
            json={"name": name},
        )

    # ── Worker scripts ────────────────────────────────────────────────────

    def list_workers(self, account_id: str) -> list[dict]:
        result = self._get(f"/accounts/{account_id}/workers/scripts")
        return result if isinstance(result, list) else []

    def deploy_worker(
        self,
        account_id: str,
        script_name: str,
        script_content: str,
        kv_namespace_id: str,
        r2_bucket_name: str,
        env_vars: dict[str, str],
        compatibility_date: str = "2024-01-01",
    ) -> dict:
        bindings: list[dict] = [
            {"type": "kv_namespace", "name": "KV", "namespace_id": kv_namespace_id},
            {"type": "r2_bucket",    "name": "R2", "bucket_name":  r2_bucket_name},
        ]
        for k, v in env_vars.items():
            bindings.append({"type": "plain_text", "name": k, "text": v})

        metadata = {
            "bindings":           bindings,
            "compatibility_date": compatibility_date,
        }
        # Multipart: metadata (JSON, no filename) + script (JS)
        files = {
            "metadata": (None,      json.dumps(metadata), "application/json"),
            "script":   ("FPC.js",  script_content,       "application/javascript"),
        }
        return self._put(
            f"/accounts/{account_id}/workers/scripts/{script_name}",
            files=files,
        )

    def delete_worker(self, account_id: str, script_name: str) -> None:
        self._delete(f"/accounts/{account_id}/workers/scripts/{script_name}")

    # ── Worker routes ─────────────────────────────────────────────────────

    def list_routes(self, zone_id: str) -> list[dict]:
        result = self._get(f"/zones/{zone_id}/workers/routes")
        return result if isinstance(result, list) else []

    def create_route(self, zone_id: str, pattern: str, script_name: str) -> dict:
        return self._post(
            f"/zones/{zone_id}/workers/routes",
            json={"pattern": pattern, "script": script_name},
        )

    def update_route(self, zone_id: str, route_id: str, pattern: str, script_name: str) -> dict:
        return self._put(
            f"/zones/{zone_id}/workers/routes/{route_id}",
            json={"pattern": pattern, "script": script_name},
        )

    def delete_route(self, zone_id: str, route_id: str) -> None:
        self._delete(f"/zones/{zone_id}/workers/routes/{route_id}")

# ── Flows ──────────────────────────────────────────────────────────────────

def collect_credentials(cfg: dict) -> dict:
    step_header(1, "Cloudflare credentials")
    print()
    cfg["api_token"]   = ask("API token (from dash.cloudflare.com/profile/api-tokens)",
                              default=cfg.get("api_token"), password=True)
    cfg["account_id"]  = ask("Account ID  (Workers & Pages → Overview, right sidebar)",
                              default=cfg.get("account_id"))
    cfg["zone_id"]     = ask("Zone ID     (your domain → Overview, right sidebar)",
                              default=cfg.get("zone_id"))
    cfg["domain"]      = ask("Domain      (e.g. example.com)",
                              default=cfg.get("domain"))
    print()
    cfg["worker_name"] = ask("Worker name",         default=cfg.get("worker_name", "fpc-worker"))
    cfg["kv_title"]    = ask("KV namespace title",  default=cfg.get("kv_title",    "FPC_KV"))
    cfg["r2_bucket"]   = ask("R2 bucket name",      default=cfg.get("r2_bucket",   "fpc-cache"))
    return cfg


def configure_env_vars(cfg: dict) -> dict:
    step_header("ENV", "Worker environment variables")
    current: dict[str, str] = cfg.get("env_vars") or DEFAULT_VARS.copy()
    print()
    print_kv_table(list(current.items()), title="Current values")
    print()
    if ask_bool("Edit any variable?", default=False):
        for k in list(current.keys()):
            val = ask(f"{k}", default=current[k])
            current[k] = val
    cfg["env_vars"] = current
    return cfg


def do_deploy(cfg: dict, config_path: pathlib.Path) -> None:
    """Run the full 6-step deploy flow."""
    if not FPC_JS.exists():
        die(f"FPC.js not found at {FPC_JS}  (run this script from the worker directory)")

    script_content = FPC_JS.read_text()
    api = CloudflareAPI(cfg["api_token"])

    # Step 2 — validate token
    step_header(2, "Validating API token")
    try:
        tok = api.verify_token()
        ok(f"Token valid — status: {tok.get('status', 'active')}")
    except RuntimeError as exc:
        die(str(exc))

    # Step 3 — KV namespace
    step_header(3, "KV namespace")
    existing_kv = api.list_kv_namespaces(cfg["account_id"])
    match_kv    = next((ns for ns in existing_kv if ns.get("title") == cfg["kv_title"]), None)
    if match_kv:
        warn(f"'{cfg['kv_title']}' already exists — reusing (id: {match_kv['id']})")
        kv_id = match_kv["id"]
    else:
        info(f"Creating KV namespace '{cfg['kv_title']}'…")
        result = api.create_kv_namespace(cfg["account_id"], cfg["kv_title"])
        kv_id  = result["id"]
        ok(f"Created — id: {kv_id}")
    cfg["kv_namespace_id"] = kv_id

    # Step 4 — R2 bucket
    step_header(4, "R2 bucket")
    existing_r2 = {b.get("name") for b in api.list_r2_buckets(cfg["account_id"])}
    if cfg["r2_bucket"] in existing_r2:
        warn(f"'{cfg['r2_bucket']}' already exists — skipping creation.")
    else:
        info(f"Creating R2 bucket '{cfg['r2_bucket']}'…")
        api.create_r2_bucket(cfg["account_id"], cfg["r2_bucket"])
        ok(f"Created R2 bucket '{cfg['r2_bucket']}'")

    # Step 5 — deploy worker
    step_header(5, "Deploying worker script")
    env_vars = cfg.get("env_vars") or DEFAULT_VARS.copy()
    info(f"Uploading '{cfg['worker_name']}' ({len(script_content):,} bytes)…")
    api.deploy_worker(
        account_id      = cfg["account_id"],
        script_name     = cfg["worker_name"],
        script_content  = script_content,
        kv_namespace_id = kv_id,
        r2_bucket_name  = cfg["r2_bucket"],
        env_vars        = env_vars,
    )
    ok(f"Worker '{cfg['worker_name']}' deployed successfully.")

    # Step 6 — route
    step_header(6, "Worker route")
    pattern = f"{cfg['domain']}/*"
    existing_routes = api.list_routes(cfg["zone_id"])
    existing_route  = next(
        (r for r in existing_routes if r.get("script") == cfg["worker_name"]), None
    )
    if existing_route:
        if existing_route.get("pattern") != pattern:
            info(f"Updating route '{existing_route['pattern']}' → '{pattern}'")
            api.update_route(cfg["zone_id"], existing_route["id"], pattern, cfg["worker_name"])
            ok(f"Route updated to '{pattern}'")
        else:
            ok(f"Route '{pattern}' already correct.")
        cfg["route_id"] = existing_route["id"]
    else:
        info(f"Creating route '{pattern}'…")
        result = api.create_route(cfg["zone_id"], pattern, cfg["worker_name"])
        cfg["route_id"] = result.get("id", "")
        ok(f"Route created: {pattern}")

    # Summary
    print()
    summary_rows = [
        ("Worker",          cfg["worker_name"]),
        ("Route",           pattern),
        ("KV namespace ID", kv_id),
        ("R2 bucket",       cfg["r2_bucket"]),
    ] + [(k, v) for k, v in env_vars.items()]
    print_kv_table(summary_rows, title="Deployment summary")
    print()
    ok(f"Live at: https://{cfg['domain']}/")
    ok(f"Verify:  curl -sI https://{cfg['domain']}/ | grep x-html-edge-cache-status")

    save_config(cfg, config_path)


def do_update_vars(cfg: dict, config_path: pathlib.Path) -> None:
    if not cfg.get("api_token"):
        warn("No saved config. Run option 1 (Deploy) first.")
        return
    cfg = configure_env_vars(cfg)
    save_config(cfg, config_path)
    if ask_bool("Re-deploy now to apply the changes?", default=True):
        do_deploy(cfg, config_path)


def do_purge(cfg: dict) -> None:
    """Increment the worker cache version via its cf-version endpoint."""
    domain = cfg.get("domain", "")
    if not domain:
        die("Domain not configured. Run option 1 (Deploy) first.")
    url = f"https://{domain}/?cf-version=purge"
    info(f"Sending purge request → {url}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "fpc-deploy/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            status = resp.status
    except Exception as exc:
        die(f"Request failed: {exc}")
    if status == 222:
        ok(f"Cache purged (HTTP 222). All pages will be re-fetched on next visit.")
    else:
        warn(f"Unexpected HTTP {status} — is the worker deployed and route active?")


def do_delete(cfg: dict, config_path: pathlib.Path) -> None:
    if not cfg.get("api_token"):
        warn("No saved config. Nothing to delete.")
        return
    print()
    warn(f"This will permanently DELETE worker '{cfg.get('worker_name')}' and its route.")
    if not ask_bool("Continue?", default=False):
        info("Aborted.")
        return
    api = CloudflareAPI(cfg["api_token"])
    if cfg.get("route_id") and cfg.get("zone_id"):
        info(f"Deleting route {cfg['route_id']}…")
        api.delete_route(cfg["zone_id"], cfg["route_id"])
        ok("Route deleted.")
    info(f"Deleting worker '{cfg['worker_name']}'…")
    api.delete_worker(cfg["account_id"], cfg["worker_name"])
    ok("Worker deleted.")
    # Clear saved IDs but keep credentials
    for key in ("kv_namespace_id", "route_id"):
        cfg.pop(key, None)
    save_config(cfg, config_path)


def do_show_config(cfg: dict) -> None:
    """Print saved config, masking the API token."""
    masked = {
        **cfg,
        "api_token": ("••••" + cfg["api_token"][-4:]) if cfg.get("api_token") else "",
    }
    if HAS_RICH:
        console.print_json(json.dumps(masked, indent=2))
    else:
        print(json.dumps(masked, indent=2))


def do_check_status(cfg: dict) -> None:
    """Hit the live worker endpoint and display cache status headers."""
    domain = cfg.get("domain", "")
    if not domain:
        die("Domain not configured. Run option 1 (Deploy) first.")
    url = f"https://{domain}/"
    info(f"Checking {url} …")
    try:
        import requests as _req  # already imported globally
        resp = _req.get(url, timeout=15, allow_redirects=True)
    except Exception as exc:
        die(str(exc))
    interesting = {
        k: v for k, v in resp.headers.items()
        if any(token in k.lower() for token in (
            "x-html-edge-cache", "cf-cache-status", "cache-control",
            "age", "server-timing", "x-cache",
        ))
    }
    rows = [(k, v) for k, v in sorted(interesting.items())]
    rows.insert(0, ("HTTP status", str(resp.status_code)))
    print_kv_table(rows, title=f"Response headers — {url}")

# ── Menu ───────────────────────────────────────────────────────────────────

MENU: list[tuple[str, str]] = [
    ("1", "Deploy / update worker"),
    ("2", "Update environment variables only"),
    ("3", "Purge cache  (increment version)"),
    ("4", "Check live cache status"),
    ("5", "Show saved config"),
    ("6", "Delete worker + route"),
    ("7", "Exit"),
]

def print_menu() -> None:
    print()
    if HAS_RICH:
        t = Table(show_header=False, box=None, padding=(0, 2))
        t.add_column("n",     style="bold cyan", no_wrap=True)
        t.add_column("label", style="white")
        for key, label in MENU:
            t.add_row(key, label)
        console.print(t)
    else:
        for key, label in MENU:
            print(f"  {key}.  {label}")
    print()

# ── Entry point ────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="CloudFlare FPC Worker — interactive Python deploy tool"
    )
    parser.add_argument(
        "--config", default=str(CONFIG_FILE),
        help=f"Path to saved config JSON (default: {CONFIG_FILE})",
    )
    parser.add_argument(
        "--deploy", action="store_true",
        help="Non-interactive: deploy using values from the saved config file.",
    )
    args = parser.parse_args()

    config_path = pathlib.Path(args.config)
    cfg         = load_config(config_path)

    banner()

    if args.deploy:
        if not cfg:
            die("No saved config found. Run interactively first (without --deploy).")
        do_deploy(cfg, config_path)
        return

    # ── Interactive loop ─────────────────────────────────────────────────
    while True:
        if HAS_RICH:
            console.rule("[bold]Main Menu[/bold]")
        else:
            print("\n" + "-" * 40 + " Main Menu " + "-" * 40)

        if cfg.get("domain"):
            info(f"Current config: [bold]{cfg.get('worker_name')}[/bold] → {cfg.get('domain')}"
                 if HAS_RICH else
                 f"Current config: {cfg.get('worker_name')} → {cfg.get('domain')}")

        print_menu()
        choice = ask("Choice", default="1")

        match choice:
            case "1":
                cfg = collect_credentials(cfg)
                cfg = configure_env_vars(cfg)
                save_config(cfg, config_path)
                do_deploy(cfg, config_path)

            case "2":
                do_update_vars(cfg, config_path)

            case "3":
                do_purge(cfg)

            case "4":
                do_check_status(cfg)

            case "5":
                do_show_config(cfg)

            case "6":
                do_delete(cfg, config_path)

            case "7" | "q" | "quit" | "exit":
                info("Bye!")
                sys.exit(0)

            case _:
                warn("Unknown option — enter a number from 1 to 7.")


if __name__ == "__main__":
    main()

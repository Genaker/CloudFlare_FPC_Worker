"""
Unit tests for deploy.py — CloudFlare FPC Worker Python deploy tool.

All HTTP calls are mocked.  No live Cloudflare account is needed.

Run:
    pip install -r requirements.txt pytest
    pytest test_deploy.py -v
"""

from __future__ import annotations

import json
import pathlib
import sys
import urllib.error
from unittest.mock import MagicMock, Mock, call, patch

import pytest

# ── Import guard ───────────────────────────────────────────────────────────
# Skip the whole file (not just fail) if 'requests' is absent.
pytest.importorskip("requests")

import deploy
from deploy import (
    CF_API,
    CloudflareAPI,
    DEFAULT_VARS,
    do_check_status,
    do_delete,
    do_deploy,
    do_purge,
    do_show_config,
    load_config,
    save_config,
)

# ── Test helpers ───────────────────────────────────────────────────────────

def cf_ok(result, *, status_code: int = 200) -> Mock:
    """Successful Cloudflare API response mock."""
    resp = Mock()
    resp.status_code = status_code
    resp.json.return_value = {"success": True, "result": result, "errors": []}
    return resp


def cf_err(message: str, *, status_code: int = 400) -> Mock:
    """Failed Cloudflare API response mock."""
    resp = Mock()
    resp.status_code = status_code
    resp.json.return_value = {
        "success": False,
        "result":  None,
        "errors":  [{"message": message, "code": 9999}],
    }
    return resp


def make_api() -> CloudflareAPI:
    """CloudflareAPI instance with a fully-mocked requests Session."""
    api = CloudflareAPI("test-token-abc123")
    api._session = MagicMock()
    return api


def mock_api_for_deploy(
    *,
    kv_namespaces: list | None = None,
    r2_buckets:    list | None = None,
    routes:        list | None = None,
) -> MagicMock:
    """Build a spec'd CloudflareAPI mock pre-wired for do_deploy()."""
    m = MagicMock(spec=CloudflareAPI)
    m.verify_token.return_value        = {"status": "active"}
    m.list_kv_namespaces.return_value  = kv_namespaces or []
    m.create_kv_namespace.return_value = {"id": "new-kv-id", "title": "FPC_KV"}
    m.list_r2_buckets.return_value     = r2_buckets or []
    m.create_r2_bucket.return_value    = {"name": "fpc-cache"}
    m.deploy_worker.return_value       = {"id": "fpc-worker"}
    m.list_routes.return_value         = routes or []
    m.create_route.return_value        = {"id": "route-1"}
    m.update_route.return_value        = {"id": "route-1"}
    return m


BASE_CFG: dict = {
    "api_token":   "tok-abc",
    "account_id":  "acct1",
    "zone_id":     "zone1",
    "domain":      "example.com",
    "worker_name": "fpc-worker",
    "kv_title":    "FPC_KV",
    "r2_bucket":   "fpc-cache",
    "env_vars":    DEFAULT_VARS.copy(),
}


# ── CloudflareAPI: _check ──────────────────────────────────────────────────

class TestCheck:
    def test_returns_result_on_success(self):
        api  = make_api()
        resp = cf_ok({"id": "abc"})
        assert api._check(resp) == {"id": "abc"}

    def test_raises_on_api_error(self):
        api  = make_api()
        resp = cf_err("Invalid API token")
        with pytest.raises(RuntimeError, match="Invalid API token"):
            api._check(resp)

    def test_raises_with_multiple_errors_joined(self):
        api  = make_api()
        resp = Mock()
        resp.status_code = 400
        resp.json.return_value = {
            "success": False,
            "errors":  [{"message": "Err A"}, {"message": "Err B"}],
        }
        with pytest.raises(RuntimeError, match="Err A"):
            api._check(resp)

    def test_falls_back_to_raise_for_status_on_bad_json(self):
        api  = make_api()
        resp = Mock()
        resp.json.side_effect    = ValueError("bad json")
        resp.raise_for_status    = Mock()
        api._check(resp)
        resp.raise_for_status.assert_called_once()

    def test_returns_empty_dict_when_result_missing(self):
        api  = make_api()
        resp = Mock()
        resp.json.return_value = {"success": True}
        assert api._check(resp) == {}


# ── CloudflareAPI: auth ────────────────────────────────────────────────────

class TestAuth:
    def test_bearer_header_set_on_init(self):
        api = CloudflareAPI("my-secret-token")
        api._session.headers.update.assert_called()  # called during __init__

    def test_verify_token_success(self):
        api = make_api()
        api._session.get.return_value = cf_ok({"status": "active", "id": "t1"})
        result = api.verify_token()
        assert result["status"] == "active"
        api._session.get.assert_called_once_with(f"{CF_API}/user/tokens/verify")

    def test_verify_token_raises_on_bad_token(self):
        api = make_api()
        api._session.get.return_value = cf_err("Invalid API token", status_code=403)
        with pytest.raises(RuntimeError, match="Invalid API token"):
            api.verify_token()

    def test_get_account_name_returns_name(self):
        api = make_api()
        api._session.get.return_value = cf_ok({"name": "Acme Corp", "id": "a1"})
        assert api.get_account_name("a1") == "Acme Corp"

    def test_get_account_name_falls_back_to_id_on_error(self):
        api = make_api()
        api._session.get.return_value = cf_err("Not found", status_code=404)
        assert api.get_account_name("a1") == "a1"

    def test_get_zone_name(self):
        api = make_api()
        api._session.get.return_value = cf_ok({"name": "example.com"})
        assert api.get_zone_name("z1") == "example.com"

    def test_get_zone_name_falls_back_on_error(self):
        api = make_api()
        api._session.get.return_value = cf_err("Not found")
        assert api.get_zone_name("z1") == "z1"


# ── CloudflareAPI: KV namespaces ───────────────────────────────────────────

class TestKVNamespaces:
    def test_list_returns_list(self):
        api = make_api()
        ns  = [{"id": "n1", "title": "FPC_KV"}, {"id": "n2", "title": "Other"}]
        api._session.get.return_value = cf_ok(ns)
        result = api.list_kv_namespaces("acct1")
        assert len(result) == 2
        assert result[0]["title"] == "FPC_KV"
        api._session.get.assert_called_once_with(
            f"{CF_API}/accounts/acct1/storage/kv/namespaces",
            params={"per_page": 100},
        )

    def test_list_returns_empty_when_result_is_dict(self):
        api = make_api()
        api._session.get.return_value = cf_ok({})
        assert api.list_kv_namespaces("acct1") == []

    def test_create_namespace(self):
        api = make_api()
        api._session.post.return_value = cf_ok({"id": "new-id", "title": "FPC_KV"})
        result = api.create_kv_namespace("acct1", "FPC_KV")
        assert result["id"] == "new-id"
        api._session.post.assert_called_once_with(
            f"{CF_API}/accounts/acct1/storage/kv/namespaces",
            json={"title": "FPC_KV"},
        )

    def test_create_raises_on_api_error(self):
        api = make_api()
        api._session.post.return_value = cf_err("Namespace already exists")
        with pytest.raises(RuntimeError, match="Namespace already exists"):
            api.create_kv_namespace("acct1", "FPC_KV")


# ── CloudflareAPI: R2 buckets ──────────────────────────────────────────────

class TestR2Buckets:
    def test_list_returns_buckets(self):
        api     = make_api()
        buckets = [{"name": "fpc-cache"}, {"name": "other"}]
        api._session.get.return_value = cf_ok({"buckets": buckets})
        result = api.list_r2_buckets("acct1")
        assert [b["name"] for b in result] == ["fpc-cache", "other"]

    def test_list_returns_empty_when_no_buckets_key(self):
        api = make_api()
        api._session.get.return_value = cf_ok({})
        assert api.list_r2_buckets("acct1") == []

    def test_list_returns_empty_when_result_is_list(self):
        api = make_api()
        api._session.get.return_value = cf_ok([])   # unexpected format
        assert api.list_r2_buckets("acct1") == []

    def test_create_bucket(self):
        api = make_api()
        api._session.post.return_value = cf_ok({"name": "fpc-cache"})
        api.create_r2_bucket("acct1", "fpc-cache")
        api._session.post.assert_called_once_with(
            f"{CF_API}/accounts/acct1/r2/buckets",
            json={"name": "fpc-cache"},
        )


# ── CloudflareAPI: Worker deploy ───────────────────────────────────────────

class TestWorkerDeploy:
    SCRIPT = "addEventListener('fetch', e => e.respondWith(new Response('hi')))"

    def _deploy(self, api: CloudflareAPI, **overrides) -> None:
        defaults = dict(
            account_id      = "acct1",
            script_name     = "fpc-worker",
            script_content  = self.SCRIPT,
            kv_namespace_id = "kv-123",
            r2_bucket_name  = "fpc-cache",
            env_vars        = DEFAULT_VARS.copy(),
        )
        api.deploy_worker(**{**defaults, **overrides})

    def test_put_called_at_correct_url(self):
        api = make_api()
        api._session.put.return_value = cf_ok({})
        self._deploy(api)
        url = api._session.put.call_args[0][0]
        assert url == f"{CF_API}/accounts/acct1/workers/scripts/fpc-worker"

    def test_metadata_part_is_json(self):
        api = make_api()
        api._session.put.return_value = cf_ok({})
        self._deploy(api)
        files = api._session.put.call_args[1]["files"]
        _, body, ct = files["metadata"]
        assert ct == "application/json"
        meta = json.loads(body)      # must be valid JSON
        assert "bindings" in meta

    def test_metadata_has_correct_compatibility_date(self):
        api = make_api()
        api._session.put.return_value = cf_ok({})
        self._deploy(api)
        files = api._session.put.call_args[1]["files"]
        meta  = json.loads(files["metadata"][1])
        assert meta["compatibility_date"] == "2024-01-01"

    def test_kv_binding_present_and_correct(self):
        api = make_api()
        api._session.put.return_value = cf_ok({})
        self._deploy(api, kv_namespace_id="kv-xyz")
        files   = api._session.put.call_args[1]["files"]
        meta    = json.loads(files["metadata"][1])
        kv_bind = next(b for b in meta["bindings"] if b["name"] == "KV")
        assert kv_bind["type"]         == "kv_namespace"
        assert kv_bind["namespace_id"] == "kv-xyz"

    def test_r2_binding_present_and_correct(self):
        api = make_api()
        api._session.put.return_value = cf_ok({})
        self._deploy(api, r2_bucket_name="my-bucket")
        files   = api._session.put.call_args[1]["files"]
        meta    = json.loads(files["metadata"][1])
        r2_bind = next(b for b in meta["bindings"] if b["name"] == "R2")
        assert r2_bind["type"]        == "r2_bucket"
        assert r2_bind["bucket_name"] == "my-bucket"

    def test_all_env_vars_become_plain_text_bindings(self):
        api = make_api()
        api._session.put.return_value = cf_ok({})
        self._deploy(api, env_vars=DEFAULT_VARS)
        files  = api._session.put.call_args[1]["files"]
        meta   = json.loads(files["metadata"][1])
        pt     = {b["name"]: b["text"] for b in meta["bindings"] if b["type"] == "plain_text"}
        assert pt == DEFAULT_VARS

    def test_custom_env_var_values_passed_through(self):
        api  = make_api()
        api._session.put.return_value = cf_ok({})
        self._deploy(api, env_vars={"ENV_DEBUG": "true", "ENV_GOD_MOD": "true"})
        files = api._session.put.call_args[1]["files"]
        meta  = json.loads(files["metadata"][1])
        pt    = {b["name"]: b["text"] for b in meta["bindings"] if b["type"] == "plain_text"}
        assert pt["ENV_DEBUG"]   == "true"
        assert pt["ENV_GOD_MOD"] == "true"

    def test_script_part_contains_source(self):
        api = make_api()
        api._session.put.return_value = cf_ok({})
        self._deploy(api)
        files = api._session.put.call_args[1]["files"]
        fname, body, ct = files["script"]
        assert fname == "FPC.js"
        assert ct    == "application/javascript"
        assert "addEventListener" in body

    def test_delete_worker_sends_delete(self):
        api = make_api()
        api._session.delete.return_value = Mock(status_code=200)
        api.delete_worker("acct1", "fpc-worker")
        api._session.delete.assert_called_once_with(
            f"{CF_API}/accounts/acct1/workers/scripts/fpc-worker"
        )

    def test_delete_worker_404_is_silent(self):
        api = make_api()
        api._session.delete.return_value = Mock(status_code=404)
        api.delete_worker("acct1", "nonexistent")   # must not raise


# ── CloudflareAPI: Worker routes ───────────────────────────────────────────

class TestWorkerRoutes:
    def test_list_routes(self):
        api    = make_api()
        routes = [{"id": "r1", "pattern": "example.com/*", "script": "fpc-worker"}]
        api._session.get.return_value = cf_ok(routes)
        result = api.list_routes("zone1")
        assert result[0]["pattern"] == "example.com/*"

    def test_list_routes_returns_empty_on_non_list(self):
        api = make_api()
        api._session.get.return_value = cf_ok({})
        assert api.list_routes("zone1") == []

    def test_create_route(self):
        api = make_api()
        api._session.post.return_value = cf_ok({"id": "route-1"})
        result = api.create_route("zone1", "example.com/*", "fpc-worker")
        assert result["id"] == "route-1"
        api._session.post.assert_called_once_with(
            f"{CF_API}/zones/zone1/workers/routes",
            json={"pattern": "example.com/*", "script": "fpc-worker"},
        )

    def test_update_route(self):
        api = make_api()
        api._session.put.return_value = cf_ok({"id": "r1"})
        api.update_route("zone1", "r1", "example.com/*", "fpc-worker")
        api._session.put.assert_called_once_with(
            f"{CF_API}/zones/zone1/workers/routes/r1",
            json={"pattern": "example.com/*", "script": "fpc-worker"},
        )

    def test_delete_route(self):
        api = make_api()
        api._session.delete.return_value = Mock(status_code=200)
        api.delete_route("zone1", "r1")
        api._session.delete.assert_called_once_with(
            f"{CF_API}/zones/zone1/workers/routes/r1"
        )


# ── Config persistence ─────────────────────────────────────────────────────

class TestConfigPersistence:
    def test_load_returns_empty_dict_for_missing_file(self, tmp_path):
        assert load_config(tmp_path / "none.json") == {}

    def test_load_parses_valid_json(self, tmp_path):
        p = tmp_path / "c.json"
        p.write_text(json.dumps({"domain": "example.com", "worker_name": "fpc"}))
        cfg = load_config(p)
        assert cfg["domain"]      == "example.com"
        assert cfg["worker_name"] == "fpc"

    def test_load_returns_empty_on_corrupt_json(self, tmp_path):
        p = tmp_path / "bad.json"
        p.write_text("{{{ NOT JSON ]]}")
        assert load_config(p) == {}

    def test_save_writes_json_file(self, tmp_path, capsys):
        p   = tmp_path / "out.json"
        cfg = {"domain": "example.com", "api_token": "tok"}
        save_config(cfg, p)
        assert p.exists()
        assert json.loads(p.read_text()) == cfg

    def test_save_is_indented(self, tmp_path, capsys):
        p = tmp_path / "out.json"
        save_config({"key": "value"}, p)
        assert "\n" in p.read_text()    # pretty-printed

    def test_roundtrip_preserves_all_fields(self, tmp_path, capsys):
        p   = tmp_path / "rt.json"
        cfg = {**BASE_CFG, "kv_namespace_id": "kv-xyz", "route_id": "r-1"}
        save_config(cfg, p)
        assert load_config(p) == cfg


# ── do_deploy ─────────────────────────────────────────────────────────────

class TestDoDeployFlow:
    """do_deploy end-to-end with CloudflareAPI fully mocked."""

    def _run(self, cfg, tmp_path, *, api_mock=None, script="// fpc"):
        if api_mock is None:
            api_mock = mock_api_for_deploy()
        with (
            patch("deploy.CloudflareAPI", return_value=api_mock),
            patch("deploy.FPC_JS") as fpc,
        ):
            fpc.exists.return_value   = True
            fpc.read_text.return_value = script
            do_deploy(cfg, tmp_path / "cfg.json")
        return api_mock

    # ── FPC.js presence ──────────────────────────────────────────────────

    def test_exits_when_fpc_js_missing(self, tmp_path):
        cfg = dict(BASE_CFG)
        with (
            patch("deploy.CloudflareAPI", return_value=mock_api_for_deploy()),
            patch("deploy.FPC_JS") as fpc,
        ):
            fpc.exists.return_value = False
            with pytest.raises(SystemExit):
                do_deploy(cfg, tmp_path / "cfg.json")

    # ── Token validation ─────────────────────────────────────────────────

    def test_exits_on_invalid_token(self, tmp_path):
        cfg      = dict(BASE_CFG)
        bad_api  = mock_api_for_deploy()
        bad_api.verify_token.side_effect = RuntimeError("Invalid API token")
        with pytest.raises(SystemExit):
            self._run(cfg, tmp_path, api_mock=bad_api)

    # ── KV namespace ─────────────────────────────────────────────────────

    def test_creates_kv_when_absent(self, tmp_path):
        cfg = dict(BASE_CFG)
        m   = self._run(cfg, tmp_path)
        m.create_kv_namespace.assert_called_once_with("acct1", "FPC_KV")

    def test_reuses_existing_kv(self, tmp_path):
        cfg = dict(BASE_CFG)
        m   = self._run(cfg, tmp_path,
                        api_mock=mock_api_for_deploy(kv_namespaces=[{"id": "old-kv", "title": "FPC_KV"}]))
        m.create_kv_namespace.assert_not_called()
        # existing id must be forwarded to deploy_worker
        assert m.deploy_worker.call_args[1]["kv_namespace_id"] == "old-kv"

    def test_kv_id_stored_in_cfg(self, tmp_path):
        cfg = dict(BASE_CFG)
        self._run(cfg, tmp_path)
        assert cfg["kv_namespace_id"] == "new-kv-id"

    # ── R2 bucket ────────────────────────────────────────────────────────

    def test_creates_r2_when_absent(self, tmp_path):
        cfg = dict(BASE_CFG)
        m   = self._run(cfg, tmp_path)
        m.create_r2_bucket.assert_called_once_with("acct1", "fpc-cache")

    def test_skips_r2_when_bucket_exists(self, tmp_path):
        cfg = dict(BASE_CFG)
        m   = self._run(cfg, tmp_path,
                        api_mock=mock_api_for_deploy(r2_buckets=[{"name": "fpc-cache"}]))
        m.create_r2_bucket.assert_not_called()

    # ── Worker deploy ────────────────────────────────────────────────────

    def test_deploy_worker_called_once(self, tmp_path):
        cfg = dict(BASE_CFG)
        m   = self._run(cfg, tmp_path)
        m.deploy_worker.assert_called_once()

    def test_deploy_worker_receives_script_text(self, tmp_path):
        cfg = dict(BASE_CFG)
        m   = self._run(cfg, tmp_path, script="// custom worker code")
        assert m.deploy_worker.call_args[1]["script_content"] == "// custom worker code"

    def test_deploy_worker_receives_env_vars(self, tmp_path):
        cfg = {**BASE_CFG, "env_vars": {"ENV_DEBUG": "true"}}
        m   = self._run(cfg, tmp_path)
        assert m.deploy_worker.call_args[1]["env_vars"] == {"ENV_DEBUG": "true"}

    def test_deploy_worker_falls_back_to_default_vars(self, tmp_path):
        cfg = {**BASE_CFG}
        cfg.pop("env_vars", None)
        m = self._run(cfg, tmp_path)
        assert m.deploy_worker.call_args[1]["env_vars"] == DEFAULT_VARS

    # ── Route ────────────────────────────────────────────────────────────

    def test_creates_route_when_absent(self, tmp_path):
        cfg = dict(BASE_CFG)
        m   = self._run(cfg, tmp_path)
        m.create_route.assert_called_once_with("zone1", "example.com/*", "fpc-worker")
        m.update_route.assert_not_called()

    def test_updates_route_when_pattern_differs(self, tmp_path):
        cfg    = dict(BASE_CFG)
        routes = [{"id": "r1", "pattern": "OLD/*", "script": "fpc-worker"}]
        m      = self._run(cfg, tmp_path, api_mock=mock_api_for_deploy(routes=routes))
        m.update_route.assert_called_once_with("zone1", "r1", "example.com/*", "fpc-worker")
        m.create_route.assert_not_called()

    def test_leaves_route_alone_when_pattern_matches(self, tmp_path):
        cfg    = dict(BASE_CFG)
        routes = [{"id": "r1", "pattern": "example.com/*", "script": "fpc-worker"}]
        m      = self._run(cfg, tmp_path, api_mock=mock_api_for_deploy(routes=routes))
        m.create_route.assert_not_called()
        m.update_route.assert_not_called()

    def test_route_id_stored_in_cfg_after_create(self, tmp_path):
        cfg = dict(BASE_CFG)
        self._run(cfg, tmp_path)
        assert cfg.get("route_id") == "route-1"

    def test_route_id_stored_in_cfg_after_reuse(self, tmp_path):
        cfg    = dict(BASE_CFG)
        routes = [{"id": "existing-r", "pattern": "example.com/*", "script": "fpc-worker"}]
        self._run(cfg, tmp_path, api_mock=mock_api_for_deploy(routes=routes))
        assert cfg.get("route_id") == "existing-r"

    # ── Config persistence ───────────────────────────────────────────────

    def test_config_saved_after_deploy(self, tmp_path):
        cfg      = dict(BASE_CFG)
        cfg_path = tmp_path / "out.json"
        self._run(cfg, tmp_path)
        saved = json.loads((tmp_path / "cfg.json").read_text())
        assert saved["kv_namespace_id"] is not None
        assert saved["domain"] == "example.com"


# ── do_purge ──────────────────────────────────────────────────────────────

class TestDoPurge:
    def _urlopen_ctx(self, status: int):
        """Return a context-manager mock for urllib.request.urlopen."""
        inner = MagicMock()
        inner.status = status
        cm = MagicMock()
        cm.__enter__ = lambda s: inner
        cm.__exit__  = MagicMock(return_value=False)
        return cm

    def test_exits_when_domain_missing(self):
        with pytest.raises(SystemExit):
            do_purge({})

    def test_status_222_prints_purge_ok(self, capsys):
        with patch("urllib.request.urlopen", return_value=self._urlopen_ctx(222)):
            do_purge({"domain": "example.com"})
        out = capsys.readouterr().out
        assert "222" in out or "purged" in out.lower()

    def test_unexpected_status_prints_warning(self, capsys):
        with patch("urllib.request.urlopen", return_value=self._urlopen_ctx(200)):
            do_purge({"domain": "example.com"})
        out = capsys.readouterr().out
        assert "200" in out or "unexpected" in out.lower() or "warn" in out.lower()

    def test_request_url_includes_cf_version_purge(self):
        captured_url = []
        ctx = self._urlopen_ctx(222)
        original_request = urllib.request.Request

        def capture_request(url, **kw):
            captured_url.append(url)
            return original_request(url, **kw)

        with (
            patch("urllib.request.Request",  side_effect=capture_request),
            patch("urllib.request.urlopen",  return_value=ctx),
        ):
            do_purge({"domain": "example.com"})

        assert any("cf-version=purge" in u for u in captured_url)

    def test_network_error_calls_die(self):
        with (
            patch("urllib.request.urlopen", side_effect=OSError("timeout")),
            pytest.raises(SystemExit),
        ):
            do_purge({"domain": "example.com"})


# ── do_check_status ───────────────────────────────────────────────────────

class TestDoCheckStatus:
    def test_exits_when_domain_missing(self):
        with pytest.raises(SystemExit):
            do_check_status({})

    def test_prints_cache_headers(self, capsys):
        mock_resp = Mock()
        mock_resp.status_code = 200
        mock_resp.headers     = {
            "x-html-edge-cache-status": "Hit",
            "cf-cache-status":          "HIT",
            "content-type":             "text/html",   # should be filtered out
        }
        with patch("requests.get", return_value=mock_resp):
            do_check_status({"domain": "example.com"})
        out = capsys.readouterr().out
        assert "Hit" in out or "HIT" in out

    def test_network_error_calls_die(self):
        with (
            patch("requests.get", side_effect=OSError("connection refused")),
            pytest.raises(SystemExit),
        ):
            do_check_status({"domain": "example.com"})

    def test_non_cache_headers_excluded(self, capsys):
        mock_resp = Mock()
        mock_resp.status_code = 200
        mock_resp.headers     = {"content-length": "12345", "x-powered-by": "PHP"}
        with patch("requests.get", return_value=mock_resp):
            do_check_status({"domain": "example.com"})
        out = capsys.readouterr().out
        assert "content-length" not in out
        assert "x-powered-by"   not in out


# ── do_show_config ────────────────────────────────────────────────────────

class TestDoShowConfig:
    def test_api_token_is_masked(self, capsys):
        cfg = {"api_token": "abcdef1234", "domain": "example.com"}
        do_show_config(cfg)
        out = capsys.readouterr().out
        assert "abcdef" not in out           # full token NOT shown
        assert "1234"    in out              # last 4 digits shown

    def test_empty_token_handled_gracefully(self, capsys):
        do_show_config({})                   # must not raise

    def test_domain_present_in_output(self, capsys):
        cfg = {"api_token": "tok", "domain": "mysite.com"}
        do_show_config(cfg)
        assert "mysite.com" in capsys.readouterr().out


# ── do_delete ─────────────────────────────────────────────────────────────

class TestDoDelete:
    def test_no_op_when_no_credentials(self, tmp_path, capsys):
        do_delete({}, tmp_path / "cfg.json")    # must not raise
        out = capsys.readouterr().out
        assert "nothing" in out.lower() or "no saved" in out.lower()

    def test_aborts_when_user_declines(self, tmp_path):
        cfg = dict(BASE_CFG)
        with (
            patch("deploy.ask_bool", return_value=False),
            patch("deploy.CloudflareAPI") as MockAPI,
        ):
            do_delete(cfg, tmp_path / "cfg.json")
            MockAPI.return_value.delete_worker.assert_not_called()

    def test_deletes_route_and_worker(self, tmp_path, capsys):
        cfg = {**BASE_CFG, "route_id": "r-1"}
        mock_api = MagicMock(spec=CloudflareAPI)
        with (
            patch("deploy.ask_bool", return_value=True),
            patch("deploy.CloudflareAPI", return_value=mock_api),
            patch("deploy.save_config"),
        ):
            do_delete(cfg, tmp_path / "cfg.json")
        mock_api.delete_route.assert_called_once_with("zone1", "r-1")
        mock_api.delete_worker.assert_called_once_with("acct1", "fpc-worker")

    def test_skips_route_delete_when_route_id_absent(self, tmp_path):
        cfg = {**BASE_CFG}  # no route_id
        cfg.pop("route_id", None)
        mock_api = MagicMock(spec=CloudflareAPI)
        with (
            patch("deploy.ask_bool", return_value=True),
            patch("deploy.CloudflareAPI", return_value=mock_api),
            patch("deploy.save_config"),
        ):
            do_delete(cfg, tmp_path / "cfg.json")
        mock_api.delete_route.assert_not_called()
        mock_api.delete_worker.assert_called_once()

    def test_saves_config_after_delete(self, tmp_path):
        cfg      = {**BASE_CFG, "route_id": "r-1", "kv_namespace_id": "kv-1"}
        cfg_path = tmp_path / "cfg.json"
        mock_api = MagicMock(spec=CloudflareAPI)
        with (
            patch("deploy.ask_bool", return_value=True),
            patch("deploy.CloudflareAPI", return_value=mock_api),
        ):
            do_delete(cfg, cfg_path)
        saved = json.loads(cfg_path.read_text())
        # deleted IDs should be removed; credentials kept
        assert "route_id"      not in saved
        assert "kv_namespace_id" not in saved
        assert saved["domain"] == "example.com"

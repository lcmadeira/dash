#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import socketserver
import time
import urllib.parse
import urllib.request
import urllib.error
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from ipaddress import ip_address


PORT = int(os.environ.get("PORT", "8000"))
PROXY_CACHE_TTL_SEC = 300  # 5 min
USER_AGENT = "dash-dev-proxy/1.0 (+local)"
UPSTREAM_TIMEOUT_SEC = int(os.environ.get("PROXY_TIMEOUT", "25"))


_cache: dict[str, tuple[float, dict[str, str], bytes]] = {}


def _is_private_host(hostname: str) -> bool:
    h = (hostname or "").strip().lower()
    if h in {"localhost", "127.0.0.1", "::1"}:
        return True
    # Best-effort: block raw IPs in private ranges
    try:
        ip = ip_address(h)
        return ip.is_private or ip.is_loopback or ip.is_link_local
    except Exception:
        return False


def _validate_target(url: str) -> tuple[bool, str]:
    try:
        parsed = urllib.parse.urlparse(url)
    except Exception:
        return False, "URL inválido"
    if parsed.scheme not in {"http", "https"}:
        return False, "Apenas http/https são permitidos"
    if not parsed.netloc:
        return False, "Host em falta"
    host = parsed.hostname or ""
    if _is_private_host(host):
        return False, "Host privado/local não permitido"
    return True, ""


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        # Allow dev CORS for same-machine browser
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self) -> None:
        if self.path.startswith("/proxy"):
            self._handle_proxy()
            return
        super().do_GET()

    def _handle_proxy(self) -> None:
        q = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(q)
        target = (params.get("url", [""])[0] or "").strip()

        ok, msg = _validate_target(target)
        if not ok:
            self._send_json({"ok": False, "error": msg}, status=HTTPStatus.BAD_REQUEST)
            return

        now = time.time()
        cached = _cache.get(target)
        if cached and now - cached[0] < PROXY_CACHE_TTL_SEC:
            headers, body = cached[1], cached[2]
            self._send_bytes(body, headers=headers, status=HTTPStatus.OK)
            return

        req = urllib.request.Request(
            target,
            headers={
                "User-Agent": USER_AGENT,
                # Forward Accept from browser when available (useful for content negotiation).
                "Accept": self.headers.get("Accept") or "*/*",
            },
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=UPSTREAM_TIMEOUT_SEC) as resp:
                body = resp.read()
                headers = {}
                ct = resp.headers.get("Content-Type")
                if ct:
                    headers["Content-Type"] = ct
                _cache[target] = (now, headers, body)
                self._send_bytes(body, headers=headers, status=HTTPStatus.OK)
        except urllib.error.HTTPError as e:
            # Forward upstream status/body as-is (so the browser sees 4xx/5xx instead of 502)
            try:
                body = e.read()
            except Exception:
                body = b""
            headers = {}
            ct = getattr(e, "headers", None) and e.headers.get("Content-Type")
            if ct:
                headers["Content-Type"] = ct
            self._send_bytes(body, headers=headers, status=int(getattr(e, "code", 502) or 502))
        except Exception as e:
            self._send_json({"ok": False, "error": str(e)}, status=HTTPStatus.BAD_GATEWAY)

    def _send_bytes(self, body: bytes, headers: dict[str, str] | None = None, status: int = 200) -> None:
        self.send_response(status)
        if headers:
            for k, v in headers.items():
                self.send_header(k, v)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self._send_bytes(body, headers={"Content-Type": "application/json; charset=utf-8"}, status=status)


def main() -> None:
    with ThreadingHTTPServer(("0.0.0.0", PORT), Handler) as httpd:
        print(f"Dev server: http://localhost:{PORT}")
        print("Proxy endpoint: /proxy?url=https://example.com")
        httpd.serve_forever()


if __name__ == "__main__":
    main()

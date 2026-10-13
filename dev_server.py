#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
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
    except ValueError:
        return False


def _validate_target(url: str) -> tuple[bool, str]:
    try:
        parsed = urllib.parse.urlparse(url)
    except ValueError:
        return False, "URL inválido"
    if parsed.scheme not in {"http", "https"}:
        return False, "Apenas http/https são permitidos"
    if not parsed.netloc or not parsed.hostname:
        return False, "Host em falta"
    if parsed.username is not None or parsed.password is not None:
        return False, "Credenciais na URL não são permitidas"
    try:
        port = parsed.port
    except ValueError:
        return False, "Porta inválida"
    if port is not None and not 1 <= port <= 65535:
        return False, "Porta inválida"
    host = parsed.hostname
    if _is_private_host(host):
        return False, "Host privado/local não permitido"
    return True, ""


def _is_allowed_origin(origin: str | None) -> bool:
    if not origin or origin == "null":
        return True
    try:
        parsed = urllib.parse.urlparse(origin)
        if parsed.scheme not in {"http", "https"} or parsed.username or parsed.password:
            return False
        host = (parsed.hostname or "").lower()
        port = parsed.port
    except ValueError:
        return False
    return host in {"localhost", "127.0.0.1", "::1"} and port in {None, PORT}


class SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        ok, error = _validate_target(new_url)
        if not ok:
            raise urllib.error.HTTPError(
                request.full_url,
                HTTPStatus.FORBIDDEN,
                f"Redirect bloqueado: {error}",
                headers,
                file_pointer,
            )
        return super().redirect_request(request, file_pointer, code, message, headers, new_url)


_PROXY_OPENER = urllib.request.build_opener(SafeRedirectHandler())


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        # Allow CORS only for local dashboard pages (including file:// origin null).
        origin = self.headers.get("Origin")
        if _is_allowed_origin(origin):
            self.send_header("Access-Control-Allow-Origin", origin or "*")
            self.send_header("Vary", "Origin")
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
        origin = self.headers.get("Origin")
        if not _is_allowed_origin(origin):
            self._send_json({"ok": False, "error": "Origem não permitida"}, status=HTTPStatus.FORBIDDEN)
            return

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
            with _PROXY_OPENER.open(req, timeout=UPSTREAM_TIMEOUT_SEC) as resp:
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
            except OSError:
                body = b""
            headers = {}
            ct = getattr(e, "headers", None) and e.headers.get("Content-Type")
            if ct:
                headers["Content-Type"] = ct
            self._send_bytes(body, headers=headers, status=int(getattr(e, "code", 502) or 502))
        except (OSError, TimeoutError, urllib.error.URLError) as e:
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
    with ThreadingHTTPServer(("127.0.0.1", PORT), Handler) as httpd:
        print(f"Dev server: http://localhost:{PORT}")
        print("Proxy endpoint: /proxy?url=https://example.com")
        httpd.serve_forever()


if __name__ == "__main__":
    main()

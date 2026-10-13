import unittest
from unittest.mock import patch

import dev_server


class ProxyTargetValidationTests(unittest.TestCase):
    def test_allows_public_http_targets(self):
        self.assertEqual(dev_server._validate_target("https://example.com/data"), (True, ""))

    def test_rejects_local_targets_and_non_http_schemes(self):
        self.assertFalse(dev_server._validate_target("http://127.0.0.1:8000/")[0])
        self.assertFalse(dev_server._validate_target("file:///etc/passwd")[0])

    def test_rejects_credentials_and_invalid_ports(self):
        self.assertFalse(dev_server._validate_target("https://user:pass@example.com/data")[0])
        self.assertFalse(dev_server._validate_target("https://example.com:invalid/data")[0])
        self.assertFalse(dev_server._validate_target("https://example.com:70000/data")[0])

    def test_cors_origin_is_limited_to_local_dashboard(self):
        self.assertTrue(dev_server._is_allowed_origin(None))
        self.assertTrue(dev_server._is_allowed_origin("null"))
        self.assertTrue(dev_server._is_allowed_origin(f"http://localhost:{dev_server.PORT}"))
        self.assertFalse(dev_server._is_allowed_origin("https://attacker.example"))
        self.assertFalse(dev_server._is_allowed_origin(f"http://localhost.evil:{dev_server.PORT}"))

    def test_redirect_handler_rejects_private_redirects(self):
        handler = dev_server.SafeRedirectHandler()
        request = dev_server.urllib.request.Request("https://example.com/start")
        with self.assertRaises(dev_server.urllib.error.HTTPError) as raised:
            handler.redirect_request(
                request, None, 302, "Found", {}, "http://127.0.0.1:8000/private",
            )
        self.assertEqual(raised.exception.code, 403)
        raised.exception.close()

    def test_server_binds_to_loopback(self):
        seen = {}

        class FakeServer:
            def __init__(self, address, handler):
                seen["address"] = address
                seen["handler"] = handler

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def serve_forever(self):
                return None

        with patch.object(dev_server, "ThreadingHTTPServer", FakeServer):
            dev_server.main()

        self.assertEqual(seen["address"], ("127.0.0.1", dev_server.PORT))
        self.assertIs(seen["handler"], dev_server.Handler)


if __name__ == "__main__":
    unittest.main()

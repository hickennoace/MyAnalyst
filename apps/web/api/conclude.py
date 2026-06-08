"""Vercel Python Serverless Function: facts -> grounded LLM conclusions.

Route: /api/conclude
  POST {"facts": [...], "domain": str, "userContext": str?, "narrative": str?}
    -> {provider, bottomLine, conclusions[], actions[], grounding, disclaimer}
Falls back to the deterministic templated narrative when no LLM key is set or the call fails.
"""
from http.server import BaseHTTPRequestHandler
import json

from _conclude import generate_conclusions


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._send(200, {"ok": True, "route": "conclude", "usage": "POST {facts, domain, userContext?}"})

    def do_POST(self):
        try:
            length = int(self.headers.get("content-length", 0))
            payload = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
            facts = payload.get("facts") or []
            if not facts:
                self._send(400, {"error": "Provide 'facts' (from /api/analyze)."})
                return
            self._send(200, generate_conclusions(
                facts,
                domain=payload.get("domain", "generic"),
                user_context=payload.get("userContext"),
                templated_fallback=payload.get("narrative", ""),
            ))
        except Exception as exc:  # noqa: BLE001
            self._send(400, {"error": str(exc)})

    def do_OPTIONS(self):
        self._send(204, None)

    def _send(self, code, obj):
        body = b"" if obj is None else json.dumps(obj, default=str).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        if body:
            self.wfile.write(body)

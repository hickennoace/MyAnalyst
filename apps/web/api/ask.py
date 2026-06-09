"""Vercel Python Serverless Function: ask-your-data.

Route: /api/ask
  POST {"question": str, "columns": [...], "rows": [[...]], "facts": [...]?}
    -> {provider, answer}
"""
from http.server import BaseHTTPRequestHandler
import json

import pandas as pd

from _ask import answer_question


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._send(200, {"ok": True, "route": "ask", "usage": "POST {question, columns, rows, facts?}"})

    def do_POST(self):
        try:
            length = int(self.headers.get("content-length", 0))
            payload = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
            question = (payload.get("question") or "").strip()
            if not question:
                self._send(400, {"error": "Provide a 'question'."})
                return
            if payload.get("csv"):
                from io import StringIO
                df = pd.read_csv(StringIO(payload["csv"]))
            else:
                df = pd.DataFrame(payload.get("rows", []), columns=payload.get("columns"))
            if df.empty:
                self._send(400, {"error": "No data to answer over."})
                return
            self._send(200, answer_question(df, question, payload.get("facts")))
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

"""Vercel Python Serverless Function: POST data -> analysis spec (pandas engine).

Route: /api/analyze
  POST {"csv": "<raw csv text>"}            -> analyze a CSV
  POST {"columns": [...], "rows": [[...]]}  -> analyze parsed rows
  GET                                       -> health check

Note Vercel's 4.5 MB request-body limit: the frontend samples large files before sending.
"""
from http.server import BaseHTTPRequestHandler
from io import StringIO
import json

import pandas as pd

from _engine import analyze


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._send(200, {"ok": True, "engine": "python-pandas", "usage": "POST {csv} or {columns, rows}"})

    def do_POST(self):
        try:
            length = int(self.headers.get("content-length", 0))
            payload = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
            if payload.get("csv"):
                df = pd.read_csv(StringIO(payload["csv"]))
            elif payload.get("rows") is not None:
                df = pd.DataFrame(payload["rows"], columns=payload.get("columns"))
            else:
                self._send(400, {"error": "Provide 'csv' (raw text) or 'rows' (+optional 'columns')."})
                return
            if df.empty:
                self._send(400, {"error": "No rows to analyze."})
                return
            self._send(200, analyze(df))
        except Exception as exc:  # noqa: BLE001 - surface any analysis error as a 400 to the client
            self._send(400, {"error": str(exc)})

    def do_OPTIONS(self):
        self._send(204, None)

    def _send(self, code: int, obj):
        body = b"" if obj is None else json.dumps(obj, default=str).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        if body:
            self.wfile.write(body)

"""Single Python entrypoint for Vercel (the Next.js-compatible pattern).

Next.js owns the `/api/*` namespace, so standalone `api/analyze.py` etc. don't route. Instead, a platform
rewrite in vercel.json sends `/api/analyze|conclude|ask` here as `/api/index?fn=...`, and this dispatches.
"""
from http.server import BaseHTTPRequestHandler
from io import StringIO
from urllib.parse import urlparse, parse_qs
import json

import numpy as np
import pandas as pd

from _engine import analyze
from _conclude import generate_conclusions
from _ask import answer_question


def _jsonable(o):
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, np.floating):
        return None if np.isnan(o) else float(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    if isinstance(o, float) and o != o:
        return None
    return str(o)


def _df_from(payload):
    if payload.get("csv"):
        return pd.read_csv(StringIO(payload["csv"]))
    return pd.DataFrame(payload.get("rows", []), columns=payload.get("columns"))


class handler(BaseHTTPRequestHandler):
    def _fn(self):
        q = parse_qs(urlparse(self.path).query)
        if q.get("fn"):
            return q["fn"][0]
        p = urlparse(self.path).path.rstrip("/")
        return p.rsplit("/", 1)[-1]  # last path segment (analyze/conclude/ask)

    def do_GET(self):
        self._send(200, {"ok": True, "engine": "python-pandas", "fn": self._fn()})

    def do_POST(self):
        try:
            length = int(self.headers.get("content-length", 0))
            payload = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
            fn = self._fn()
            if fn == "conclude":
                facts = payload.get("facts") or []
                if not facts:
                    return self._send(400, {"error": "Provide 'facts'."})
                return self._send(200, generate_conclusions(
                    facts, domain=payload.get("domain", "generic"), user_context=payload.get("userContext"),
                    templated_fallback=payload.get("narrative", ""), kpis=payload.get("kpis"),
                    chart_readings=payload.get("chartReadings")))
            if fn == "ask":
                question = (payload.get("question") or "").strip()
                if not question:
                    return self._send(400, {"error": "Provide a 'question'."})
                df = _df_from(payload)
                if df.empty:
                    return self._send(400, {"error": "No data to answer over."})
                return self._send(200, answer_question(df, question, payload.get("facts")))
            # default: analyze
            df = _df_from(payload)
            if df.empty:
                return self._send(400, {"error": "Provide 'csv' or 'rows'."})
            return self._send(200, analyze(df))
        except Exception as exc:  # noqa: BLE001
            self._send(400, {"error": str(exc)})

    def do_OPTIONS(self):
        self._send(204, None)

    def _send(self, code, obj):
        body = b"" if obj is None else json.dumps(obj, default=_jsonable).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        if body:
            self.wfile.write(body)

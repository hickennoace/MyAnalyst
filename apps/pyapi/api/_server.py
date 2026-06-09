"""Local Python API server — run the analysis backend on your machine.

Vercel doesn't build standalone /api/*.py inside a Next.js app (Next owns /api), so for local development we
run the Python engine as its own little server and point the frontend at it via NEXT_PUBLIC_PY_API. This is
the same "separate API" architecture we'll deploy to Vercel as its own project.

Run:  py apps/web/api/_server.py        (serves on http://127.0.0.1:8000)
Then: in apps/web, `npm run dev` with NEXT_PUBLIC_PY_API=http://127.0.0.1:8000  →  /analyze uses Python.

Reuses the same dispatcher (index.handler) the Vercel function uses, so behaviour is identical.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from http.server import ThreadingHTTPServer  # noqa: E402
from index import handler  # noqa: E402

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print(f"MyAnalyst Python API -> http://127.0.0.1:{port}")
    print("  POST /api/analyze | /api/conclude | /api/ask   (CORS enabled)")
    print(f"  set NEXT_PUBLIC_PY_API=http://127.0.0.1:{port} in apps/web/.env.local, then `npm run dev`")
    try:
        ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
    except KeyboardInterrupt:
        print("\nstopped.")

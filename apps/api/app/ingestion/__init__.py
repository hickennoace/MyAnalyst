"""Stage 1 — Ingestion.

Parse raw input into a normalized tabular frame, then persist as Parquet to object storage.

Inputs : CSV, Excel (.xlsx/.xls), JSON, or a read-only SQL cursor.
Output : typed Arrow/Parquet working set + an ingestion manifest (source, rows, cols).

Safety : enforce size/row caps, validate file type, sandbox parsing, scan spreadsheets
         for formula-injection (leading = + - @). Never eval/pickle untrusted input.

Libs   : pandas / polars (large files), pyarrow, openpyxl, SQLAlchemy.
TODO   : implement per-format parsers behind a common `ingest(source) -> Parquet ref` API.
"""

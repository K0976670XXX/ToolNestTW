import os, sys, mimetypes
from pathlib import Path
from flask import Flask, send_file, abort, request, Response
from waitress import serve

os.chdir(sys.path[0])
BASE_DIR = Path(".").resolve()

app = Flask(__name__, static_folder=None)


def safe_path(path_str: str) -> Path:
    full = (BASE_DIR / path_str).resolve()
    if not str(full).startswith(str(BASE_DIR)):
        abort(403)
    if not full.exists():
        abort(404)
    return full


def send_with_range(path: Path):
    file_size = path.stat().st_size
    range_header = request.headers.get("Range")
    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"

    if not range_header:
        res = send_file(path, mimetype=mime)
        res.headers["Cache-Control"] = "public, max-age=86400"
        return res

    bytes_range = range_header.replace("bytes=", "")
    start, end = bytes_range.split("-")

    start = int(start) if start else 0
    end = int(end) if end else file_size - 1
    length = end - start + 1

    with open(path, "rb") as f:
        f.seek(start)
        data = f.read(length)

    rv = Response(data, 206, mimetype=mime, direct_passthrough=True)
    rv.headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"
    rv.headers["Accept-Ranges"] = "bytes"
    rv.headers["Content-Length"] = str(length)
    rv.headers["Cache-Control"] = "public, max-age=86400"
    return rv


@app.route("/", defaults={"req_path": ""})
@app.route("/<path:req_path>")
def handle_request(req_path):
    path = safe_path(req_path or ".")

    if path.is_dir():
        index = path / "index.html"
        if index.exists():
            return send_with_range(index)
        abort(404)

    return send_with_range(path)


if __name__ == "__main__":
    print("Server running → http://localhost:8102/")
    serve(app, host="0.0.0.0", port=8102)


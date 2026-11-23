"""Adaptador WSGI de English Quest (para hospedarlo en PythonAnywhere u otro servicio).
Reutiliza exactamente la misma lógica de app.py: mismo juego, mismo panel y misma base de datos SQLite."""
import io

import app

app.init_db()


class _Headers:
    """Cabeceras HTTP sin distinguir mayúsculas, con la interfaz .get() que usa app.py."""

    def __init__(self, environ):
        self._h = {}
        for k, v in environ.items():
            if k.startswith("HTTP_"):
                self._h[k[5:].replace("_", "-").lower()] = v
        if environ.get("CONTENT_TYPE"):
            self._h["content-type"] = environ["CONTENT_TYPE"]
        if environ.get("CONTENT_LENGTH"):
            self._h["content-length"] = environ["CONTENT_LENGTH"]

    def get(self, name, default=None):
        return self._h.get(name.lower(), default)


class _Request(app.Handler):
    def __init__(self, environ):  # noqa: no llamamos al __init__ del servidor de escritorio
        qs = environ.get("QUERY_STRING", "")
        self.path = environ.get("PATH_INFO", "/") + ("?" + qs if qs else "")
        self.headers = _Headers(environ)
        self.rfile = environ["wsgi.input"]
        fwd = environ.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
        self.client_address = (fwd or environ.get("REMOTE_ADDR", "0.0.0.0"), 0)
        self.reply = (500, b"", "text/plain", {})

    def send(self, code, data, ctype, headers=None):
        self.reply = (code, data, ctype, dict(headers or {}))


_STATUS = {200: "OK", 400: "Bad Request", 401: "Unauthorized", 404: "Not Found", 405: "Method Not Allowed",
           409: "Conflict", 413: "Payload Too Large", 415: "Unsupported Media Type", 429: "Too Many Requests",
           500: "Internal Server Error"}


def application(environ, start_response):
    req = _Request(environ)
    req.dispatch(environ.get("REQUEST_METHOD", "GET").upper())
    code, data, ctype, extra = req.reply
    headers = [("Content-Type", ctype), ("Content-Length", str(len(data))),
               ("X-Content-Type-Options", "nosniff"), ("Referrer-Policy", "same-origin")]
    headers += list(extra.items())
    start_response(f"{code} {_STATUS.get(code, 'OK')}", headers)
    return [data]

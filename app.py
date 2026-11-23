#!/usr/bin/env python3
"""English Quest - servidor + base de datos (solo biblioteca estándar de Python 3.8+).

Uso:   python3 app.py
Luego: Juego estudiantes  -> http://localhost:8000/
       Panel profesora    -> http://localhost:8000/admin   (usuario: admin / clave: admin123)
Variables opcionales: PORT, HOST, DB_PATH
"""
import csv
import hashlib
import hmac
import io
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

BASE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(BASE, "static")
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE, "english_quest.db"))
SESSION_SECONDS = 8 * 3600
DEFAULT_USER, DEFAULT_PASS = "admin", "admin123"

THEMES = ["cielo", "ciudad", "noche", "atardecer", "bosque"]
MEDALS = ["bronce", "plata", "oro", "trofeo"]
HAIR_STYLES = ["bun", "short", "long", "spiky", "cap"]
OUTFIT_STYLES = ["robe", "tshirt", "hoodie"]
ACCESSORIES = ["none", "glasses", "headphones", "book"]
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
TOKEN = re.compile(r"^[A-Za-z0-9_-]{16,64}$")
USERNAME = re.compile(r"^[a-zA-Z0-9_.-]{3,32}$")

DEFAULT_GUIDE = {"skin": "#f2c9a0", "hair": "#8a4b2d", "hairStyle": "bun",
                 "outfit": "#a3237c", "outfitStyle": "robe", "accessory": "none"}

DEFAULT_SETTINGS = {
    "title": "English Quest: El Desafío del Sílabo",
    "subtitle": "Módulo Formativo N° 2 · Interpretación y Redacción de Textos",
    "instructions": "Recorrerás 4 mundos basados en los indicadores de logro del sílabo.\n"
                    "Cada mundo tiene preguntas de opción múltiple y retos prácticos.\n"
                    "Si respondes bien, avanzas; si fallas, podrás reintentar.",
    "final_message": "Has recorrido con éxito las 17 sesiones del sílabo de Interpretación y "
                     "Redacción de Textos para Diseño y Programación Web. ¡Estás preparado(a) "
                     "para tu evaluación final!",
}

SEED = [
    {"name": "Pasado y Voz Pasiva", "description": "Sesiones 1 a 4", "theme": "cielo", "medal": "bronce",
     "checkpoint": "¡Has superado el Bloque 1! Dominaste el Pasado Simple y la Voz Pasiva (Sesiones 1 a 4).",
     "questions": [
         ("Nivel 1 - Reto 1", "Utiliza el Simple Past empleando verbos regulares e irregulares.",
          "¿Cuál es la forma correcta en pasado del verbo code y el verbo be (para the server)?",
          ["coded / were", "code / was", "coded / was"], 2),
         ("Nivel 1 - Reto 2", "Identifica la estructura de la voz pasiva en presente.",
          "En tu carrera lees documentación técnica. ¿Cómo se dice \"El código es compilado\"?",
          ["The code is compiled", "The code compiles", "The code was compiled"], 0),
         ("Nivel 1 - Reto 3", "Analiza un texto en voz pasiva del tiempo pasado.",
          "Selecciona la oración redactada correctamente en voz pasiva pasada:",
          ["The web pages were designed by the developer.", "The web pages was design by the developer.",
           "The web pages are designed yesterday."], 0),
     ]},
    {"name": "Continuos y Futuros", "description": "Sesiones 5 a 7", "theme": "ciudad", "medal": "plata",
     "checkpoint": "¡Excelente trabajo! Ya dominas los tiempos continuos y los planes de desarrollo a futuro (Sesiones 5 a 7).",
     "questions": [
         ("Nivel 2 - Reto 1", "Comprende la estructura del presente continuo y reglas de gerundio (-ing).",
          "¿Cuál es la forma correcta del verbo debug (depurar código) en gerundio?",
          ["debuging", "debugging", "debuged"], 1),
         ("Nivel 2 - Reto 2", "Expresa planes futuros con going to en situaciones cotidianas y laborales.",
          "Completa la frase: \"We _____ launch the new mobile app next week.\"",
          ["is going to", "are going to", "will going to"], 1),
         ("Nivel 2 - Reto 3", "Auxiliar Will: promesas, predicciones y decisiones de momento.",
          "Si un usuario reporta un error en la web y decides arreglarlo al instante, ¿qué dices?",
          ["I will fix that bug right now!", "I am going to fix it yesterday.", "I fix it last week."], 0),
     ]},
    {"name": "Modales e Imperativos", "description": "Sesiones 8 a 14", "theme": "noche", "medal": "oro",
     "checkpoint": "¡Impresionante avance! Has dominado la redacción de instrucciones de usuario y documentación técnica intermedia (Sesiones 8 a 14).",
     "questions": [
         ("Nivel 3 - Reto 1", "Usa verbos modales (can, could, should, must) para expresar habilidades y obligaciones.",
          "¿Qué modal indica una prohibición estricta de seguridad informática?",
          ["Mustn't", "Can", "Might"], 0),
         ("Nivel 3 - Reto 2", "Emplea verbos imperativos elaborando instrucciones y advertencias (Don't + verb).",
          "Traduce la advertencia de sistema: \"No borre la base de datos\".",
          ["You don't delete the database.", "Don't delete the database!", "Let's delete the database."], 1),
         ("Nivel 3 - Reto 3", "Práctica intermedia integrando voz pasiva, will y going to.",
          "¿Cuál de los siguientes enunciados redacta correctamente un objetivo de desarrollo web?",
          ["\"Next month, I will optimize the website loading speed.\"", "\"Next month, I optimizing website speed.\"",
           "\"Next month, website speed was optimize.\""], 0),
     ]},
    {"name": "Reported Speech y Cierre", "description": "Sesiones 15 a 17", "theme": "atardecer", "medal": "trofeo",
     "checkpoint": "¡Completaste el último mundo! Ya sabes reportar lo que dicen los clientes y redactar tu proyecto final.",
     "questions": [
         ("Nivel 4 - Reto 1", "Analiza el discurso indirecto (Reported Speech) en tiempos presentes y pasados.",
          "Si un cliente dice en presente: \"I need an online store\", ¿cómo cambia el verbo en reported speech (pasado)?",
          ["needed (pasa a pasado simple)", "needing", "Se queda exactamente igual sin cambios."], 0),
         ("Nivel 4 - Reto Final", "Redacta un texto integrando las diversas estructuras gramaticales referidas a Diseño y Programación Web.",
          "Para cerrar con éxito el curso, ¿qué debes demostrar en tu proyecto final?",
          ["Solo memorizar etiquetas HTML sin gramática en inglés.",
           "Aplicar de forma coherente tiempos verbales, voz pasiva y redacción técnica vinculada al desarrollo web y móvil.",
           "No entregar nada."], 1),
     ]},
]

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL,
  salt TEXT NOT NULL, pwhash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(sid TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires REAL NOT NULL);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS worlds(id INTEGER PRIMARY KEY, position INTEGER NOT NULL, name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '', theme TEXT NOT NULL DEFAULT 'cielo', medal TEXT NOT NULL DEFAULT 'bronce',
  checkpoint_text TEXT NOT NULL DEFAULT '', character TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS questions(id INTEGER PRIMARY KEY, world_id INTEGER NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, label TEXT NOT NULL DEFAULT '', objective TEXT NOT NULL DEFAULT '', prompt TEXT NOT NULL,
  options TEXT NOT NULL, correct INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS submissions(id INTEGER PRIMARY KEY, token TEXT UNIQUE NOT NULL, full_name TEXT NOT NULL,
  cycle TEXT NOT NULL, course TEXT NOT NULL, avatar TEXT NOT NULL, first_try INTEGER NOT NULL, total INTEGER NOT NULL,
  attempts_count INTEGER NOT NULL, created_at TEXT NOT NULL, worlds_done INTEGER NOT NULL DEFAULT 0, finished INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS attempts(id INTEGER PRIMARY KEY, token TEXT NOT NULL, question_id INTEGER, world_name TEXT NOT NULL,
  label TEXT NOT NULL, prompt TEXT NOT NULL, chosen_text TEXT NOT NULL, correct_text TEXT NOT NULL,
  is_correct INTEGER NOT NULL, attempt_no INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_attempts_token ON attempts(token);
"""


# ---------------------------------------------------------------- utilidades
class ApiError(Exception):
    def __init__(self, code, msg):
        super().__init__(msg)
        self.code, self.msg = code, msg


def db():
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    return con


def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def hash_pw(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000).hex()
    return salt, digest


def check_pw(password, salt, digest):
    return hmac.compare_digest(hash_pw(password, salt)[1], digest)


def clip(value, n, field="campo", required=False, min_len=0):
    s = str(value if value is not None else "").strip()
    if required and not s:
        raise ApiError(400, f"Falta {field}.")
    if min_len and len(s) < min_len:
        raise ApiError(400, f"{field} es demasiado corto.")
    return s[:n]


def sanitize_char(c):
    c = c if isinstance(c, dict) else {}
    out = dict(DEFAULT_GUIDE)
    for k in ("skin", "hair", "outfit"):
        if isinstance(c.get(k), str) and HEX.match(c[k]):
            out[k] = c[k].lower()
    for k, allowed in (("hairStyle", HAIR_STYLES), ("outfitStyle", OUTFIT_STYLES), ("accessory", ACCESSORIES)):
        if c.get(k) in allowed:
            out[k] = c[k]
    return out


def get_settings(con):
    s = dict(DEFAULT_SETTINGS)
    for r in con.execute("SELECT key, value FROM settings"):
        if r["key"] in s:
            s[r["key"]] = r["value"]
    return s


def init_db():
    con = db()
    con.executescript(SCHEMA)
    con.execute("PRAGMA journal_mode=WAL")
    cols = [r[1] for r in con.execute("PRAGMA table_info(submissions)")]
    if "worlds_done" not in cols:
        con.execute("ALTER TABLE submissions ADD COLUMN worlds_done INTEGER NOT NULL DEFAULT 0")
    if "finished" not in cols:
        con.execute("ALTER TABLE submissions ADD COLUMN finished INTEGER NOT NULL DEFAULT 0")
        con.execute("UPDATE submissions SET finished=1")  # resultados anteriores ya estaban enviados
    if not con.execute("SELECT 1 FROM users").fetchone():
        salt, digest = hash_pw(DEFAULT_PASS)
        con.execute("INSERT INTO users(username, display_name, salt, pwhash, created_at) VALUES(?,?,?,?,?)",
                    (DEFAULT_USER, "Administrador", salt, digest, now()))
    if not con.execute("SELECT 1 FROM worlds").fetchone():
        for wi, w in enumerate(SEED):
            cur = con.execute(
                "INSERT INTO worlds(position,name,description,theme,medal,checkpoint_text,character) VALUES(?,?,?,?,?,?,?)",
                (wi, w["name"], w["description"], w["theme"], w["medal"], w["checkpoint"], json.dumps(DEFAULT_GUIDE)))
            for qi, (label, obj, prompt, opts, correct) in enumerate(w["questions"]):
                con.execute("INSERT INTO questions(world_id,position,label,objective,prompt,options,correct) VALUES(?,?,?,?,?,?,?)",
                            (cur.lastrowid, qi, label, obj, prompt, json.dumps(opts, ensure_ascii=False), correct))
    con.commit()
    con.close()


def world_dict(w, questions):
    return {"id": w["id"], "position": w["position"], "name": w["name"], "description": w["description"],
            "theme": w["theme"], "medal": w["medal"], "checkpoint_text": w["checkpoint_text"],
            "character": json.loads(w["character"]), "questions": questions}


def question_dict(q, with_answer):
    d = {"id": q["id"], "world_id": q["world_id"], "label": q["label"], "objective": q["objective"],
         "prompt": q["prompt"], "options": json.loads(q["options"])}
    if with_answer:
        d["correct"] = q["correct"]
    return d


def load_worlds(con, with_answer):
    worlds = []
    for w in con.execute("SELECT * FROM worlds ORDER BY position, id"):
        qs = [question_dict(q, with_answer) for q in
              con.execute("SELECT * FROM questions WHERE world_id=? ORDER BY position, id", (w["id"],))]
        worlds.append(world_dict(w, qs))
    return worlds


def renumber(con, table, ids, ):
    for i, _id in enumerate(ids):
        con.execute(f"UPDATE {table} SET position=? WHERE id=?", (i, _id))


def move(con, table, item_id, direction, scope=None):
    row = con.execute(f"SELECT * FROM {table} WHERE id=?", (item_id,)).fetchone()
    if not row:
        raise ApiError(404, "No existe.")
    if scope:
        sibs = [r["id"] for r in con.execute(f"SELECT id FROM {table} WHERE {scope}=? ORDER BY position, id", (row[scope],))]
    else:
        sibs = [r["id"] for r in con.execute(f"SELECT id FROM {table} ORDER BY position, id")]
    i = sibs.index(item_id)
    j = i - 1 if direction == "up" else i + 1
    if 0 <= j < len(sibs):
        sibs[i], sibs[j] = sibs[j], sibs[i]
    renumber(con, table, sibs)


def parse_world_fields(body, partial=False):
    name = clip(body.get("name"), 80, "el nombre del mundo", required=True)
    theme = body.get("theme") if body.get("theme") in THEMES else "cielo"
    medal = body.get("medal") if body.get("medal") in MEDALS else "bronce"
    return (name, clip(body.get("description"), 120), theme, medal,
            clip(body.get("checkpoint_text"), 300), json.dumps(sanitize_char(body.get("character"))))


def parse_question_fields(body):
    opts = body.get("options")
    if not isinstance(opts, list):
        raise ApiError(400, "Faltan las opciones.")
    opts = [clip(o, 200) for o in opts]
    if len(opts) < 2 or len(opts) > 4 or any(not o for o in opts):
        raise ApiError(400, "Debe haber entre 2 y 4 opciones, todas con texto.")
    try:
        correct = int(body.get("correct"))
    except (TypeError, ValueError):
        raise ApiError(400, "Indica cuál es la respuesta correcta.")
    if not 0 <= correct < len(opts):
        raise ApiError(400, "Respuesta correcta inválida.")
    return (clip(body.get("label"), 80), clip(body.get("objective"), 300),
            clip(body.get("prompt"), 500, "la pregunta", required=True), json.dumps(opts, ensure_ascii=False), correct)


def csv_safe(v):
    s = str(v)
    return "'" + s if s[:1] in ("=", "+", "-", "@") else s


def recompute(con, token):
    """Recalcula y guarda el avance del estudiante a partir de sus intentos."""
    total = con.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
    first = con.execute("SELECT COUNT(DISTINCT question_id) FROM attempts WHERE token=? AND attempt_no=1 AND is_correct=1", (token,)).fetchone()[0]
    count = con.execute("SELECT COUNT(*) FROM attempts WHERE token=?", (token,)).fetchone()[0]
    done = con.execute(
        "SELECT COUNT(*) FROM worlds w WHERE EXISTS(SELECT 1 FROM questions q WHERE q.world_id=w.id) AND NOT EXISTS("
        "SELECT 1 FROM questions q WHERE q.world_id=w.id AND NOT EXISTS("
        "SELECT 1 FROM attempts a WHERE a.token=? AND a.question_id=q.id AND a.is_correct=1))", (token,)).fetchone()[0]
    con.execute("UPDATE submissions SET first_try=?,total=?,attempts_count=?,worlds_done=? WHERE token=?", (first, total, count, done, token))
    return first, total, done


def valid_token(body):
    token = body.get("token")
    if not isinstance(token, str) or not TOKEN.match(token):
        raise ApiError(400, "Sesión inválida.")
    return token


FAILS = {}


# ---------------------------------------------------------------- API
def handle_api(h, method, path, query):
    body = h.read_json() if method in ("POST", "PUT") else {}
    con = db()
    try:
        # ----- público
        if method == "GET" and path == "/api/game":
            worlds = [w for w in load_worlds(con, False) if w["questions"]]
            return {"settings": get_settings(con), "worlds": worlds}

        if method == "POST" and path == "/api/start":
            token = valid_token(body)
            name = clip(body.get("full_name"), 120, "tu nombre completo", required=True, min_len=3)
            cycle = clip(body.get("cycle"), 30, "el ciclo", required=True)
            course = clip(body.get("course"), 80, "el curso", required=True)
            avatar = json.dumps(sanitize_char(body.get("avatar")))
            sub = con.execute("SELECT finished FROM submissions WHERE token=?", (token,)).fetchone()
            if sub and sub["finished"]:
                raise ApiError(409, "Esta partida ya fue enviada.")
            if sub:
                con.execute("UPDATE submissions SET full_name=?,cycle=?,course=?,avatar=? WHERE token=?", (name, cycle, course, avatar, token))
            else:
                total = con.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
                con.execute("INSERT INTO submissions(token,full_name,cycle,course,avatar,first_try,total,attempts_count,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
                            (token, name, cycle, course, avatar, 0, total, 0, now()))
            con.commit()
            return {"ok": True}

        if method == "POST" and path == "/api/world_done":
            token = valid_token(body)
            sub = con.execute("SELECT finished FROM submissions WHERE token=?", (token,)).fetchone()
            if not sub:
                raise ApiError(400, "Primero escribe tus datos.")
            if sub["finished"]:
                raise ApiError(409, "Esta partida ya fue enviada.")
            wid = body.get("world_id")
            missing = con.execute("SELECT COUNT(*) FROM questions q WHERE q.world_id=? AND NOT EXISTS("
                                  "SELECT 1 FROM attempts a WHERE a.token=? AND a.question_id=q.id AND a.is_correct=1)", (wid, token)).fetchone()[0]
            if missing or not con.execute("SELECT 1 FROM worlds WHERE id=?", (wid,)).fetchone():
                raise ApiError(400, "Aún faltan preguntas por acertar en este mundo.")
            first, total, done = recompute(con, token)
            con.commit()
            return {"saved": True, "first_try": first, "total": total, "worlds_done": done}

        if method == "POST" and path == "/api/check":
            token = valid_token(body)
            sub = con.execute("SELECT finished FROM submissions WHERE token=?", (token,)).fetchone()
            if not sub:
                raise ApiError(400, "Primero escribe tus datos.")
            if sub["finished"]:
                raise ApiError(409, "Esta partida ya fue enviada.")
            q = con.execute("SELECT q.*, w.name AS wname FROM questions q JOIN worlds w ON w.id=q.world_id WHERE q.id=?",
                            (body.get("question_id"),)).fetchone()
            if not q:
                raise ApiError(404, "Pregunta no encontrada.")
            opts = json.loads(q["options"])
            try:
                choice = int(body.get("choice"))
            except (TypeError, ValueError):
                raise ApiError(400, "Opción inválida.")
            if not 0 <= choice < len(opts):
                raise ApiError(400, "Opción inválida.")
            ok = choice == q["correct"]
            if con.execute("SELECT 1 FROM attempts WHERE token=? AND question_id=? AND is_correct=1", (token, q["id"])).fetchone():
                return {"correct": ok, "repeat": True}
            n = con.execute("SELECT COUNT(*) FROM attempts WHERE token=? AND question_id=?", (token, q["id"])).fetchone()[0] + 1
            con.execute("INSERT INTO attempts(token,question_id,world_name,label,prompt,chosen_text,correct_text,is_correct,attempt_no,created_at)"
                        " VALUES(?,?,?,?,?,?,?,?,?,?)",
                        (token, q["id"], q["wname"], q["label"], q["prompt"], opts[choice], opts[q["correct"]], int(ok), n, now()))
            con.commit()
            return {"correct": ok, "attempt": n}

        if method == "POST" and path == "/api/finish":
            token = valid_token(body)
            sub = con.execute("SELECT finished FROM submissions WHERE token=?", (token,)).fetchone()
            if not sub:
                raise ApiError(400, "Primero escribe tus datos.")
            if sub["finished"]:
                raise ApiError(409, "Esta partida ya fue enviada.")
            if not con.execute("SELECT 1 FROM attempts WHERE token=?", (token,)).fetchone():
                raise ApiError(400, "Aún no has respondido ninguna pregunta.")
            first, total, done = recompute(con, token)
            con.execute("UPDATE submissions SET finished=1, avatar=? WHERE token=?", (json.dumps(sanitize_char(body.get("avatar"))), token))
            con.commit()
            return {"ok": True, "first_try": first, "total": total}

        # ----- login
        if method == "POST" and path == "/api/admin/login":
            ip = h.client_address[0]
            fails = [t for t in FAILS.get(ip, []) if time.time() - t < 300]
            if len(fails) >= 10:
                raise ApiError(429, "Demasiados intentos. Espera unos minutos.")
            u = con.execute("SELECT * FROM users WHERE username=?", (clip(body.get("username"), 40),)).fetchone()
            if not u or not check_pw(str(body.get("password", "")), u["salt"], u["pwhash"]):
                fails.append(time.time())
                FAILS[ip] = fails
                raise ApiError(401, "Usuario o contraseña incorrectos.")
            FAILS.pop(ip, None)
            con.execute("DELETE FROM sessions WHERE expires<?", (time.time(),))
            sid = secrets.token_urlsafe(32)
            con.execute("INSERT INTO sessions(sid,user_id,expires) VALUES(?,?,?)", (sid, u["id"], time.time() + SESSION_SECONDS))
            con.commit()
            return ({"ok": True}, 200, {"Set-Cookie": f"sid={sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age={SESSION_SECONDS}"})

        # ----- todo lo demás requiere sesión de administrador
        me = h.current_user(con)
        if not me:
            raise ApiError(401, "Inicia sesión.")

        if method == "POST" and path == "/api/admin/logout":
            con.execute("DELETE FROM sessions WHERE sid=?", (h.cookie("sid"),))
            con.commit()
            return ({"ok": True}, 200, {"Set-Cookie": "sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"})

        if method == "GET" and path == "/api/admin/me":
            default = check_pw(DEFAULT_PASS, me["salt"], me["pwhash"])
            return {"id": me["id"], "username": me["username"], "display_name": me["display_name"], "default_password": default}

        # resultados
        if method == "GET" and path == "/api/admin/submissions":
            rows = con.execute("SELECT id,full_name,cycle,course,avatar,first_try,total,attempts_count,created_at,worlds_done,finished FROM submissions ORDER BY id DESC").fetchall()
            return [{**dict(r), "avatar": json.loads(r["avatar"])} for r in rows]

        m = re.fullmatch(r"/api/admin/submissions/(\d+)", path)
        if m:
            sid_ = int(m.group(1))
            s = con.execute("SELECT * FROM submissions WHERE id=?", (sid_,)).fetchone()
            if not s:
                raise ApiError(404, "No existe.")
            if method == "GET":
                att = [dict(a) for a in con.execute("SELECT * FROM attempts WHERE token=? ORDER BY id", (s["token"],))]
                return {**dict(s), "avatar": json.loads(s["avatar"]), "attempts": att}
            if method == "DELETE":
                con.execute("DELETE FROM attempts WHERE token=?", (s["token"],))
                con.execute("DELETE FROM submissions WHERE id=?", (sid_,))
                con.commit()
                return {"ok": True}

        if method == "GET" and path == "/api/admin/stats":
            rows = con.execute(
                "SELECT a.world_name, a.label, a.prompt, COUNT(DISTINCT a.token) students,"
                " SUM(CASE WHEN a.attempt_no=1 AND a.is_correct=1 THEN 1 ELSE 0 END) first_ok, COUNT(*) attempts"
                " FROM attempts a JOIN submissions s ON s.token=a.token GROUP BY a.world_name,a.label,a.prompt ORDER BY MIN(a.id)").fetchall()
            return [dict(r) for r in rows]

        if method == "GET" and path == "/api/admin/export.csv":
            out = io.StringIO()
            wr = csv.writer(out)
            wr.writerow(["Nombre completo", "Ciclo", "Curso", "Fecha", "Mundo", "Nivel", "Pregunta", "Respuesta elegida", "Respuesta correcta", "¿Correcta?", "N° de intento"])
            for r in con.execute("SELECT s.full_name,s.cycle,s.course,a.created_at,a.world_name,a.label,a.prompt,a.chosen_text,a.correct_text,a.is_correct,a.attempt_no"
                                 " FROM attempts a JOIN submissions s ON s.token=a.token ORDER BY s.id, a.id"):
                v = list(r)
                v[9] = "Sí" if v[9] else "No"
                wr.writerow([csv_safe(x) for x in v])
            data = ("\ufeff" + out.getvalue()).encode("utf-8")
            return (data, 200, {"Content-Disposition": "attachment; filename=resultados_english_quest.csv"}, "text/csv; charset=utf-8")

        # mundos y preguntas
        if method == "GET" and path == "/api/admin/worlds":
            return load_worlds(con, True)

        if method == "POST" and path == "/api/admin/worlds":
            f = parse_world_fields(body)
            pos = con.execute("SELECT COALESCE(MAX(position),-1)+1 FROM worlds").fetchone()[0]
            cur = con.execute("INSERT INTO worlds(position,name,description,theme,medal,checkpoint_text,character) VALUES(?,?,?,?,?,?,?)", (pos, *f))
            con.commit()
            return {"id": cur.lastrowid}

        m = re.fullmatch(r"/api/admin/worlds/(\d+)(/move)?", path)
        if m:
            wid = int(m.group(1))
            if not con.execute("SELECT 1 FROM worlds WHERE id=?", (wid,)).fetchone():
                raise ApiError(404, "No existe el mundo.")
            if m.group(2) and method == "POST":
                move(con, "worlds", wid, "up" if body.get("dir") == "up" else "down")
            elif method == "PUT":
                f = parse_world_fields(body)
                con.execute("UPDATE worlds SET name=?,description=?,theme=?,medal=?,checkpoint_text=?,character=? WHERE id=?", (*f, wid))
            elif method == "DELETE":
                con.execute("DELETE FROM worlds WHERE id=?", (wid,))
                renumber(con, "worlds", [r["id"] for r in con.execute("SELECT id FROM worlds ORDER BY position,id")])
            else:
                raise ApiError(405, "Método no permitido.")
            con.commit()
            return {"ok": True}

        if method == "POST" and path == "/api/admin/questions":
            wid = body.get("world_id")
            if not con.execute("SELECT 1 FROM worlds WHERE id=?", (wid,)).fetchone():
                raise ApiError(404, "No existe el mundo.")
            f = parse_question_fields(body)
            pos = con.execute("SELECT COALESCE(MAX(position),-1)+1 FROM questions WHERE world_id=?", (wid,)).fetchone()[0]
            cur = con.execute("INSERT INTO questions(world_id,position,label,objective,prompt,options,correct) VALUES(?,?,?,?,?,?,?)", (wid, pos, *f))
            con.commit()
            return {"id": cur.lastrowid}

        m = re.fullmatch(r"/api/admin/questions/(\d+)(/move)?", path)
        if m:
            qid = int(m.group(1))
            q = con.execute("SELECT * FROM questions WHERE id=?", (qid,)).fetchone()
            if not q:
                raise ApiError(404, "No existe la pregunta.")
            if m.group(2) and method == "POST":
                move(con, "questions", qid, "up" if body.get("dir") == "up" else "down", scope="world_id")
            elif method == "PUT":
                f = parse_question_fields(body)
                con.execute("UPDATE questions SET label=?,objective=?,prompt=?,options=?,correct=? WHERE id=?", (*f, qid))
            elif method == "DELETE":
                con.execute("DELETE FROM questions WHERE id=?", (qid,))
                renumber(con, "questions", [r["id"] for r in con.execute("SELECT id FROM questions WHERE world_id=? ORDER BY position,id", (q["world_id"],))])
            else:
                raise ApiError(405, "Método no permitido.")
            con.commit()
            return {"ok": True}

        # textos
        if path == "/api/admin/settings":
            if method == "GET":
                return get_settings(con)
            if method == "PUT":
                limits = {"title": 100, "subtitle": 160, "instructions": 600, "final_message": 400}
                for k, n in limits.items():
                    if k in body:
                        con.execute("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                                    (k, clip(body[k], n, k, required=k in ("title",))))
                con.commit()
                return {"ok": True}

        # administradores
        if path == "/api/admin/users" and method == "GET":
            return [dict(r) for r in con.execute("SELECT id,username,display_name,created_at FROM users ORDER BY id")]

        if path == "/api/admin/users" and method == "POST":
            username = clip(body.get("username"), 32, "el usuario", required=True)
            if not USERNAME.match(username):
                raise ApiError(400, "Usuario: 3 a 32 caracteres (letras, números, . _ -).")
            password = str(body.get("password", ""))
            if len(password) < 6:
                raise ApiError(400, "La contraseña debe tener al menos 6 caracteres.")
            if con.execute("SELECT 1 FROM users WHERE username=?", (username,)).fetchone():
                raise ApiError(409, "Ese usuario ya existe.")
            salt, digest = hash_pw(password)
            cur = con.execute("INSERT INTO users(username,display_name,salt,pwhash,created_at) VALUES(?,?,?,?,?)",
                              (username, clip(body.get("display_name"), 80, "el nombre", required=True), salt, digest, now()))
            con.commit()
            return {"id": cur.lastrowid}

        m = re.fullmatch(r"/api/admin/users/(\d+)(/password)?", path)
        if m:
            uid = int(m.group(1))
            if not con.execute("SELECT 1 FROM users WHERE id=?", (uid,)).fetchone():
                raise ApiError(404, "No existe el usuario.")
            if m.group(2) and method == "PUT":
                password = str(body.get("password", ""))
                if len(password) < 6:
                    raise ApiError(400, "La contraseña debe tener al menos 6 caracteres.")
                salt, digest = hash_pw(password)
                con.execute("UPDATE users SET salt=?,pwhash=? WHERE id=?", (salt, digest, uid))
            elif method == "DELETE":
                if uid == me["id"]:
                    raise ApiError(400, "No puedes eliminar tu propia cuenta.")
                con.execute("DELETE FROM users WHERE id=?", (uid,))
            else:
                raise ApiError(405, "Método no permitido.")
            con.commit()
            return {"ok": True}

        raise ApiError(404, "Ruta no encontrada.")
    finally:
        con.close()


# ---------------------------------------------------------------- HTTP
class Handler(BaseHTTPRequestHandler):
    server_version = "EnglishQuest/1.0"

    def log_message(self, fmt, *args):
        pass

    def cookie(self, name):
        for part in self.headers.get("Cookie", "").split(";"):
            k, _, v = part.strip().partition("=")
            if k == name:
                return v
        return None

    def current_user(self, con):
        sid = self.cookie("sid")
        if not sid:
            return None
        return con.execute("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.sid=? AND s.expires>?",
                           (sid, time.time())).fetchone()

    def read_json(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = 0
        if n > 200_000:
            raise ApiError(413, "Solicitud demasiado grande.")
        if n == 0:
            return {}
        if "application/json" not in self.headers.get("Content-Type", ""):
            raise ApiError(415, "Se esperaba JSON.")
        try:
            data = json.loads(self.rfile.read(n).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            raise ApiError(400, "JSON inválido.")
        return data if isinstance(data, dict) else {}

    def send(self, code, data, ctype, headers=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def dispatch(self, method):
        url = urlparse(self.path)
        path = url.path
        if path.startswith("/api/"):
            try:
                res = handle_api(self, method, path, parse_qs(url.query))
                headers, ctype, code = {"Cache-Control": "no-store"}, "application/json; charset=utf-8", 200
                if isinstance(res, tuple):
                    payload, code = res[0], res[1]
                    headers.update(res[2] if len(res) > 2 else {})
                    ctype = res[3] if len(res) > 3 else ctype
                else:
                    payload = res
                data = payload if isinstance(payload, bytes) else json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self.send(code, data, ctype, headers)
            except ApiError as e:
                self.send(e.code, json.dumps({"error": e.msg}, ensure_ascii=False).encode("utf-8"),
                          "application/json; charset=utf-8", {"Cache-Control": "no-store"})
            except Exception as e:  # noqa
                print("Error interno:", repr(e))
                self.send(500, b'{"error":"Error interno del servidor."}', "application/json; charset=utf-8")
            return
        if method != "GET":
            return self.send(405, b"Metodo no permitido", "text/plain")
        if path == "/":
            path = "/static/index.html"
        elif path == "/admin":
            path = "/static/admin.html"
        if not path.startswith("/static/"):
            return self.send(404, b"No encontrado", "text/plain")
        full = os.path.normpath(os.path.join(STATIC, path[len("/static/"):]))
        if not full.startswith(STATIC + os.sep) or not os.path.isfile(full):
            return self.send(404, b"No encontrado", "text/plain")
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if full.endswith(".js"):
            ctype = "text/javascript"
        if ctype.startswith("text/") or ctype == "text/javascript":
            ctype += "; charset=utf-8"
        with open(full, "rb") as f:
            self.send(200, f.read(), ctype, {"Cache-Control": "no-cache"})

    def do_GET(self):
        self.dispatch("GET")

    def do_POST(self):
        self.dispatch("POST")

    def do_PUT(self):
        self.dispatch("PUT")

    def do_DELETE(self):
        self.dispatch("DELETE")


if __name__ == "__main__":
    init_db()
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    print(f"English Quest listo.\n  Juego:  http://localhost:{port}/\n  Panel:  http://localhost:{port}/admin  (admin / {DEFAULT_PASS})")
    ThreadingHTTPServer((host, port), Handler).serve_forever()

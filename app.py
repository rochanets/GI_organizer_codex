import json
import os
import sqlite3
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HOST = "0.0.0.0"
PORT = 4321

if os.name == "nt":
    DB_DIR = Path("C:/GI_codex")
else:
    DB_DIR = Path("./C/GI_codex")
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "gi_organizer.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS characters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          image TEXT,
          name TEXT NOT NULL,
          element TEXT NOT NULL,
          role TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS materials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          image TEXT,
          item_type TEXT NOT NULL,
          name TEXT NOT NULL,
          level INTEGER DEFAULT 1,
          value REAL DEFAULT 0,
          is_locked INTEGER DEFAULT 0,
          frame_color TEXT DEFAULT '#cce7cc'
        );
        CREATE TABLE IF NOT EXISTS farm_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS farm_template_rows (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id INTEGER NOT NULL,
          row_order INTEGER NOT NULL,
          item_type TEXT NOT NULL,
          item_name TEXT,
          required REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS farm_cards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          character_id INTEGER,
          cycle TEXT,
          template_id INTEGER,
          name TEXT
        );
        CREATE TABLE IF NOT EXISTS farm_card_rows (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          farm_card_id INTEGER NOT NULL,
          row_order INTEGER,
          item_type TEXT,
          item_name TEXT,
          required REAL DEFAULT 0,
          current REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS teams (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT DEFAULT 'Novo Time',
          slot1 INTEGER,
          slot2 INTEGER,
          slot3 INTEGER,
          slot4 INTEGER
        );
        """
    )

    base_materials = [
        (None, "EXP", "EXP", 1, 0, 1, "#d7f5ff"),
        (None, "Mineral", "MINERAL", 1, 0, 1, "#ece6ff"),
        (None, "Mora", "Mora", 1, 0, 0, "#ffe4b3"),
    ]
    for material in base_materials:
        cur.execute(
            """INSERT INTO materials (image, item_type, name, level, value, is_locked, frame_color)
               SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS (
                 SELECT 1 FROM materials WHERE name = ?
               )""",
            (*material, material[2]),
        )
    for i in range(4):
        cur.execute("INSERT INTO teams (title) SELECT 'Novo Time' WHERE (SELECT COUNT(*) FROM teams) <= ?", (i,))

    conn.commit()
    conn.close()


class Handler(BaseHTTPRequestHandler):
    def _json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        if not length:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/state":
            conn = get_conn()
            payload = {}
            for table in ["characters", "materials", "farm_templates", "farm_template_rows", "farm_cards", "farm_card_rows", "teams"]:
                payload[table] = [dict(r) for r in conn.execute(f"SELECT * FROM {table}").fetchall()]
            conn.close()
            return self._json(payload)

        if parsed.path.startswith("/api/delete"):
            qs = parse_qs(parsed.query)
            table = qs.get("table", [""])[0]
            item_id = qs.get("id", [""])[0]
            if table not in {"characters", "materials", "farm_templates", "farm_cards"}:
                return self._json({"error": "invalid table"}, 400)
            conn = get_conn()
            conn.execute(f"DELETE FROM {table} WHERE id = ?", (item_id,))
            if table == "farm_templates":
                conn.execute("DELETE FROM farm_template_rows WHERE template_id = ?", (item_id,))
            if table == "farm_cards":
                conn.execute("DELETE FROM farm_card_rows WHERE farm_card_id = ?", (item_id,))
            conn.commit()
            conn.close()
            return self._json({"ok": True})

        path = Path("public" + ("/index.html" if parsed.path == "/" else parsed.path))
        if path.exists() and path.is_file():
            self.send_response(200)
            ctype = "text/plain"
            if path.suffix == ".html":
                ctype = "text/html"
            elif path.suffix == ".css":
                ctype = "text/css"
            elif path.suffix == ".js":
                ctype = "application/javascript"
            self.send_header("Content-Type", ctype)
            data = path.read_bytes()
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if self.path == "/api/save":
            data = self._read_json()
            entity = data.get("entity")
            values = data.get("values", {})
            conn = get_conn()
            cur = conn.cursor()
            if entity == "character":
                cur.execute("INSERT INTO characters (image,name,element,role) VALUES (?,?,?,?)", (values.get("image"), values["name"], values["element"], values["role"]))
            elif entity == "material":
                base_name = values["name"]
                item_type = values["item_type"]
                image = values.get("image")
                level = int(values.get("level", 1))
                entries = [(base_name, level, "#cce7cc")]
                if item_type in ["Enemy", "talent", "Weapon", "Gem"]:
                    max_level = 3 if item_type in ["Enemy", "talent"] else 4
                    colors = ["#8de28d", "#76b4ff", "#d8adff", "#f2d17b"]
                    entries = [(f"{base_name} {i}", i, colors[i - 1]) for i in range(1, max_level + 1)]
                for name, lvl, frame in entries:
                    cur.execute(
                        "INSERT INTO materials (image,item_type,name,level,value,is_locked,frame_color) VALUES (?,?,?,?,?,?,?)",
                        (image, item_type, name, lvl, 0, 0, frame),
                    )
            elif entity == "update_material_values":
                for item in values.get("items", []):
                    cur.execute("UPDATE materials SET value = ? WHERE id = ?", (item["value"], item["id"]))
                recalc_specials(cur, values.get("expMineral", {}))
            elif entity == "farm_template":
                cur.execute("INSERT INTO farm_templates (name) VALUES (?)", (values["name"],))
                template_id = cur.lastrowid
                for idx, row in enumerate(values["rows"]):
                    cur.execute("INSERT INTO farm_template_rows (template_id,row_order,item_type,item_name,required) VALUES (?,?,?,?,?)", (template_id, idx + 1, row["item_type"], row.get("item_name"), row.get("required", 0)))
            elif entity == "farm_card":
                cur.execute("INSERT INTO farm_cards (character_id,cycle,template_id,name) VALUES (?,?,?,?)", (values.get("character_id"), values["cycle"], values["template_id"], values["name"]))
                card_id = cur.lastrowid
                for idx, row in enumerate(values["rows"]):
                    cur.execute("INSERT INTO farm_card_rows (farm_card_id,row_order,item_type,item_name,required,current) VALUES (?,?,?,?,?,?)", (card_id, idx + 1, row["item_type"], row.get("item_name"), row.get("required", 0), row.get("current", 0)))
            elif entity == "update_farm_currents":
                for row in values.get("rows", []):
                    cur.execute("UPDATE farm_card_rows SET current = ? WHERE id = ?", (row["current"], row["id"]))
                    cur.execute("UPDATE materials SET value = ? WHERE name = ?", (row["current"], row["item_name"]))
            elif entity == "team":
                team_id = values["id"]
                cur.execute("UPDATE teams SET title=?, slot1=?,slot2=?,slot3=?,slot4=? WHERE id=?", (values["title"], values.get("slot1"), values.get("slot2"), values.get("slot3"), values.get("slot4"), team_id))
            conn.commit()
            conn.close()
            return self._json({"ok": True})

        self._json({"error": "not found"}, 404)


def recalc_specials(cur, exp_mineral):
    wanderer = int(exp_mineral.get("wanderer", 0))
    adventurer = int(exp_mineral.get("adventurer", 0))
    hero = int(exp_mineral.get("hero", 0))
    ore = int(exp_mineral.get("ore", 0))
    fine = int(exp_mineral.get("fine", 0))
    mystic = int(exp_mineral.get("mystic", 0))
    exp_total = (20000 * hero) + (5000 * adventurer) + (1000 * wanderer)
    mineral_total = ((mystic * 10000) + (fine * 2000) + (ore * 400)) / 10000
    cur.execute("UPDATE materials SET value = ? WHERE name = 'EXP'", (exp_total,))
    cur.execute("UPDATE materials SET value = ? WHERE name = 'MINERAL'", (mineral_total,))


if __name__ == "__main__":
    init_db()
    print(f"GI Organizer Manus rodando em http://{HOST}:{PORT}")
    HTTPServer((HOST, PORT), Handler).serve_forever()

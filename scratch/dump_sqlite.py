import sqlite3
import os
import json

db_path = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.wrangler\state\v3\kv\miniflare-KVNamespaceObject\65f784196d308e3d8e28afcbab3043ae848f40c578dfd53911015dca3e41a085.sqlite"

if not os.path.exists(db_path):
    print("Database path not found:", db_path)
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get list of tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [r[0] for r in cursor.fetchall()]
print("Tables found:", tables)

for table in tables:
    print(f"\n--- Table: {table} ---")
    cursor.execute(f"PRAGMA table_info({table});")
    info = cursor.fetchall()
    print("Schema:", [col[1] for col in info])
    
    cursor.execute(f"SELECT * FROM {table} LIMIT 100;")
    rows = cursor.fetchall()
    print(f"Row count: {len(rows)}")
    for r in rows:
        # Check if the row contains values that we can decode
        print(r)

conn.close()

import sqlite3
import os
import json

db_path = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.partykit\state\party\-PartyKitDurable\581e0f8a2f05772cd8fd4e222e383d4c2c1bb9fed077f494627cf9035f7a78b0.sqlite"

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
    
    cursor.execute(f"SELECT COUNT(*) FROM {table};")
    count = cursor.fetchone()[0]
    print(f"Row count: {count}")
    
    cursor.execute(f"SELECT * FROM {table} LIMIT 20;")
    rows = cursor.fetchall()
    for r in rows:
        # Check if the row contains values that we can decode or print
        # Truncate large blobs/strings for readability
        formatted_row = []
        for val in r:
            if isinstance(val, bytes):
                if len(val) > 100:
                    formatted_row.append(f"<bytes len={len(val)}: {val[:30]}...>")
                else:
                    formatted_row.append(val)
            elif isinstance(val, str) and len(val) > 150:
                formatted_row.append(f"<str len={len(val)}: {val[:100]}...>")
            else:
                formatted_row.append(val)
        print(formatted_row)

conn.close()

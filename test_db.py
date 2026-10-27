
from database import get_db_connection

try:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT current_database()")
            result = cur.fetchone()

            print("Database connection successful!")
            print("Connected database:", result[0])

except Exception as e:
    print("Database connection failed!")
    print("Error:", e)

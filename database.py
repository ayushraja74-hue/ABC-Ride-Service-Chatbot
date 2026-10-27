
import os
import psycopg
from dotenv import load_dotenv

load_dotenv()


def get_db_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        connect_timeout=5
    )


def save_chat_memory(chat_id, memory_key, memory_value):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO chat.chat_memories
                    (chat_id, memory_key, memory_value)
                VALUES (%s, %s, %s)
                ON CONFLICT (chat_id, memory_key)
                DO UPDATE SET
                    memory_value = EXCLUDED.memory_value,
                    updated_at = NOW()
                """,
                (chat_id, memory_key, memory_value)
            )


def get_chat_memories(chat_id):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT memory_key, memory_value
                FROM chat.chat_memories
                WHERE chat_id = %s
                ORDER BY id ASC
                """,
                (chat_id,)
            )
            rows = cur.fetchall()

    return [
        {"memory_key": row[0], "memory_value": row[1]}
        for row in rows
    ]

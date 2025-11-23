import os
from contextlib import contextmanager
from sqlalchemy import inspect
from sqlmodel import SQLModel, create_engine, Session


DB_FILENAME = os.environ.get("MEDSPRINT_DB_PATH", "medsprint.db")
DATABASE_URL = os.environ.get("DATABASE_URL")

# Prefer Postgres when DATABASE_URL is provided (es. per Vercel/managed DB), fallback a SQLite locale.
if DATABASE_URL:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
else:
    engine = create_engine(f"sqlite:///{DB_FILENAME}", connect_args={"check_same_thread": False})


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _run_migrations()


@contextmanager
def get_session() -> Session:
    with Session(engine) as session:
        yield session


def _run_migrations() -> None:
    """Lightweight, code-based migrations for new columns without external tooling."""
    inspector = inspect(engine)

    def ensure_column(table: str, column: str, ddl: str) -> None:
        existing = {col["name"] for col in inspector.get_columns(table)}
        if column in existing:
            return
        with engine.begin() as conn:
            conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")

    # Backfill new fields on Attempt for analytics/history
    if inspector.has_table("attempt"):
        ensure_column("attempt", "given_answer", "TEXT")
        ensure_column("attempt", "comment", "TEXT")
    # Backfill comment on Card for pre-generated feedback
    if inspector.has_table("card"):
        ensure_column("card", "comment", "TEXT")

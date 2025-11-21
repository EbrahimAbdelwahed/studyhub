import os
from contextlib import contextmanager
from sqlmodel import SQLModel, create_engine, Session


DB_FILENAME = os.environ.get("MEDSPRINT_DB_PATH", "medsprint.db")
engine = create_engine(f"sqlite:///{DB_FILENAME}", connect_args={"check_same_thread": False})


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


@contextmanager
def get_session() -> Session:
    with Session(engine) as session:
        yield session

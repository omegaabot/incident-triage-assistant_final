import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import OperationalError

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:Post%401234@localhost:5432/incident_triage"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    import backend.models
    from sqlalchemy import text

    try:
        Base.metadata.create_all(bind=engine)
    except OperationalError:
        base_url = DATABASE_URL.rsplit("/", 1)[0] + "/postgres"
        db_name = DATABASE_URL.rsplit("/", 1)[1].split("?")[0]
        tmp_engine = create_engine(base_url)
        with tmp_engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(text(f"CREATE DATABASE {db_name}"))
        tmp_engine.dispose()
        Base.metadata.create_all(bind=engine)

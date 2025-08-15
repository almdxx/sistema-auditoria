# FILE: database.py

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os

load_dotenv()

# --- CONFIGURAÇÃO DO BANCO DE DADOS ---
# Prioriza a URL de conexão completa (ideal para produção/Render)
DATABASE_URL = os.getenv("DATABASE_URL")

# Se não encontrar a URL completa, monta a partir das partes (ideal para local)
if DATABASE_URL is None:
    DB_USER = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME")
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"


engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- DEPENDÊNCIA DE SESSÃO ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
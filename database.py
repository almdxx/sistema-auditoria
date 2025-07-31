from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os
# Em database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# ADICIONE A URL EXTERNA DO BANCO DE DADOS DA RENDER DIRETAMENTE
DATABASE_URL = "postgresql://auditoria_py_user:3nua3J3TPFe1aPs0mlFiPJXL1n20WE3J@dpg-d25l6mc9c44c73dg5m20-a.oregon-postgres.render.com/auditoria_py"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
load_dotenv()

# Lógica para funcionar tanto online (Render) quanto localmente
DATABASE_URL = os.getenv("DATABASE_URL") # Render define esta variável de ambiente

if not DATABASE_URL:
    # Se não estiver na Render, usa as variáveis do .env para conectar localmente
    DB_USER = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME")
    DATABASE_URL = f"postgresql+pg8000://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
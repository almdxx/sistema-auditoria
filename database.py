import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Cole a sua URL EXTERNA do banco de dados da Render aqui
DATABASE_URL = "postgresql://auditoria_py_user:3nua3J3TPFe1aPs0mlFiPJXL1n20WE3J@dpg-d25l6mc9c44c73dg5m20-a.oregon-postgres.render.com/auditoria_py"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
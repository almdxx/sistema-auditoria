# FILE: security.py

from datetime import datetime, timedelta, timezone
from typing import Optional
from passlib.context import CryptContext
from jose import JWTError, jwt
from dotenv import load_dotenv
import os

load_dotenv()

# --- CONFIGURAÇÃO DE SEGURANÇA ---
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8 # 8 horas

# --- HASHING DE SENHA ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- Função: Verificar Senha ---
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# --- Função: Gerar Hash de Senha ---
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# --- GERENCIAMENTO DE TOKEN JWT ---
# --- Função: Criar Access Token ---
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    # data deve ter: 'sub', 'organizacao_id', 'role'
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
# FILE: security.py

from datetime import datetime, timedelta, timezone
from typing import Optional
from passlib.context import CryptContext
from jose import JWTError, jwt
from dotenv import load_dotenv
import os

load_dotenv()

# --- CONFIGURAÇÃO DE SEGURANÇA ---
SECRET_KEY = os.getenv("SECRET_KEY", "default_secret_key_for_testing_only")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8 # Token expira em 8 horas

# --- HASHING DE SENHA ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se a senha fornecida corresponde ao hash salvo."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Gera o hash de uma senha."""
    return pwd_context.hash(password)

# --- GERENCIAMENTO DE TOKEN JWT ---
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Cria um novo token de acesso JWT."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
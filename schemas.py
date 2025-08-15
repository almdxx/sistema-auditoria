# FILE: schemas.py

from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str
    entidade_id: int

class UserInDB(UserBase):
    id: int
    entidade_id: int
    model_config = ConfigDict(from_attributes=True)

class Entidade(BaseModel):
    id: int
    nome: str
    model_config = ConfigDict(from_attributes=True)

class AuditoriaScopeCreate(BaseModel):
    responsavel: str
    categorias_escopo: List[str]
    entidade_id: Optional[int] = None

class EscopoAuditoriaSchema(BaseModel):
    categoria_nome: str
    qtd_sistema: int
    qtd_contada: int
    diferenca: int
    data_contagem: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class AuditoriaComEscopo(BaseModel):
    id: int
    nome: str
    codigo_referencia: str
    responsavel: str
    data_inicio: datetime
    data_fim: Optional[datetime] = None
    entidade: Entidade
    escopo: List[EscopoAuditoriaSchema] = []
    model_config = ConfigDict(from_attributes=True)

class AuditoriaParaLista(BaseModel):
    id: int
    nome: str
    codigo_referencia: str
    responsavel: str
    data_inicio: datetime
    model_config = ConfigDict(from_attributes=True)

class ImportacaoResultado(BaseModel):
    sucesso: bool
    mensagem: str
    itens_rejeitados: List[str] = []

class ContagemManualItem(BaseModel):
    categoria_nome: str
    qtd_contada: int

class ContagemManualCreate(BaseModel):
    contagens: List[ContagemManualItem]

class RelatorioDiferenca(BaseModel):
    categoria_nome: str
    total_sistema: int
    total_contada: int
    diferenca_total: int
    model_config = ConfigDict(from_attributes=True)
# FILE: schemas.py

from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime

# --- SCHEMAS: Entidade ---
class EntidadeBase(BaseModel):
    nome: str

class Entidade(EntidadeBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

# --- SCHEMAS: Auditoria ---
class AuditoriaScopeCreate(BaseModel):
    entidade_id: int
    responsavel: str
    categorias_escopo: List[str]

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

# --- SCHEMAS: Importação e Contagem Manual ---
class ImportacaoResultado(BaseModel):
    sucesso: bool
    mensagem: str
    itens_rejeitados: List[str] = []

class ContagemManualItem(BaseModel):
    categoria_nome: str
    qtd_contada: int

class ContagemManualCreate(BaseModel):
    contagens: List[ContagemManualItem]
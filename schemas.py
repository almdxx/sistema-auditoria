from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import date

class EntidadeBase(BaseModel):
    nome: str

class Entidade(EntidadeBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class ItemParaAuditoria(BaseModel):
    item_auditoria_id: Optional[int] = None
    produto_id: int
    nome_item: str
    grupo: Optional[str] = None
    qtd_sistema: int
    qtd_fisica: int
    qtd_gerente: Optional[int] = None
    diferenca: int
    model_config = ConfigDict(from_attributes=True)

class AuditoriaBase(BaseModel):
    nome: str

class AuditoriaCreate(AuditoriaBase):
    entidade_id: int

class Auditoria(AuditoriaBase):
    id: int
    entidade_id: int
    entidade: Entidade
    itens: List[ItemParaAuditoria] = []
    model_config = ConfigDict(from_attributes=True)

class AuditoriaParaLista(AuditoriaBase):
    id: int
    entidade: Entidade
    model_config = ConfigDict(from_attributes=True)

class ContagemCategoriaBase(BaseModel):
    data_contagem: date
    responsavel: str
    categoria_nome: str
    qtd_contada: int
    qtd_sistema: int
    entidade_id: int

class ContagemCategoriaCreate(ContagemCategoriaBase):
    pass

class ContagemCategoria(ContagemCategoriaBase):
    id: int
    diferenca: int
    entidade: Entidade
    model_config = ConfigDict(from_attributes=True)
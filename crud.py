# FILE: crud.py

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, date
from zoneinfo import ZoneInfo
import io
import pandas as pd
import unicodedata

import models, schemas, security

# --- FUNÇÃO AUXILIAR PARA NORMALIZAÇÃO ---
def normalize_string(s: str) -> str:
    if not s: return ""
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
    return s.upper().strip()

# --- FUNÇÕES DE USUÁRIO ---
def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

# --- FUNÇÕES GERAIS ---
def listar_entidades(db: Session, user: models.User) -> List[models.Entidade]:
    """
    Lista entidades. Se o usuário for 'admin', retorna todas.
    Caso contrário, retorna apenas a entidade associada ao usuário.
    """
    if user.username == 'admin':
        return db.query(models.Entidade).order_by(models.Entidade.nome).all()
    else:
        user_entity = db.query(models.Entidade).filter(models.Entidade.id == user.entidade_id).first()
        return [user_entity] if user_entity else []

def obter_todas_categorias_importadas(db: Session) -> List[str]:
    categorias_query = db.query(models.Produto.grupo).distinct().filter(models.Produto.grupo.isnot(None)).all()
    grupos_unicos = {}
    for (grupo,) in categorias_query:
        if grupo:
            grupo_normalizado = normalize_string(grupo)
            if grupo_normalizado not in grupos_unicos:
                grupos_unicos[grupo_normalizado] = grupo
    return sorted(list(grupos_unicos.values()))

def calcular_estoque_por_categoria(db: Session, entidade_id: int, categoria_nome: str) -> int:
    total_estoque = (db.query(func.sum(models.Estoque.quantidade_sistema))
                      .join(models.Produto, models.Estoque.produto_id == models.Produto.id)
                      .filter(models.Produto.grupo.ilike(categoria_nome))
                      .filter(models.Estoque.entidade_id == entidade_id)
                      .scalar())
    return total_estoque or 0

# --- FUNÇÕES DE AUDITORIA (COM CONTROLE DE ACESSO) ---
def criar_auditoria_com_escopo(db: Session, auditoria_data: schemas.AuditoriaScopeCreate, user: models.User) -> models.Auditoria:
    entidade_id = auditoria_data.entidade_id
    if user.username != 'admin':
        entidade_id = user.entidade_id

    entidade = db.query(models.Entidade).filter(models.Entidade.id == entidade_id).first()
    if not entidade: return None

    fuso_horario_sp = ZoneInfo('America/Sao_Paulo')
    agora_sp = datetime.now(fuso_horario_sp)
    timestamp_nome = agora_sp.strftime('%d/%m/%Y %H:%M')
    nome_auditoria = f"Auditoria {entidade.nome} - {timestamp_nome}"
    
    nova_auditoria = models.Auditoria(
        nome=nome_auditoria,
        entidade_id=entidade_id,
        responsavel=auditoria_data.responsavel,
        codigo_referencia="TEMP",
        data_inicio=agora_sp
    )
    db.add(nova_auditoria)
    db.commit()
    db.refresh(nova_auditoria)

    nova_auditoria.codigo_referencia = f"AUD-{agora_sp.year}-{nova_auditoria.id}"
    
    for categoria in auditoria_data.categorias_escopo:
        qtd_sistema = calcular_estoque_por_categoria(db, entidade_id, categoria)
        item_escopo = models.EscopoAuditoria(
            auditoria_id=nova_auditoria.id,
            categoria_nome=categoria,
            qtd_sistema=qtd_sistema
        )
        db.add(item_escopo)
        
    db.commit()
    db.refresh(nova_auditoria)
    return nova_auditoria

def listar_auditorias(db: Session, user: models.User) -> List[models.Auditoria]:
    query = db.query(models.Auditoria)
    if user.username != 'admin':
        query = query.filter(models.Auditoria.entidade_id == user.entidade_id)
    return query.order_by(models.Auditoria.id.desc()).all()

def get_auditoria_detalhes(db: Session, auditoria_id: int, user: models.User) -> Optional[models.Auditoria]:
    query = db.query(models.Auditoria).options(joinedload(models.Auditoria.entidade), joinedload(models.Auditoria.escopo)).filter(models.Auditoria.id == auditoria_id)
    if user.username != 'admin':
        query = query.filter(models.Auditoria.entidade_id == user.entidade_id)
    return query.first()

def salvar_contagens_manuais(db: Session, auditoria_id: int, contagens: schemas.ContagemManualCreate, user: models.User):
    auditoria = get_auditoria_detalhes(db, auditoria_id, user)
    if not auditoria: return None

    escopo_db = db.query(models.EscopoAuditoria).filter(models.EscopoAuditoria.auditoria_id == auditoria_id).all()
    escopo_map = {item.categoria_nome: item for item in escopo_db}
    now_sp = datetime.now(ZoneInfo('America/Sao_Paulo'))

    for contagem in contagens.contagens:
        item_escopo = escopo_map.get(contagem.categoria_nome)
        if item_escopo:
            item_escopo.qtd_contada = contagem.qtd_contada
            item_escopo.diferenca = item_escopo.qtd_contada - item_escopo.qtd_sistema
            item_escopo.data_contagem = now_sp
    
    db.commit()
    return get_auditoria_detalhes(db, auditoria_id, user)

def finalizar_auditoria(db: Session, auditoria_id: int, user: models.User) -> Optional[models.Auditoria]:
    auditoria = get_auditoria_detalhes(db, auditoria_id, user)
    if not auditoria: return None
    
    if auditoria.data_fim is None:
        auditoria.data_fim = datetime.now(ZoneInfo('America/Sao_Paulo'))
        db.commit()
        db.refresh(auditoria)
        
    return auditoria

def exportar_auditoria_excel(db: Session, auditoria_id: int, user: models.User) -> Optional[io.BytesIO]:
    auditoria = get_auditoria_detalhes(db, auditoria_id, user)
    if not auditoria: return None

    return io.BytesIO() # Placeholder

# --- FUNÇÕES DE CONFIGURAÇÃO ---
def get_ultima_atualizacao_estoque(db: Session) -> str:
    config = db.query(models.Configuracao).filter(models.Configuracao.chave == "ultima_atualizacao_estoque").first()
    return config.valor if config else "Nunca atualizado"

def set_ultima_atualizacao_estoque(db: Session):
    config = db.query(models.Configuracao).filter(models.Configuracao.chave == "ultima_atualizacao_estoque").first()
    now_sp = datetime.now(ZoneInfo('America/Sao_Paulo')).strftime('%d/%m/%Y às %H:%M')
    if config:
        config.valor = now_sp
    else:
        db.add(models.Configuracao(chave="ultima_atualizacao_estoque", valor=now_sp))
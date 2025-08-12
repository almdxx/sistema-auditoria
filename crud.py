# FILE: crud.py

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, date
from zoneinfo import ZoneInfo
import pandas as pd  # <-- IMPORTAÇÃO CORRIGIDA AQUI
import io          # <-- IMPORTAÇÃO CORRIGIDA AQUI

import models
import schemas

# --- FUNÇÕES GERAIS (ENTIDADE, CATEGORIA) ---
def listar_entidades(db: Session):
    return db.query(models.Entidade).order_by(models.Entidade.nome).all()

def obter_todas_categorias_importadas(db: Session) -> List[str]:
    categorias_query = db.query(models.Produto.grupo).distinct().filter(models.Produto.grupo.isnot(None)).order_by(models.Produto.grupo).all()
    return [categoria[0] for categoria in categorias_query]

def calcular_estoque_por_categoria(db: Session, entidade_id: int, categoria_nome: str) -> int:
    total_estoque = (db.query(func.sum(models.Estoque.quantidade_sistema))
                      .join(models.Produto, models.Estoque.produto_id == models.Produto.id)
                      .filter(models.Produto.grupo.ilike(categoria_nome))
                      .filter(models.Estoque.entidade_id == entidade_id)
                      .scalar())
    return total_estoque or 0

# --- FUNÇÕES DE AUDITORIA ---
def criar_auditoria_com_escopo(db: Session, auditoria_data: schemas.AuditoriaScopeCreate) -> models.Auditoria:
    entidade = db.query(models.Entidade).filter(models.Entidade.id == auditoria_data.entidade_id).first()
    if not entidade: return None

    fuso_horario_sp = ZoneInfo('America/Sao_Paulo')
    agora_sp = datetime.now(fuso_horario_sp)
    timestamp_nome = agora_sp.strftime('%d/%m/%Y %H:%M')
    nome_auditoria = f"Auditoria {entidade.nome} - {timestamp_nome}"
    
    nova_auditoria = models.Auditoria(
        nome=nome_auditoria,
        entidade_id=auditoria_data.entidade_id,
        responsavel=auditoria_data.responsavel,
        codigo_referencia="TEMP",
        data_inicio=agora_sp
    )
    db.add(nova_auditoria)
    db.commit()
    db.refresh(nova_auditoria)

    nova_auditoria.codigo_referencia = f"AUD-{agora_sp.year}-{nova_auditoria.id}"
    
    for categoria in auditoria_data.categorias_escopo:
        qtd_sistema = calcular_estoque_por_categoria(db, auditoria_data.entidade_id, categoria)
        item_escopo = models.EscopoAuditoria(
            auditoria_id=nova_auditoria.id,
            categoria_nome=categoria,
            qtd_sistema=qtd_sistema
        )
        db.add(item_escopo)
        
    db.commit()
    db.refresh(nova_auditoria)
    return nova_auditoria

def listar_auditorias(db: Session) -> List[models.Auditoria]:
    return db.query(models.Auditoria).order_by(models.Auditoria.id.desc()).all()

def get_auditoria_detalhes(db: Session, auditoria_id: int) -> models.Auditoria:
    return db.query(models.Auditoria).options(joinedload(models.Auditoria.entidade), joinedload(models.Auditoria.escopo)).filter(models.Auditoria.id == auditoria_id).first()

def salvar_contagens_manuais(db: Session, auditoria_id: int, contagens: schemas.ContagemManualCreate):
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
    return get_auditoria_detalhes(db, auditoria_id)

def finalizar_auditoria(db: Session, auditoria_id: int) -> Optional[models.Auditoria]:
    auditoria = db.query(models.Auditoria).filter(models.Auditoria.id == auditoria_id).first()
    if not auditoria: return None
    
    if auditoria.data_fim is None:
        auditoria.data_fim = datetime.now(ZoneInfo('America/Sao_Paulo'))
        db.commit()
        db.refresh(auditoria)
        
    return auditoria

def exportar_auditoria_excel(db: Session, auditoria_id: int) -> Optional[io.BytesIO]:
    auditoria = get_auditoria_detalhes(db, auditoria_id)
    if not auditoria: return None

    fuso_horario_sp = ZoneInfo('America/Sao_Paulo')
    
    dados_cabecalho = {
        "Campo": [ "Código da Auditoria", "Nome", "Entidade", "Responsável", "Data de Início", "Data de Fim" ],
        "Valor": [
            auditoria.codigo_referencia,
            auditoria.nome,
            auditoria.entidade.nome,
            auditoria.responsavel,
            auditoria.data_inicio.astimezone(fuso_horario_sp).strftime('%d/%m/%Y %H:%M:%S'),
            auditoria.data_fim.astimezone(fuso_horario_sp).strftime('%d/%m/%Y %H:%M:%S') if auditoria.data_fim else "Em aberto"
        ]
    }
    df_cabecalho = pd.DataFrame(dados_cabecalho)

    dados_contagem = [
        {
            "Categoria": item.categoria_nome,
            "Qtd. Sistema": item.qtd_sistema,
            "Qtd. Contada": item.qtd_contada,
            "Diferença": item.diferenca
        }
        for item in sorted(auditoria.escopo, key=lambda x: x.categoria_nome)
    ]
    df_contagem = pd.DataFrame(dados_contagem)

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df_cabecalho.to_excel(writer, sheet_name='Relatorio_Auditoria', index=False, header=False, startrow=0)
        df_contagem.to_excel(writer, sheet_name='Relatorio_Auditoria', index=False, startrow=len(dados_cabecalho) + 2)

        worksheet = writer.sheets['Relatorio_Auditoria']
        worksheet.column_dimensions['A'].width = 30
        worksheet.column_dimensions['B'].width = 30
        if not df_contagem.empty:
            for col_letter in ['C', 'D', 'E']:
                worksheet.column_dimensions[col_letter].width = 15

    output.seek(0)
    return output

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
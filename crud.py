from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional, Dict, Any, List
from datetime import date
import models
import schemas

def listar_entidades(db: Session):
    return db.query(models.Entidade).order_by(models.Entidade.nome).all()

def criar_auditoria(db: Session, nome: str, entidade_id: int):
    entidade = db.query(models.Entidade).filter(models.Entidade.id == entidade_id).first()
    if not entidade: return None
    db_auditoria = models.Auditoria(nome=nome, entidade_id=entidade_id)
    db.add(db_auditoria)
    db.commit()
    db.refresh(db_auditoria)
    return get_detalhes_para_auditoria(db, db_auditoria.id)

def listar_auditorias(db: Session):
    return db.query(models.Auditoria).options(joinedload(models.Auditoria.entidade)).order_by(models.Auditoria.id.desc()).all()

def get_detalhes_para_auditoria(db: Session, auditoria_id: int) -> Optional[Dict[str, Any]]:
    auditoria = db.query(models.Auditoria).options(joinedload(models.Auditoria.entidade)).filter(models.Auditoria.id == auditoria_id).first()
    if not auditoria: return None
    itens_contados_map = {item.produto_id: item for item in db.query(models.ItemAuditoria).filter_by(auditoria_id=auditoria.id).all()}
    estoques_da_entidade = db.query(models.Estoque).options(joinedload(models.Estoque.produto)).filter(models.Estoque.entidade_id == auditoria.entidade_id).all()
    itens_para_auditoria = []
    for estoque in estoques_da_entidade:
        produto = estoque.produto
        if not produto: continue
        item_contado = itens_contados_map.get(produto.id)
        qtd_fisica = item_contado.qtd_fisica if item_contado else 0
        qtd_gerente = item_contado.qtd_gerente if item_contado and item_contado.qtd_gerente is not None else None
        item_data = {
            "item_auditoria_id": item_contado.id if item_contado else None, "produto_id": produto.id, "nome_item": produto.nome_item, "grupo": produto.grupo,
            "qtd_sistema": estoque.quantidade_sistema, "qtd_fisica": qtd_fisica, "qtd_gerente": qtd_gerente, "diferenca": qtd_fisica - estoque.quantidade_sistema
        }
        itens_para_auditoria.append(item_data)
    itens_ordenados = sorted(itens_para_auditoria, key=lambda i: (i['grupo'] or '', i['nome_item']))
    response_dict = {
        "id": auditoria.id, "nome": auditoria.nome, "entidade_id": auditoria.entidade_id,
        "entidade": {"id": auditoria.entidade.id, "nome": auditoria.entidade.nome}, "itens": itens_ordenados
    }
    return response_dict

def atualizar_contagem(db: Session, auditoria_id: int, produto_id: int, qtd_fisica: int, qtd_gerente: Optional[int]) -> Optional[Dict[str, Any]]:
    item = db.query(models.ItemAuditoria).filter_by(auditoria_id=auditoria_id, produto_id=produto_id).first()
    auditoria = db.query(models.Auditoria).filter_by(id=auditoria_id).first()
    if not auditoria: return None
    estoque = db.query(models.Estoque).filter_by(produto_id=produto_id, entidade_id=auditoria.entidade_id).first()
    qtd_sistema = estoque.quantidade_sistema if estoque else 0
    if not item:
        item = models.ItemAuditoria(auditoria_id=auditoria_id, produto_id=produto_id)
        db.add(item)
    item.qtd_fisica = qtd_fisica
    item.qtd_gerente = qtd_gerente
    item.diferenca = qtd_fisica - qtd_sistema
    db.commit()
    db.refresh(item)
    produto = item.produto
    if not produto: produto = db.query(models.Produto).filter_by(id=produto_id).first()
    return {
        "item_auditoria_id": item.id, "produto_id": produto.id, "nome_item": produto.nome_item, "grupo": produto.grupo,
        "qtd_sistema": qtd_sistema, "qtd_fisica": item.qtd_fisica, "qtd_gerente": item.qtd_gerente, "diferenca": item.diferenca
    }

def obter_categorias_distintas(db: Session) -> List[str]:
    categorias_essenciais = [
        "Camisa work", "Terno (Traje)", "Calça traje avulso", "Paletó traje avulso", "Gravata", "Camisa fun", "Camiseta polo", "Calça chino", "Calça jeans",
        "Jaqueta", "Casaco", "Camiseta", "Moletom", "Calça de moletom", "Bermuda", "Malha", "Sapato work", "Sapato fun", "Tenis", "Bota", "Cueca", "Meia",
        "Cinto", "Carteira", "Manta", "Acessórios (colares e pulseiras)", "Acessórios e Boinas"
    ]
    categorias_no_banco_query = db.query(models.Produto.grupo).distinct().all()
    categorias_no_banco_nomes = {cat[0].lower() for cat in categorias_no_banco_query if cat[0] is not None}
    return [cat for cat in categorias_essenciais if cat.lower() in categorias_no_banco_nomes]

def calcular_estoque_por_categoria(db: Session, entidade_id: int, categoria_nome: str) -> int:
    total_estoque = (db.query(func.sum(models.Estoque.quantidade_sistema)).join(models.Produto, models.Estoque.produto_id == models.Produto.id)
                     .filter(models.Produto.grupo.ilike(categoria_nome)).filter(models.Estoque.entidade_id == entidade_id).scalar())
    return total_estoque or 0

def criar_contagem_categoria(db: Session, contagem: schemas.ContagemCategoriaCreate) -> models.ContagemCategoria:
    diferenca = contagem.qtd_contada - contagem.qtd_sistema
    db_contagem = models.ContagemCategoria(**contagem.model_dump(), diferenca=diferenca)
    db.add(db_contagem)
    db.commit()
    db.refresh(db_contagem)
    return db_contagem

def listar_contagens_categoria(
    db: Session, data: Optional[date] = None, categoria: Optional[str] = None, 
    responsavel: Optional[str] = None, entidade_id: Optional[int] = None
) -> List[models.ContagemCategoria]:
    query = db.query(models.ContagemCategoria).options(joinedload(models.ContagemCategoria.entidade))
    if data: query = query.filter(models.ContagemCategoria.data_contagem == data)
    if categoria: query = query.filter(models.ContagemCategoria.categoria_nome == categoria)
    if responsavel: query = query.filter(models.ContagemCategoria.responsavel.ilike(f"%{responsavel}%"))
    if entidade_id: query = query.filter(models.ContagemCategoria.entidade_id == entidade_id)
    return query.order_by(models.ContagemCategoria.data_contagem.desc()).all()
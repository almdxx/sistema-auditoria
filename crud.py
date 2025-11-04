# FILE: crud.py
# (Versão ATUALIZADA - deletar_auditoria verifica senha do admin)

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, exc, cast, Float, distinct
from typing import List, Optional
from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo
import io
import pandas as pd
import unicodedata
import re

import models, schemas, security # Garante que security está importado

# --- Função Interna: Contar Letras Válidas ---
# ... (código inalterado) ...
def _contar_caracteres_validos(texto: str) -> int:
    if not isinstance(texto, str): return 0
    letras = re.sub(r'[^a-zA-Z]', '', texto)
    return len(letras)

# --- Função: Buscar Usuário por Username (Verifica se está ativo) ---
# ... (código inalterado) ...
def get_user_by_username(db: Session, username: str):
    return db.query(models.User).options(
        joinedload(models.User.entidade),
        joinedload(models.User.organizacao)
    ).filter(models.User.username == username, models.User.is_active == True).first()

# --- Função Auxiliar: Buscar Usuário por Username (SEM verificar is_active) ---
# ... (código inalterado) ...
def _get_user_by_username_regardless_of_status(db: Session, username: str):
     return db.query(models.User).filter(models.User.username == username).first()


# --- Função: Listar Entidades ---
# ... (código inalterado) ...
def listar_entidades(db: Session, user: models.User) -> List[models.Entidade]:
    query = db.query(models.Entidade).filter(models.Entidade.organizacao_id == user.organizacao_id)
    return query.order_by(models.Entidade.nome).all()

# --- Função: Obter Categorias Importadas ---
# ... (código inalterado) ...
def obter_todas_categorias_importadas(db: Session, user: models.User) -> List[schemas.CategoriaComEstoque]:
    resultados = (
        db.query(models.Produto.grupo, func.sum(models.Estoque.quantidade_sistema).label("estoque_total"))
        .join(models.Estoque, models.Produto.id == models.Estoque.produto_id)
        .filter(models.Produto.grupo.isnot(None), func.lower(models.Produto.grupo) != 'nan', models.Produto.organizacao_id == user.organizacao_id)
        .group_by(models.Produto.grupo)
        .having(func.sum(models.Estoque.quantidade_sistema) > 0)
        .order_by(models.Produto.grupo).all()
    )
    return [schemas.CategoriaComEstoque(nome=grupo, estoque_total=int(estoque)) for grupo, estoque in resultados if estoque and estoque > 0]

# --- Função: Calcular Estoque por Categoria ---
# ... (código inalterado) ...
def calcular_estoque_por_categoria(db: Session, entidade_id: int, categoria_nome: str, org_id: int) -> int:
    total_estoque = (db.query(func.sum(models.Estoque.quantidade_sistema))
                      .join(models.Produto, models.Estoque.produto_id == models.Produto.id)
                      .filter(models.Produto.grupo.ilike(categoria_nome), models.Estoque.entidade_id == entidade_id, models.Produto.organizacao_id == org_id)
                      .scalar())
    return total_estoque or 0


# --- Funções de Auditoria (Criar, Listar, Detalhes, Salvar, Finalizar, Exportar) ---
# ... (código inalterado) ...
def criar_auditoria_com_escopo(db: Session, auditoria_data: schemas.AuditoriaScopeCreate, user: models.User) -> models.Auditoria:
    config_key = f"ultima_atualizacao_estoque_org_{user.organizacao_id}"
    config_ultima_att = db.query(models.Configuracao).filter_by(chave=config_key).first()
    agora_sp = datetime.now(ZoneInfo('America/Sao_Paulo'))
    if not config_ultima_att: raise ValueError("O estoque nunca foi atualizado.")
    try:
        ultima_att_data = datetime.strptime(config_ultima_att.valor, '%d/%m/%Y às %H:%M').replace(tzinfo=ZoneInfo('America/Sao_Paulo'))
        if agora_sp.date() != ultima_att_data.date(): raise ValueError(f"Estoque atualizado em dia diferente ({ultima_att_data.strftime('%d/%m/%Y')}).")
    except (ValueError, TypeError) as e: raise ValueError("Formato de data da última atualização é inválido.") if isinstance(e, ValueError) else ValueError("Formato inválido.")
    entidade_id = user.entidade_id if user.role != 'admin' else auditoria_data.entidade_id
    if not entidade_id: raise ValueError("Entidade não especificada.")
    entidade = db.query(models.Entidade).filter(models.Entidade.id == entidade_id, models.Entidade.organizacao_id == user.organizacao_id).first()
    if not entidade: raise ValueError("Entidade inválida ou não pertence à sua organização.")
    nome_auditoria = f"Auditoria {entidade.nome} - {agora_sp.strftime('%d/%m/%Y %H:%M')}"
    nova_auditoria = models.Auditoria(nome=nome_auditoria, entidade_id=entidade_id, responsavel=auditoria_data.responsavel, codigo_referencia="TEMP", data_inicio=agora_sp)
    db.add(nova_auditoria); db.commit(); db.refresh(nova_auditoria)
    nova_auditoria.codigo_referencia = f"AUD-{agora_sp.year}-{nova_auditoria.id}"
    for categoria in auditoria_data.categorias_escopo:
        qtd_sistema_calc = calcular_estoque_por_categoria(db, entidade_id, categoria, user.organizacao_id)
        db.add(models.EscopoAuditoria(auditoria_id=nova_auditoria.id, categoria_nome=categoria, qtd_sistema=qtd_sistema_calc))
    db.commit(); db.refresh(nova_auditoria)
    return nova_auditoria

def listar_auditorias(db: Session, user: models.User) -> List[models.Auditoria]:
    query = db.query(models.Auditoria).options(joinedload(models.Auditoria.entidade)).join(models.Entidade).filter(models.Entidade.organizacao_id == user.organizacao_id)
    if user.role != 'admin': query = query.filter(models.Auditoria.entidade_id == user.entidade_id)
    auditorias = query.order_by(models.Auditoria.id.desc()).all()
    for auditoria in auditorias: auditoria.status = "Finalizada" if auditoria.data_fim else "Em andamento"
    return auditorias

def get_auditoria_detalhes(db: Session, auditoria_id: int, user: models.User) -> Optional[models.Auditoria]:
    query = db.query(models.Auditoria).options(joinedload(models.Auditoria.entidade), joinedload(models.Auditoria.escopo)).filter(models.Auditoria.id == auditoria_id)
    if user.role != 'admin': query = query.filter(models.Auditoria.entidade_id == user.entidade_id)
    else: query = query.join(models.Entidade).filter(models.Entidade.organizacao_id == user.organizacao_id)
    return query.first()

def salvar_contagens_manuais(db: Session, auditoria_id: int, contagens: schemas.ContagemManualCreate, user: models.User):
    auditoria = get_auditoria_detalhes(db, auditoria_id, user)
    if not auditoria: return None
    if auditoria.data_fim: raise ValueError("Auditoria já finalizada.")
    escopo_map = {item.categoria_nome: item for item in auditoria.escopo}
    now_sp = datetime.now(ZoneInfo('America/Sao_Paulo'))
    for contagem in contagens.contagens:
        if item_escopo := escopo_map.get(contagem.categoria_nome):
            item_escopo.qtd_contada = contagem.qtd_contada
            item_escopo.diferenca = contagem.qtd_contada - item_escopo.qtd_sistema
            item_escopo.data_contagem = now_sp
    db.commit(); db.refresh(auditoria)
    return auditoria

def finalizar_auditoria(db: Session, auditoria_id: int, user: models.User) -> Optional[models.Auditoria]:
    auditoria = get_auditoria_detalhes(db, auditoria_id, user)
    if not auditoria: return None
    if auditoria and not auditoria.data_fim:
        auditoria.data_fim = datetime.now(ZoneInfo('America/Sao_Paulo'))
        db.commit(); db.refresh(auditoria)
    return auditoria

def exportar_auditoria_excel(db: Session, auditoria_id: int, user: models.User) -> Optional[io.BytesIO]:
    # ... (código inalterado) ...
    auditoria = get_auditoria_detalhes(db, auditoria_id, user)
    if not auditoria: return None
    fuso_horario_sp = ZoneInfo('America/Sao_Paulo')
    dados_cabecalho = {"Campo": ["Código", "Nome", "Entidade", "Responsável", "Início", "Fim"], "Valor": [auditoria.codigo_referencia, auditoria.nome, auditoria.entidade.nome, auditoria.responsavel, auditoria.data_inicio.astimezone(fuso_horario_sp).strftime('%d/%m/%Y %H:%M:%S'), auditoria.data_fim.astimezone(fuso_horario_sp).strftime('%d/%m/%Y %H:%M:%S') if auditoria.data_fim else "Em aberto"]}
    df_cabecalho = pd.DataFrame(dados_cabecalho)
    dados_contagem = [{"Categoria": i.categoria_nome, "Qtd. Sistema": i.qtd_sistema, "Qtd. Contada": i.qtd_contada, "Diferença": i.diferenca} for i in sorted(auditoria.escopo, key=lambda x: x.categoria_nome)]
    df_contagem = pd.DataFrame(dados_contagem)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df_cabecalho.to_excel(writer, sheet_name='Relatorio', index=False, header=False)
        df_contagem.to_excel(writer, sheet_name='Relatorio', index=False, startrow=len(df_cabecalho) + 2)
        ws = writer.sheets['Relatorio']
        col_widths = {'A': 30, 'B': 15, 'C': 15, 'D': 15}
        for i, col_name in enumerate(df_contagem.columns):
             letter = chr(ord('A') + i)
             if letter in col_widths: ws.column_dimensions[letter].width = col_widths[letter]
    output.seek(0)
    return output


# --- Função: Deletar Auditoria (MODIFICADA) ---
def deletar_auditoria(db: Session, auditoria_id: int, user: models.User, motivo: str, password: str):
    # SENHA_CONFIRMACAO = "cafe" # Removido
    
    # 1. Verifica se quem está tentando deletar é admin
    if user.role != 'admin':
        return False, "Acesso negado. Apenas administradores podem excluir auditorias."

    # 2. Verifica a senha do admin logado
    if not security.verify_password(password, user.hashed_password):
        return False, "Senha de administrador incorreta."

    # 3. Busca a auditoria a ser deletada, garantindo que pertence à organização do admin
    auditoria = db.query(models.Auditoria).join(models.Entidade).filter(
        models.Auditoria.id == auditoria_id,
        models.Entidade.organizacao_id == user.organizacao_id
    ).first()

    if not auditoria:
        return False, "Auditoria não encontrada ou não pertence à sua organização."

    # 4. Verifica o motivo (mínimo de 10 letras)
    if _contar_caracteres_validos(motivo) < 10:
        return False, "O motivo da exclusão deve conter no mínimo 10 letras."

    # 5. Tenta deletar
    try:
        print(f"EXCLUSÃO DE AUDITORIA: ID={auditoria.id}, Admin={user.username}, Motivo={motivo}")
        db.delete(auditoria)
        db.commit()
        return True, "Auditoria deletada com sucesso."
    except exc.SQLAlchemyError as e:
        db.rollback()
        print(f"Erro no banco de dados ao deletar auditoria {auditoria_id}: {e}")
        return False, f"Erro no banco de dados ao tentar excluir."


# --- Funções de Configuração ---
# ... (código inalterado) ...
def get_ultima_atualizacao_estoque(db: Session, user: models.User) -> str:
    config_key = f"ultima_atualizacao_estoque_org_{user.organizacao_id}"
    config = db.query(models.Configuracao).filter_by(chave=config_key).first()
    return config.valor if config else "Nunca"

def set_ultima_atualizacao_estoque(db: Session, org_id: int):
    config_key = f"ultima_atualizacao_estoque_org_{org_id}"
    config = db.query(models.Configuracao).filter_by(chave=config_key).first()
    now_sp = datetime.now(ZoneInfo('America/Sao_Paulo')).strftime('%d/%m/%Y às %H:%M')
    if config: config.valor = now_sp
    else: db.add(models.Configuracao(chave=config_key, valor=now_sp))


# --- Funções de Relatório ---
# ... (código inalterado) ...
def get_relatorio_historico(db: Session, org_id: int, entidade_id: Optional[int] = None, data_inicio: Optional[date] = None, data_fim: Optional[date] = None):
    # ... (código inalterado) ...
    base_query = db.query(models.EscopoAuditoria).join(models.Auditoria).join(models.Entidade).filter(models.Auditoria.data_fim.isnot(None), models.Entidade.organizacao_id == org_id)
    if entidade_id: base_query = base_query.filter(models.Auditoria.entidade_id == entidade_id)
    if data_inicio: base_query = base_query.filter(models.Auditoria.data_fim >= data_inicio)
    if data_fim: base_query = base_query.filter(models.Auditoria.data_fim < data_fim + timedelta(days=1))
    kpi_query_outros = base_query.join(models.Produto, (models.EscopoAuditoria.categoria_nome == models.Produto.grupo) & (models.Produto.organizacao_id == org_id), isouter=True)
    kpi_results_outros = kpi_query_outros.with_entities(
        func.count(distinct(models.Auditoria.id)).label('auditorias_no_periodo'), func.sum(models.EscopoAuditoria.qtd_contada).label('total_contado'),
        func.sum(models.EscopoAuditoria.diferenca * func.coalesce(models.Produto.custo, 0.0)).label('impacto_financeiro'), func.sum(func.abs(models.EscopoAuditoria.diferenca)).label('total_unidades_divergentes')
    ).one()
    total_itens_divergentes = base_query.filter(models.EscopoAuditoria.diferenca != 0).with_entities(func.count(distinct(models.EscopoAuditoria.categoria_nome))).scalar() or 0
    total_contado = kpi_results_outros.total_contado or 0
    total_unidades_divergentes = kpi_results_outros.total_unidades_divergentes or 0
    taxa_acuracia = round(max(0, (total_contado - total_unidades_divergentes)) / total_contado * 100, 2) if total_contado > 0 else 0.0
    kpis = {"auditorias_no_periodo": kpi_results_outros.auditorias_no_periodo or 0, "total_itens_divergentes": total_itens_divergentes, "taxa_acuracia": taxa_acuracia, "impacto_financeiro": kpi_results_outros.impacto_financeiro or 0.0}
    query_diferencas = base_query.join(models.Produto, (models.EscopoAuditoria.categoria_nome == models.Produto.grupo) & (models.Produto.organizacao_id == org_id), isouter=True).filter(models.EscopoAuditoria.diferenca != 0).order_by(models.Auditoria.data_fim.desc(), models.EscopoAuditoria.categoria_nome)
    resultados = query_diferencas.with_entities(
        models.EscopoAuditoria.categoria_nome, models.EscopoAuditoria.qtd_sistema, models.EscopoAuditoria.qtd_contada, models.EscopoAuditoria.diferenca,
        models.Auditoria.codigo_referencia, models.Auditoria.data_fim, models.Entidade.nome.label('entidade_nome'), models.Produto.custo
    ).all()
    diferencas = [{"codigo_auditoria": item.codigo_referencia, "entidade_nome": item.entidade_nome, "data_fim": item.data_fim, "categoria_nome": item.categoria_nome, "qtd_sistema": item.qtd_sistema, "qtd_contada": item.qtd_contada, "diferenca": item.diferenca, "impacto_item": item.diferenca * (item.custo if item.custo is not None else 0.0)} for item in resultados]
    return {"kpis": kpis, "diferencas": diferencas}

def exportar_relatorio_historico_excel(db: Session, org_id: int, entidade_id: Optional[int] = None, data_inicio: Optional[date] = None, data_fim: Optional[date] = None) -> io.BytesIO:
    # ... (código inalterado) ...
    dados_relatorio = get_relatorio_historico(db, org_id, entidade_id, data_inicio, data_fim)
    dados_para_df = [{"Auditoria": item["codigo_auditoria"], "Entidade": item["entidade_nome"], "Data": item["data_fim"].strftime('%d/%m/%Y') if item["data_fim"] else 'N/A', "Item": item["categoria_nome"], "Qtd. Sistema": item["qtd_sistema"], "Qtd. Contada": item["qtd_contada"], "Diferença": item["diferenca"], "Impacto (R$)": item["impacto_item"]} for item in dados_relatorio.get("diferencas", [])]
    df = pd.DataFrame(dados_para_df)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Relatorio_Historico', index=False)
        ws = writer.sheets['Relatorio_Historico']
        col_map = {name: chr(ord('A') + i) for i, name in enumerate(df.columns)}
        col_widths = {'Auditoria': 15, 'Entidade': 15, 'Data': 12, 'Item': 40, 'Qtd. Sistema': 15, 'Qtd. Contada': 15, 'Diferença': 15, 'Impacto (R$)': 15}
        for col_name, width in col_widths.items():
            if col_name in col_map: ws.column_dimensions[col_map[col_name]].width = width
    output.seek(0)
    return output


# --- FUNÇÕES PARA GERENCIAMENTO DE PRODUTOS ---
# ... (código inalterado) ...
def processar_importacao_estoque(db: Session, user: models.User, file_contents: bytes, entidade_id: Optional[int]) -> schemas.ImportacaoResultado:
    # ... (código com mensagem corrigida) ...
    id_alvo = None
    if user.role != 'admin':
        id_alvo = user.entidade_id
        if not id_alvo: raise ValueError("Seu usuário não está associado a uma entidade.")
    else:
        id_alvo = entidade_id
        if not id_alvo: raise ValueError("Usuário admin deve selecionar uma entidade para a importação.")

    entidade_valida = db.query(models.Entidade).filter(
        models.Entidade.id == id_alvo,
        models.Entidade.organizacao_id == user.organizacao_id
    ).first()
    if not entidade_valida:
        raise ValueError("Entidade inválida ou não pertence à sua organização.")

    try:
        df = pd.read_excel(io.BytesIO(file_contents))
        if 'Item' not in df.columns or 'Estoque atual' not in df.columns:
            raise ValueError("Colunas 'Item' e 'Estoque atual' são obrigatórias.")

        criados, atualizados, custos_atualizados, erros = 0, 0, 0, []
        itens_a_ignorar = ["serviços", "nan", ""]

        for index, row in df.iterrows():
            try:
                nome_item = str(row.get('Item', '')).strip()
                if not nome_item or nome_item.lower() in itens_a_ignorar:
                    continue

                produto = db.query(models.Produto).filter(
                    models.Produto.nome_item.ilike(nome_item),
                    models.Produto.organizacao_id == user.organizacao_id
                ).first()

                custo_item = 0.0
                if 'Custo' in df.columns:
                    custo_lido = pd.to_numeric(row.get('Custo'), errors='coerce')
                    if not pd.isna(custo_lido) and custo_lido >= 0:
                        custo_item = custo_lido

                if not produto:
                    produto = models.Produto(
                        nome_item=nome_item,
                        grupo=nome_item,
                        organizacao_id=user.organizacao_id,
                        custo=custo_item
                    )
                    db.add(produto); db.flush(); criados += 1
                    if custo_item != 0.0: custos_atualizados += 1
                else:
                    if 'Custo' in df.columns and custo_item >= 0 and (produto.custo != custo_item):
                        produto.custo = custo_item; custos_atualizados += 1

                estoque_atual = row.get('Estoque atual'); quantidade = 0
                if pd.notna(estoque_atual):
                    try: quantidade = int(float(estoque_atual))
                    except (ValueError, TypeError): quantidade = 0

                estoque = db.query(models.Estoque).filter_by(produto_id=produto.id, entidade_id=id_alvo).first()
                if estoque:
                    estoque.quantidade_sistema = quantidade
                else:
                    db.add(models.Estoque(produto_id=produto.id, entidade_id=id_alvo, quantidade_sistema=quantidade))

                atualizados += 1

            except Exception as e_row:
                erros.append(f"Linha {index + 2}: Erro ao processar item '{nome_item}'. Detalhe: {e_row}")

        set_ultima_atualizacao_estoque(db, user.organizacao_id); db.commit()

        partes_mensagem = []
        if criados == 1: partes_mensagem.append("1 produto criado")
        elif criados > 1: partes_mensagem.append(f"{criados} produtos criados")
        if atualizados == 1: partes_mensagem.append("1 estoque atualizado")
        elif atualizados > 1: partes_mensagem.append(f"{atualizados} estoques atualizados")
        if custos_atualizados == 1: partes_mensagem.append("1 custo definido/atualizado")
        elif custos_atualizados > 1: partes_mensagem.append(f"{custos_atualizados} custos definidos/atualizados")
        if not partes_mensagem: mensagem = "Estoque atualizado, mas nenhum produto novo ou estoque foi modificado."
        else: mensagem = "Estoque atualizado! " + ", ".join(partes_mensagem) + "."

        return schemas.ImportacaoResultado(
            sucesso=True, mensagem=mensagem, criados=criados, atualizados=atualizados,
            custos_atualizados=custos_atualizados, erros=erros
        )

    except Exception as e:
        db.rollback()
        raise ValueError(f"Erro ao ler o arquivo: {e}")

def listar_produtos(db: Session, user: models.User) -> List[models.Produto]:
    if user.role != 'admin': return []
    return db.query(models.Produto).filter(models.Produto.organizacao_id == user.organizacao_id).order_by(models.Produto.nome_item).all()

def atualizar_custo_produto(db: Session, produto_id: int, novo_custo: float, user: models.User) -> Optional[models.Produto]:
    if user.role != 'admin': raise ValueError("Apenas administradores podem atualizar custos.")
    produto = db.query(models.Produto).filter(models.Produto.id == produto_id, models.Produto.organizacao_id == user.organizacao_id).first()
    if not produto: return None
    if novo_custo < 0: raise ValueError("O custo não pode ser negativo.")
    produto.custo = novo_custo
    db.commit(); db.refresh(produto)
    return produto


# --- FUNÇÕES PARA GERENCIAMENTO DE USUÁRIOS ---
# ... (código inalterado para criar, listar, atualizar loja, toggle status, reset password) ...
def criar_usuario_loja(db: Session, user_data: schemas.LojaUserCreate, admin_user: models.User) -> models.User:
    if admin_user.role != 'admin': raise ValueError("Apenas administradores podem criar usuários.")
    existing_user = _get_user_by_username_regardless_of_status(db, username=user_data.username)
    if existing_user: raise ValueError("Este email já está registado no sistema.")
    entidade = db.query(models.Entidade).filter(models.Entidade.id == user_data.entidade_id, models.Entidade.organizacao_id == admin_user.organizacao_id).first()
    if not entidade: raise ValueError("Entidade inválida ou não pertence à sua organização.")
    hashed_password = security.get_password_hash(user_data.password)
    novo_usuario = models.User(
        username=user_data.username, hashed_password=hashed_password, role="user",
        organizacao_id=admin_user.organizacao_id, entidade_id=user_data.entidade_id, is_active=True
    )
    db.add(novo_usuario); db.commit(); db.refresh(novo_usuario)
    return novo_usuario

def listar_usuarios_organizacao(db: Session, admin_user: models.User) -> List[models.User]:
    if admin_user.role != 'admin': return []
    return db.query(models.User).options(joinedload(models.User.entidade)).filter(models.User.organizacao_id == admin_user.organizacao_id).order_by(models.User.is_active.desc(), models.User.role.desc(), models.User.username).all()

def atualizar_usuario_loja(db: Session, user_id_to_update: int, user_update_data: schemas.LojaUserUpdate, admin_user: models.User) -> Optional[models.User]:
    if admin_user.role != 'admin': raise ValueError("Apenas administradores podem atualizar usuários.")
    user_to_update = db.query(models.User).filter(models.User.id == user_id_to_update, models.User.organizacao_id == admin_user.organizacao_id).first()
    if not user_to_update: return None
    if user_to_update.role == 'admin': raise ValueError("Não é possível alterar a loja de um administrador.")
    nova_entidade = db.query(models.Entidade).filter(models.Entidade.id == user_update_data.entidade_id, models.Entidade.organizacao_id == admin_user.organizacao_id).first()
    if not nova_entidade: raise ValueError("Nova entidade inválida ou não pertence à sua organização.")
    user_to_update.entidade_id = user_update_data.entidade_id
    db.commit(); db.refresh(user_to_update)
    db.refresh(user_to_update, attribute_names=['entidade'])
    return user_to_update

def toggle_user_status(db: Session, user_id_to_toggle: int, admin_user: models.User) -> Optional[models.User]:
    if admin_user.role != 'admin':
        raise ValueError("Apenas administradores podem ativar/desativar usuários.")
    user_to_toggle = db.query(models.User).filter(
        models.User.id == user_id_to_toggle, models.User.organizacao_id == admin_user.organizacao_id
    ).first()
    if not user_to_toggle: return None
    if user_to_toggle.role == 'admin':
        raise ValueError("Não é possível desativar um administrador.")
    user_to_toggle.is_active = not user_to_toggle.is_active
    db.commit()
    db.refresh(user_to_toggle)
    db.refresh(user_to_toggle, attribute_names=['entidade'])
    return user_to_toggle

def reset_user_password(db: Session, user_id_to_reset: int, new_password: str, admin_user: models.User) -> bool:
    if admin_user.role != 'admin':
        raise ValueError("Apenas administradores podem resetar senhas.")
    user_to_reset = db.query(models.User).filter(
        models.User.id == user_id_to_reset,
        models.User.organizacao_id == admin_user.organizacao_id
    ).first()
    if not user_to_reset: return False
    if user_to_reset.role == 'admin':
        raise ValueError("Não é possível resetar a senha de um administrador por esta função.")
    hashed_password = security.get_password_hash(new_password)
    user_to_reset.hashed_password = hashed_password
    db.commit()
    return True


# --- FUNÇÕES PARA COMUNICAÇÃO ---
# ... (código inalterado) ...
def criar_nova_conversa(db: Session, user: models.User, nova_conversa: schemas.NovaConversaCreate) -> models.Conversa:
    if user.role == 'admin': raise ValueError("Administradores não podem iniciar conversas.")
    if not user.entidade_id: raise ValueError("Usuário não associado a uma entidade.")
    entidade = db.query(models.Entidade).filter(models.Entidade.id == user.entidade_id, models.Entidade.organizacao_id == user.organizacao_id).first()
    if not entidade: raise ValueError("Entidade inválida para este usuário.")
    db_conversa = models.Conversa(assunto=nova_conversa.assunto, entidade_id=user.entidade_id)
    db.add(db_conversa); db.commit(); db.refresh(db_conversa)
    db.add(models.Mensagem(conteudo=nova_conversa.primeira_mensagem, conversa_id=db_conversa.id, user_id=user.id, lida=False)); db.commit()
    db.refresh(db_conversa)
    return db_conversa

def listar_conversas(db: Session, user: models.User, incluir_fechadas: bool = False) -> List[schemas.ConversaParaLista]:
    query = db.query(models.Conversa).options(joinedload(models.Conversa.entidade)).join(models.Entidade).filter(models.Entidade.organizacao_id == user.organizacao_id)
    if user.role != 'admin': query = query.filter(models.Conversa.entidade_id == user.entidade_id)
    if not incluir_fechadas: query = query.filter(models.Conversa.status != "FECHADA")
    conversas = query.order_by(models.Conversa.ultima_atualizacao.desc()).all()
    return [schemas.ConversaParaLista(
        id=c.id, assunto=c.assunto, status=c.status, entidade=c.entidade, ultima_atualizacao=c.ultima_atualizacao,
        mensagens_nao_lidas=db.query(func.count(models.Mensagem.id)).filter(models.Mensagem.conversa_id == c.id, models.Mensagem.lida == False, models.Mensagem.user_id != user.id).scalar() or 0
    ) for c in conversas]

def obter_detalhes_conversa(db: Session, user: models.User, conversa_id: int) -> Optional[models.Conversa]:
    query = db.query(models.Conversa).options(
        joinedload(models.Conversa.entidade), joinedload(models.Conversa.mensagens).subqueryload(models.Mensagem.autor).joinedload(models.User.entidade, innerjoin=False)
    ).filter(models.Conversa.id == conversa_id).join(models.Entidade).filter(models.Entidade.organizacao_id == user.organizacao_id)
    if user.role != 'admin': query = query.filter(models.Conversa.entidade_id == user.entidade_id)
    conversa = query.first()
    if conversa:
         conversa.mensagens.sort(key=lambda m: m.enviado_em)
         if conversa.status != "FECHADA":
            mensagens_para_marcar = db.query(models.Mensagem).filter(models.Mensagem.conversa_id == conversa_id, models.Mensagem.user_id != user.id, models.Mensagem.lida == False).update({"lida": True}, synchronize_session=False)
            if mensagens_para_marcar > 0: db.commit(); db.expire(conversa, ['mensagens'])
    return conversa

def adicionar_resposta(db: Session, user: models.User, conversa_id: int, resposta: schemas.MensagemCreate) -> models.Mensagem:
    conversa_obj = db.query(models.Conversa).join(models.Entidade).filter(models.Conversa.id == conversa_id, models.Entidade.organizacao_id == user.organizacao_id)
    if user.role != 'admin': conversa_obj = conversa_obj.filter(models.Conversa.entidade_id == user.entidade_id)
    conversa = conversa_obj.first()
    if not conversa: raise ValueError("Conversa não encontrada.")
    if conversa.status == "FECHADA": raise ValueError("Esta conversa está encerrada.")
    db_mensagem = models.Mensagem(conteudo=resposta.conteudo, conversa_id=conversa_id, user_id=user.id, lida=False)
    db.add(db_mensagem)
    conversa.status = "RESPONDIDA_ADMIN" if user.role == 'admin' else "RESPONDIDA_LOJA"
    conversa.ultima_atualizacao = datetime.now(ZoneInfo('America/Sao_Paulo'))
    db.commit(); db.refresh(db_mensagem)
    db.refresh(db_mensagem, attribute_names=['autor'])
    return db_mensagem

def encerrar_conversa(db: Session, user: models.User, conversa_id: int):
    if user.role != 'admin': raise ValueError("Apenas administradores podem encerrar conversas.")
    conversa_obj = db.query(models.Conversa).join(models.Entidade).filter(models.Conversa.id == conversa_id, models.Entidade.organizacao_id == user.organizacao_id)
    conversa = conversa_obj.first()
    if not conversa: raise ValueError("Conversa não encontrada.")
    conversa.status = "FECHADA"
    conversa.ultima_atualizacao = datetime.now(ZoneInfo('America/Sao_Paulo'))
    db.commit(); db.refresh(conversa)
    db.refresh(conversa, attribute_names=['mensagens', 'entidade'])
    return conversa

def contar_notificacoes(db: Session, user: models.User) -> int:
    query = db.query(func.count(models.Mensagem.id)).join(models.Conversa).join(models.Entidade).filter(models.Entidade.organizacao_id == user.organizacao_id, models.Mensagem.lida == False, models.Mensagem.user_id != user.id)
    if user.role != 'admin': query = query.filter(models.Conversa.entidade_id == user.entidade_id)
    return query.scalar() or 0

def get_ultima_auditoria_finalizada(db: Session, user: models.User):
    query = db.query(models.Auditoria).join(models.Entidade).filter(models.Auditoria.data_fim.isnot(None), models.Entidade.organizacao_id == user.organizacao_id)
    if user.role != 'admin': query = query.filter(models.Auditoria.entidade_id == user.entidade_id)
    ultima_auditoria = query.order_by(models.Auditoria.data_fim.desc()).first()
    if not ultima_auditoria: return None
    db.refresh(ultima_auditoria, attribute_names=['entidade'])
    diferencas_query = db.query(models.EscopoAuditoria).filter(models.EscopoAuditoria.auditoria_id == ultima_auditoria.id, models.EscopoAuditoria.diferenca != 0).order_by(func.abs(models.EscopoAuditoria.diferenca).desc()).limit(5).all()
    diferencas_list = [{"categoria_nome": d.categoria_nome, "diferenca": d.diferenca} for d in diferencas_query]
    return {"codigo_referencia": ultima_auditoria.codigo_referencia, "data_fim": ultima_auditoria.data_fim.isoformat() if ultima_auditoria.data_fim else None, "entidade_nome": ultima_auditoria.entidade.nome, "diferencas": diferencas_list}

def get_mensagens_recentes(db: Session, user: models.User) -> List[schemas.ConversaParaLista]:
    subquery_ultima_msg = db.query(models.Mensagem.conversa_id, func.max(models.Mensagem.enviado_em).label('ultima_msg_nao_lida_data')).join(models.Conversa).join(models.Entidade).filter(models.Entidade.organizacao_id == user.organizacao_id, models.Mensagem.lida == False, models.Mensagem.user_id != user.id)
    if user.role != 'admin': subquery_ultima_msg = subquery_ultima_msg.filter(models.Conversa.entidade_id == user.entidade_id)
    subquery_ultima_msg = subquery_ultima_msg.group_by(models.Mensagem.conversa_id).subquery()
    conversas_query = db.query(models.Conversa).join(subquery_ultima_msg, models.Conversa.id == subquery_ultima_msg.c.conversa_id).options(joinedload(models.Conversa.entidade)).order_by(subquery_ultima_msg.c.ultima_msg_nao_lida_data.desc()).limit(5)
    conversas = conversas_query.all()
    resultado = []
    for conv in conversas:
        nao_lidas = db.query(func.count(models.Mensagem.id)).filter(models.Mensagem.conversa_id == conv.id, models.Mensagem.lida == False, models.Mensagem.user_id != user.id).scalar() or 0
        if nao_lidas > 0: resultado.append(schemas.ConversaParaLista(id=conv.id, assunto=conv.assunto, status=conv.status, entidade=conv.entidade, ultima_atualizacao=conv.ultima_atualizacao, mensagens_nao_lidas=nao_lidas))
    return resultado


# --- FUNÇÕES PARA GERENCIAMENTO DE ENTIDADES ---
# ... (Funções criar_entidade, atualizar_entidade inalteradas) ...
def criar_entidade(db: Session, user: models.User, entidade_data: schemas.EntidadeCreate) -> models.Entidade:
    if user.role != 'admin':
        raise ValueError("Apenas administradores podem criar novas lojas.")
    existing_entidade = db.query(models.Entidade).filter(
        models.Entidade.nome.ilike(entidade_data.nome), models.Entidade.organizacao_id == user.organizacao_id
    ).first()
    if existing_entidade:
        raise ValueError(f"Uma loja com o nome '{entidade_data.nome}' já existe.")
    nova_entidade = models.Entidade(nome=entidade_data.nome, organizacao_id=user.organizacao_id)
    db.add(nova_entidade); db.commit(); db.refresh(nova_entidade)
    return nova_entidade

def atualizar_entidade(db: Session, user: models.User, entidade_id: int, entidade_data: schemas.EntidadeUpdate) -> Optional[models.Entidade]:
    if user.role != 'admin':
        raise ValueError("Apenas administradores podem editar lojas.")
    db_entidade = db.query(models.Entidade).filter(
        models.Entidade.id == entidade_id, models.Entidade.organizacao_id == user.organizacao_id
    ).first()
    if not db_entidade: return None
    if entidade_data.nome.lower() != db_entidade.nome.lower():
        existing_entidade = db.query(models.Entidade).filter(
            models.Entidade.nome.ilike(entidade_data.nome),
            models.Entidade.organizacao_id == user.organizacao_id,
            models.Entidade.id != entidade_id
        ).first()
        if existing_entidade:
            raise ValueError(f"Outra loja já utiliza o nome '{entidade_data.nome}'.")
    db_entidade.nome = entidade_data.nome
    db.commit(); db.refresh(db_entidade)
    return db_entidade


# --- Função de Cadastro ---
def create_organization_and_admin(db: Session, signup_data: schemas.SignUpRequest) -> models.User:
    # ... (código inalterado) ...
    existing_user = _get_user_by_username_regardless_of_status(db, username=signup_data.admin_email)
    if existing_user:
        raise ValueError("Este email já está registrado no sistema.")
    existing_org = db.query(models.Organizacao).filter(models.Organizacao.nome.ilike(signup_data.nome_empresa)).first()
    if existing_org:
        raise ValueError(f"Já existe uma organização registrada com o nome '{signup_data.nome_empresa}'.")
    try:
        nova_org = models.Organizacao(nome=signup_data.nome_empresa)
        db.add(nova_org); db.flush()
        hashed_password = security.get_password_hash(signup_data.admin_password)
        novo_admin = models.User(
            username=signup_data.admin_email, hashed_password=hashed_password, role="admin",
            organizacao_id=nova_org.id, entidade_id=None, is_active=True
        )
        db.add(novo_admin)
        entidade_matriz = models.Entidade(nome="Matriz", organizacao_id=nova_org.id)
        db.add(entidade_matriz)
        db.commit(); db.refresh(novo_admin)
        db.refresh(novo_admin, attribute_names=['organizacao'])
        return novo_admin
    except exc.SQLAlchemyError as e:
        db.rollback()
        print(f"Erro no banco de dados durante o cadastro: {e}")
        raise ValueError("Ocorreu um erro ao tentar criar a conta. Tente novamente.")
    except Exception as e:
        db.rollback()
        print(f"Erro inesperado durante o cadastro: {e}")
        raise ValueError("Ocorreu um erro inesperado. Tente novamente.")
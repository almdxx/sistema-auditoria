# FILE: main.py

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from typing import List, Optional
from sqlalchemy.orm import Session
import pandas as pd
import io
import os  # <-- IMPORTAÇÃO CORRIGIDA AQUI

import crud, models, schemas
from database import SessionLocal, engine, Base

# --- CONFIGURAÇÃO DA APLICAÇÃO E BANCO DE DADOS ---
Base.metadata.create_all(bind=engine)
app = FastAPI(title="Módulo de Auditoria")

# --- SERVIR ARQUIVOS DO FRONTEND ---
frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

@app.get("/", response_class=FileResponse, include_in_schema=False)
async def read_root():
    index_path = os.path.join(frontend_dir, "index.html")
    if not os.path.exists(index_path): 
        raise HTTPException(status_code=404, detail="Arquivo index.html não encontrado.")
    return index_path

# --- DEPENDÊNCIA DE BANCO DE DADOS ---
def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

# --- ROTAS GERAIS (ENTIDADE, CATEGORIA, CONFIG) ---
@app.get("/entidades/", response_model=List[schemas.Entidade])
def listar_entidades_api(db: Session = Depends(get_db)):
    """Lista todas as entidades cadastradas."""
    return crud.listar_entidades(db)

@app.get("/categorias/importadas/", response_model=List[str])
def obter_categorias_importadas_api(db: Session = Depends(get_db)):
    """Retorna uma lista única de todas as categorias de produtos existentes."""
    return crud.obter_todas_categorias_importadas(db)

@app.get("/configuracao/ultima_atualizacao_estoque", response_model=str)
def get_ultima_atualizacao_estoque_api(db: Session = Depends(get_db)):
    """Obtém a data da última vez que o estoque geral foi atualizado."""
    return crud.get_ultima_atualizacao_estoque(db)

# --- ROTAS DE AUDITORIA ---
@app.post("/auditorias/nova_com_escopo/", response_model=schemas.AuditoriaComEscopo)
def criar_auditoria_com_escopo_api(auditoria_data: schemas.AuditoriaScopeCreate, db: Session = Depends(get_db)):
    """Cria uma nova auditoria com um escopo definido de categorias."""
    return crud.criar_auditoria_com_escopo(db=db, auditoria_data=auditoria_data)

@app.get("/auditorias/", response_model=List[schemas.AuditoriaParaLista])
def listar_auditorias_api(db: Session = Depends(get_db)):
    """Lista todas as auditorias já criadas."""
    return crud.listar_auditorias(db=db)

@app.get("/auditorias/{auditoria_id}", response_model=schemas.AuditoriaComEscopo)
def get_auditoria_detalhes_api(auditoria_id: int, db: Session = Depends(get_db)):
    """Busca todos os detalhes de uma auditoria específica, incluindo seu escopo."""
    db_auditoria = crud.get_auditoria_detalhes(db, auditoria_id)
    if not db_auditoria:
        raise HTTPException(status_code=404, detail="Auditoria não encontrada")
    return db_auditoria

@app.post("/auditorias/{auditoria_id}/contagem_manual", response_model=schemas.AuditoriaComEscopo)
def salvar_contagens_manuais_api(auditoria_id: int, contagens: schemas.ContagemManualCreate, db: Session = Depends(get_db)):
    """Salva os dados de uma contagem manual para uma auditoria."""
    return crud.salvar_contagens_manuais(db, auditoria_id, contagens)

@app.post("/auditorias/{auditoria_id}/finalizar", response_model=schemas.AuditoriaComEscopo)
def finalizar_auditoria_api(auditoria_id: int, db: Session = Depends(get_db)):
    """Define a data de fim de uma auditoria, finalizando-a."""
    db_auditoria = crud.finalizar_auditoria(db, auditoria_id)
    if not db_auditoria:
        raise HTTPException(status_code=404, detail="Auditoria não encontrada")
    return db_auditoria

@app.get("/auditorias/{auditoria_id}/exportar_excel")
def exportar_auditoria_excel_api(auditoria_id: int, db: Session = Depends(get_db)):
    """Gera e retorna um relatório da auditoria em formato Excel (.xlsx)."""
    auditoria = crud.get_auditoria_detalhes(db, auditoria_id)
    if not auditoria:
        raise HTTPException(status_code=404, detail="Auditoria não encontrada.")

    excel_file_in_memory = crud.exportar_auditoria_excel(db, auditoria_id)
    filename = f"{auditoria.codigo_referencia}.xlsx"
    
    return StreamingResponse(
        excel_file_in_memory,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# --- ROTA DE IMPORTAÇÃO GERAL ---
@app.post("/produtos/importar_geral", response_model=schemas.ImportacaoResultado)
async def importar_planilha_geral(db: Session = Depends(get_db), file: UploadFile = File(...), entidade_id: int = Form(...)):
    """Processa uma planilha Excel para popular/atualizar o estoque geral."""
    try:
        df = pd.read_excel(file.file)
        if 'Item' not in df.columns or 'Estoque atual' not in df.columns: 
            raise HTTPException(status_code=400, detail="Planilha inválida.")
        
        produtos_criados = 0
        estoques_atualizados = 0
        for _, row in df.iterrows():
            item_bruto = row['Item']
            if pd.isna(item_bruto): continue
            
            nome_item = str(item_bruto).strip()
            if nome_item == '': continue

            estoque_atual = row['Estoque atual']
            quantidade_final = 0 if pd.isna(estoque_atual) else int(estoque_atual)

            produto = db.query(models.Produto).filter_by(nome_item=nome_item).first()
            if not produto:
                produto = models.Produto(nome_item=nome_item, grupo=nome_item)
                db.add(produto)
                db.flush()
                produtos_criados += 1
            
            estoque = db.query(models.Estoque).filter_by(produto_id=produto.id, entidade_id=entidade_id).first()
            if estoque:
                estoque.quantidade_sistema = quantidade_final
            else:
                db.add(models.Estoque(produto_id=produto.id, entidade_id=entidade_id, quantidade_sistema=quantidade_final))
            estoques_atualizados += 1
        
        crud.set_ultima_atualizacao_estoque(db)
        db.commit()
        mensagem = f"Estoque geral atualizado! {produtos_criados} novos produtos criados, {estoques_atualizados} estoques atualizados."
        return schemas.ImportacaoResultado(sucesso=True, mensagem=mensagem)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ocorreu um erro: {str(e)}")
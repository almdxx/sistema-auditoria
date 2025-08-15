# FILE: main.py

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from typing import List, Optional
from sqlalchemy.orm import Session
import pandas as pd
import io
import os

import crud, models, schemas, auth, security
from database import SessionLocal, engine, Base

# --- CONFIGURAÇÃO DA APLICAÇÃO ---
Base.metadata.create_all(bind=engine)
app = FastAPI(title="Módulo de Auditoria")

# --- SERVIR ARQUIVOS DO FRONTEND ---
frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

@app.get("/", response_class=FileResponse, include_in_schema=False)
async def serve_index():
    return FileResponse(os.path.join(frontend_dir, "index.html"))

@app.get("/login", response_class=FileResponse, include_in_schema=False)
async def serve_login_page():
    return FileResponse(os.path.join(frontend_dir, "login.html"))
    
@app.get("/relatorio.html", response_class=FileResponse, include_in_schema=False)
async def serve_relatorio_page():
    return FileResponse(os.path.join(frontend_dir, "relatorio.html"))

# --- DEPENDÊNCIA DE BANCO DE DADOS ---
def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

# --- ROTA DE AUTENTICAÇÃO ---
@app.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_username(db, username=form_data.username)
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = security.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# --- ROTAS PROTEGIDAS ---
@app.get("/users/me", response_model=schemas.UserInDB)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.get("/entidades/", response_model=List[schemas.Entidade])
def listar_entidades_api(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.listar_entidades(db, user=current_user)

@app.get("/categorias/importadas/", response_model=List[str])
def obter_categorias_importadas_api(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.obter_todas_categorias_importadas(db)

@app.get("/configuracao/ultima_atualizacao_estoque", response_model=str)
def get_ultima_atualizacao_estoque_api(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_ultima_atualizacao_estoque(db)

@app.post("/auditorias/nova_com_escopo/", response_model=schemas.AuditoriaComEscopo)
def criar_auditoria_com_escopo_api(auditoria_data: schemas.AuditoriaScopeCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.criar_auditoria_com_escopo(db=db, auditoria_data=auditoria_data, user=current_user)

@app.get("/auditorias/", response_model=List[schemas.AuditoriaParaLista])
def listar_auditorias_api(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.listar_auditorias(db=db, user=current_user)

@app.get("/auditorias/{auditoria_id}", response_model=schemas.AuditoriaComEscopo)
def get_auditoria_detalhes_api(auditoria_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_auditoria = crud.get_auditoria_detalhes(db, auditoria_id, user=current_user)
    if not db_auditoria:
        raise HTTPException(status_code=404, detail="Auditoria não encontrada ou sem permissão de acesso")
    return db_auditoria

@app.post("/auditorias/{auditoria_id}/contagem_manual", response_model=schemas.AuditoriaComEscopo)
def salvar_contagens_manuais_api(auditoria_id: int, contagens: schemas.ContagemManualCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    auditoria_atualizada = crud.salvar_contagens_manuais(db, auditoria_id, contagens, user=current_user)
    if not auditoria_atualizada:
        raise HTTPException(status_code=404, detail="Auditoria não encontrada ou sem permissão de acesso")
    return auditoria_atualizada

@app.post("/auditorias/{auditoria_id}/finalizar", response_model=schemas.AuditoriaComEscopo)
def finalizar_auditoria_api(auditoria_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_auditoria = crud.finalizar_auditoria(db, auditoria_id, user=current_user)
    if not db_auditoria:
        raise HTTPException(status_code=404, detail="Auditoria não encontrada ou sem permissão de acesso")
    return db_auditoria

@app.get("/auditorias/{auditoria_id}/exportar_excel")
def exportar_auditoria_excel_api(auditoria_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    excel_file_in_memory = crud.exportar_auditoria_excel(db, auditoria_id, user=current_user)
    if not excel_file_in_memory:
        raise HTTPException(status_code=404, detail="Auditoria não encontrada ou sem permissão de acesso")
    
    auditoria = crud.get_auditoria_detalhes(db, auditoria_id, user=current_user)
    filename = f"{auditoria.codigo_referencia}.xlsx"
    
    return StreamingResponse(
        excel_file_in_memory,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/relatorios/diferencas_consolidadas", response_model=List[schemas.RelatorioDiferenca])
def get_relatorio_diferencas_consolidadas(
    entidade_id: Optional[int] = None, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.username != 'admin':
        id_alvo = current_user.entidade_id
    else:
        id_alvo = entidade_id
    
    return crud.get_diferencas_consolidadas(db, entidade_id=id_alvo)

@app.post("/produtos/importar_geral", response_model=schemas.ImportacaoResultado)
async def importar_planilha_geral(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user),
    file: UploadFile = File(...), 
    entidade_id: Optional[int] = Form(None)
):
    
    id_entidade_alvo = None
    if current_user.username == 'admin':
        if entidade_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O administrador deve selecionar uma entidade para a importação."
            )
        id_entidade_alvo = entidade_id
    else:
        id_entidade_alvo = current_user.entidade_id

    try:
        df = pd.read_excel(file.file)
        if 'Item' not in df.columns or 'Estoque atual' not in df.columns: 
            raise HTTPException(status_code=400, detail="Planilha inválida. Verifique as colunas 'Item' e 'Estoque atual'.")
        
        produtos_criados, estoques_atualizados = 0, 0
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
            
            estoque = db.query(models.Estoque).filter_by(produto_id=produto.id, entidade_id=id_entidade_alvo).first()
            if estoque:
                estoque.quantidade_sistema = quantidade_final
            else:
                db.add(models.Estoque(produto_id=produto.id, entidade_id=id_entidade_alvo, quantidade_sistema=quantidade_final))
            estoques_atualizados += 1
        
        crud.set_ultima_atualizacao_estoque(db)
        db.commit()
        mensagem = f"Estoque geral atualizado! {produtos_criados} novos produtos criados, {estoques_atualizados} estoques atualizados."
        return schemas.ImportacaoResultado(sucesso=True, mensagem=mensagem)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ocorreu um erro inesperado: {str(e)}")
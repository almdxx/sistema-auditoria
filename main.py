# FILE: main.py (VERSÃO FINAL E ATUALIZADA)

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query, Response, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from typing import List, Optional
from sqlalchemy.orm import Session
import pandas as pd
import os
from datetime import date

import crud, models, schemas
from database import SessionLocal, engine, Base

Base.metadata.create_all(bind=engine)
app = FastAPI()
# ... (bloco de frontend e get_db sem alterações) ...
frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
if not os.path.exists(frontend_dir): os.makedirs(frontend_dir)
app.mount("/static", StaticFiles(directory=frontend_dir), name="static")
@app.get("/", response_class=FileResponse, include_in_schema=False)
async def read_root():
    index_path = os.path.join(frontend_dir, "index.html")
    if not os.path.exists(index_path): raise HTTPException(status_code=404, detail="Arquivo index.html não encontrado.")
    return index_path
def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

# ... (rotas de auditoria por item sem alterações) ...
@app.get("/entidades/", response_model=List[schemas.Entidade])
def listar_entidades_api(db: Session = Depends(get_db)): return crud.listar_entidades(db)
@app.post("/auditorias/", response_model=schemas.Auditoria)
def criar_auditoria_api(auditoria: schemas.AuditoriaCreate, db: Session = Depends(get_db)):
    auditoria_completa = crud.criar_auditoria(db, nome=auditoria.nome, entidade_id=auditoria.entidade_id)
    if auditoria_completa is None: raise HTTPException(status_code=404, detail="Entidade não encontrada.")
    return auditoria_completa
@app.get("/auditorias/", response_model=List[schemas.AuditoriaParaLista])
def listar_auditorias_api(db: Session = Depends(get_db)): return crud.listar_auditorias(db)
@app.get("/auditorias/{auditoria_id}", response_model=schemas.Auditoria)
def ler_auditoria_api(auditoria_id: int, db: Session = Depends(get_db)):
    auditoria_detalhada = crud.get_detalhes_para_auditoria(db, auditoria_id=auditoria_id)
    if not auditoria_detalhada: raise HTTPException(status_code=404, detail="Auditoria não encontrada")
    return auditoria_detalhada
@app.post("/auditorias/{auditoria_id}/contagem", response_model=schemas.ItemParaAuditoria)
def salvar_contagem_api(auditoria_id: int, produto_id: int = Form(...), qtd_fisica: int = Form(0), qtd_gerente: Optional[int] = Form(None), db: Session = Depends(get_db)):
    item_completo = crud.atualizar_contagem(db=db, auditoria_id=auditoria_id, produto_id=produto_id, qtd_fisica=qtd_fisica, qtd_gerente=qtd_gerente)
    if not item_completo: raise HTTPException(status_code=404, detail="Não foi possível salvar a contagem.")
    return item_completo

# ... (rotas de contagem por categoria sem alterações) ...
@app.get("/categorias/", response_model=List[str])
def obter_categorias_api(db: Session = Depends(get_db)): return crud.obter_categorias_distintas(db)
@app.get("/categorias/estoque/", response_model=dict)
def obter_estoque_categoria_api(entidade_id: int, categoria_nome: str, db: Session = Depends(get_db)):
    total = crud.calcular_estoque_por_categoria(db, entidade_id=entidade_id, categoria_nome=categoria_nome)
    return {"categoria": categoria_nome, "qtd_sistema": total}
@app.post("/contagens/categoria/", response_model=schemas.ContagemCategoria)
def criar_contagem_categoria_api(contagem: schemas.ContagemCategoriaCreate, db: Session = Depends(get_db)): return crud.criar_contagem_categoria(db=db, contagem=contagem)
@app.get("/contagens/categoria/", response_model=List[schemas.ContagemCategoria])
def listar_contagens_categoria_api(
    data: Optional[date] = None, categoria: Optional[str] = None, responsavel: Optional[str] = None, entidade_id: Optional[int] = None, db: Session = Depends(get_db)
): return crud.listar_contagens_categoria(db, data=data, categoria=categoria, responsavel=responsavel, entidade_id=entidade_id)

# --- NOVA ROTA ADICIONADA ---
@app.delete("/contagens/categoria/{contagem_id}", status_code=status.HTTP_204_NO_CONTENT)
def apagar_contagem_categoria_api(contagem_id: int, db: Session = Depends(get_db)):
    """Apaga um registro de contagem por categoria pelo seu ID."""
    contagem_apagada = crud.apagar_contagem_categoria(db, contagem_id=contagem_id)
    if contagem_apagada is None:
        raise HTTPException(status_code=404, detail="Registro de contagem não encontrado.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# ... (rotas de importação sem alterações) ...
@app.post("/produtos/importar")
async def importar_planilha(db: Session = Depends(get_db), file: UploadFile = File(...), entidade_id: int = Form(...)):
    entidade = db.query(models.Entidade).filter(models.Entidade.id == entidade_id).first()
    if not entidade: raise HTTPException(status_code=404, detail=f"Entidade com ID {entidade_id} não encontrada.")
    try:
        df = pd.read_excel(file.file)
        if 'Item' not in df.columns or 'Estoque atual' not in df.columns: raise HTTPException(status_code=400, detail="Planilha inválida.")
        produtos_criados, estoques_atualizados = 0, 0
        for _, row in df.iterrows():
            nome_item, estoque_atual = row['Item'], row['Estoque atual']
            if pd.isna(nome_item) or str(nome_item).strip() == '' or "total" in str(nome_item).lower(): continue
            produto = db.query(models.Produto).filter_by(nome_item=str(nome_item).strip()).first()
            if not produto:
                produto = models.Produto(nome_item=str(nome_item).strip(), grupo=str(nome_item).strip())
                db.add(produto); db.flush(); produtos_criados += 1
            estoque = db.query(models.Estoque).filter_by(produto_id=produto.id, entidade_id=entidade.id).first()
            if estoque: estoque.quantidade_sistema = int(estoque_atual)
            else: db.add(models.Estoque(produto_id=produto.id, entidade_id=entidade.id, quantidade_sistema=int(estoque_atual)))
            estoques_atualizados += 1
        db.commit()
        mensagem = f"Planilha importada para '{entidade.nome}'! {produtos_criados} produtos criados, {estoques_atualizados} estoques atualizados."
        return JSONResponse(content={"sucesso": True, "mensagem": mensagem})
    except Exception as e:
        db.rollback(); raise HTTPException(status_code=500, detail=f"Ocorreu um erro: {str(e)}")
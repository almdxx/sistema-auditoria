# FILE: main.py
# (Versão ATUALIZADA - Adicionada rota reset-password)

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse, RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
import pandas as pd
import io
import os
from datetime import datetime, date

# Garante que todos os módulos necessários estão importados
import crud, models, schemas, auth, security
from database import SessionLocal, engine

# --- Inicialização ---
models.Base.metadata.create_all(bind=engine)
app = FastAPI(title="Módulo de Auditoria")

# --- Montar Arquivos Estáticos (Frontend) ---
frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
if not os.path.isdir(frontend_dir):
    frontend_dir_alt = os.path.join(os.path.dirname(__file__), "..", "frontend")
    if os.path.isdir(frontend_dir_alt):
        frontend_dir = frontend_dir_alt
    else:
        print(f"AVISO: Diretório frontend não encontrado em '{frontend_dir}' ou '{frontend_dir_alt}'. Arquivos estáticos podem não funcionar.")
        frontend_dir = os.path.join(os.path.dirname(__file__), "frontend_fallback")
        os.makedirs(frontend_dir, exist_ok=True)

app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

# --- ROTAS PARA SERVIR PÁGINAS HTML ---
@app.get("/", response_class=FileResponse, include_in_schema=False)
async def serve_index(): return FileResponse(os.path.join(frontend_dir, "index.html"))
@app.get("/login", response_class=FileResponse, include_in_schema=False)
async def serve_login_page(): return FileResponse(os.path.join(frontend_dir, "login.html"))
@app.get("/login.html", response_class=FileResponse, include_in_schema=False)
async def serve_login_html_page(): return FileResponse(os.path.join(frontend_dir, "login.html"))
@app.get("/signup", response_class=FileResponse, include_in_schema=False)
async def serve_signup_page(): return FileResponse(os.path.join(frontend_dir, "signup.html"))
@app.get("/signup.html", response_class=FileResponse, include_in_schema=False)
async def serve_signup_html_page(): return FileResponse(os.path.join(frontend_dir, "signup.html"))
@app.get("/auditorias.html", response_class=FileResponse, include_in_schema=False)
async def serve_auditorias_page(): return FileResponse(os.path.join(frontend_dir, "auditorias.html"))
@app.get("/auditoria-detalhe.html", response_class=FileResponse, include_in_schema=False)
async def serve_auditoria_detalhe_page(): return FileResponse(os.path.join(frontend_dir, "auditoria-detalhe.html"))
@app.get("/relatorio.html", response_class=FileResponse, include_in_schema=False)
async def serve_relatorio_page(): return FileResponse(os.path.join(frontend_dir, "relatorio.html"))
@app.get("/configuracoes.html", response_class=FileResponse, include_in_schema=False)
async def serve_configuracoes_page(): return FileResponse(os.path.join(frontend_dir, "configuracoes.html"))
@app.get("/atualizar-estoque.html", response_class=FileResponse, include_in_schema=False)
async def serve_atualizar_estoque_page(): return FileResponse(os.path.join(frontend_dir, "atualizar-estoque.html"))
@app.get("/comunicacoes.html", response_class=FileResponse, include_in_schema=False)
async def serve_comunicacoes_page(): return FileResponse(os.path.join(frontend_dir, "comunicacoes.html"))
@app.get("/ajuda.html", response_class=FileResponse, include_in_schema=False)
async def serve_ajuda_page(): return FileResponse(os.path.join(frontend_dir, "ajuda.html"))
@app.get("/produtos.html", response_class=FileResponse, include_in_schema=False)
async def serve_produtos_page(): return FileResponse(os.path.join(frontend_dir, "produtos.html"))
@app.get("/usuarios.html", response_class=FileResponse, include_in_schema=False)
async def serve_usuarios_page(): return FileResponse(os.path.join(frontend_dir, "usuarios.html"))
@app.get("/lojas.html", response_class=FileResponse, include_in_schema=False)
async def serve_lojas_page(): return FileResponse(os.path.join(frontend_dir, "lojas.html"))


# --- Dependência: Obter Sessão do DB ---
def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

# --- ROTAS DA API ---

# --- Autenticação e Cadastro ---
@app.post("/token", response_model=schemas.Token, tags=["Autenticação"])
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_username(db, username=form_data.username) # Verifica is_active
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário ou senha incorretos ou usuário inativo.")
    access_token = security.create_access_token(data={"sub": user.username, "organizacao_id": user.organizacao_id, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.UserInDB, tags=["Autenticação"])
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.post("/signup", status_code=status.HTTP_201_CREATED, tags=["Autenticação"])
def signup_new_organization(signup_data: schemas.SignUpRequest, db: Session = Depends(get_db)):
    try:
        novo_admin = crud.create_organization_and_admin(db=db, signup_data=signup_data)
        return {"message": f"Organização '{novo_admin.organizacao.nome}' e administrador '{novo_admin.username}' criados com sucesso!"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(f"Erro inesperado no endpoint /signup: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro interno ao processar o cadastro.")


# --- Entidades (Lojas) ---
@app.get("/entidades/", response_model=List[schemas.Entidade], tags=["Entidades"])
def listar_entidades_api(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.listar_entidades(db, user=current_user)

@app.post("/api/entidades", response_model=schemas.Entidade, status_code=status.HTTP_201_CREATED, tags=["Entidades"])
def api_criar_entidade(entidade_data: schemas.EntidadeCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        return crud.criar_entidade(db=db, user=current_user, entidade_data=entidade_data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro interno ao criar entidade.")

@app.put("/api/entidades/{entidade_id}", response_model=schemas.Entidade, tags=["Entidades"])
def api_atualizar_entidade(entidade_id: int, entidade_data: schemas.EntidadeUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        db_entidade = crud.atualizar_entidade(db=db, user=current_user, entidade_id=entidade_id, entidade_data=entidade_data)
        if not db_entidade:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entidade não encontrada ou não pertence à sua organização.")
        return db_entidade
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro interno ao atualizar entidade.")


# --- Configuração ---
@app.get("/configuracao/ultima_atualizacao_estoque", response_model=str, tags=["Configuração"])
def get_ultima_atualizacao_estoque_api(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_ultima_atualizacao_estoque(db, user=current_user)

# --- Categorias ---
@app.get("/categorias/importadas/", response_model=List[schemas.CategoriaComEstoque], tags=["Categorias", "Auditorias"])
def api_obter_categorias_importadas(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        return crud.obter_todas_categorias_importadas(db=db, user=current_user)
    except Exception as e:
        print(f"Erro ao obter categorias importadas: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro ao buscar categorias.")


# --- Auditorias ---
# ... (Rotas de auditoria inalteradas) ...
@app.post("/auditorias/nova_com_escopo/", response_model=schemas.AuditoriaComEscopo, status_code=status.HTTP_201_CREATED, tags=["Auditorias"])
def criar_auditoria_com_escopo_api(auditoria_data: schemas.AuditoriaScopeCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try: return crud.criar_auditoria_com_escopo(db=db, auditoria_data=auditoria_data, user=current_user)
    except ValueError as e: raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

# ... (restante das rotas de auditoria: GET /, GET /{id}, POST /{id}/contagem, POST /{id}/finalizar, GET /{id}/exportar, DELETE /{id}) ...
@app.get("/auditorias/", response_model=List[schemas.AuditoriaDetalhadaParaLista], tags=["Auditorias"])
def listar_auditorias_api(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.listar_auditorias(db=db, user=current_user)

@app.get("/auditorias/ultima-finalizada", response_model=Optional[schemas.UltimaAuditoria], tags=["Auditorias", "Dashboard"])
def api_get_ultima_auditoria_finalizada(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_ultima_auditoria_finalizada(db, current_user)

@app.get("/auditorias/{auditoria_id}", response_model=schemas.AuditoriaComEscopo, tags=["Auditorias"])
def get_auditoria_detalhes_api(auditoria_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_auditoria = crud.get_auditoria_detalhes(db, auditoria_id, user=current_user)
    if not db_auditoria: raise HTTPException(status_code=404, detail="Auditoria não encontrada")
    return db_auditoria

@app.post("/auditorias/{auditoria_id}/contagem_manual", response_model=schemas.AuditoriaComEscopo, tags=["Auditorias"])
def salvar_contagens_manuais_api(auditoria_id: int, contagens: schemas.ContagemManualCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try: auditoria = crud.salvar_contagens_manuais(db, auditoria_id, contagens, user=current_user)
    except ValueError as e: raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not auditoria: raise HTTPException(status_code=404, detail="Auditoria não encontrada")
    return auditoria

@app.post("/auditorias/{auditoria_id}/finalizar", response_model=schemas.AuditoriaComEscopo, tags=["Auditorias"])
def finalizar_auditoria_api(auditoria_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_auditoria = crud.finalizar_auditoria(db, auditoria_id, user=current_user)
    if not db_auditoria: raise HTTPException(status_code=404, detail="Auditoria não encontrada ou inválida para finalização.")
    return db_auditoria

@app.get("/auditorias/{auditoria_id}/exportar_excel", tags=["Auditorias", "Export"])
def exportar_auditoria_excel_api(auditoria_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    excel_file = crud.exportar_auditoria_excel(db, auditoria_id, user=current_user)
    if not excel_file: raise HTTPException(status_code=404, detail="Auditoria não encontrada")
    auditoria = crud.get_auditoria_detalhes(db, auditoria_id, user=current_user)
    filename = f"auditoria_{auditoria_id}.xlsx"
    if auditoria and auditoria.codigo_referencia: filename = f"{auditoria.codigo_referencia}.xlsx"
    return StreamingResponse(excel_file, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename=\"{filename}\""})

@app.delete("/auditorias/{auditoria_id}", status_code=status.HTTP_200_OK, tags=["Auditorias"])
def deletar_auditoria_api(auditoria_id: int, payload: schemas.AuditoriaDeletePayload, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    sucesso, msg = crud.deletar_auditoria(db, auditoria_id, user=current_user, motivo=payload.motivo, password=payload.password)
    if not sucesso:
        if "Acesso negado" in msg or "Senha de administrador incorreta" in msg: # Atualizado
             raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=msg)
        if "não encontrada" in msg: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
    return {"detail": msg}


# --- Relatórios ---
# ... (Rotas de relatório inalteradas) ...
@app.get("/relatorios/diferencas_consolidadas", response_model=schemas.RelatorioCompleto, tags=["Relatórios"])
def get_relatorio_diferencas_consolidadas(entidade_id: Optional[int] = None, data_inicio: Optional[date] = None, data_fim: Optional[date] = None, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != 'admin': raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    return crud.get_relatorio_historico(db, org_id=current_user.organizacao_id, entidade_id=entidade_id, data_inicio=data_inicio, data_fim=data_fim)

@app.get("/relatorios/exportar_excel", tags=["Relatórios", "Export"])
def exportar_relatorio_consolidado_api(entidade_id: Optional[int] = None, data_inicio: Optional[date] = None, data_fim: Optional[date] = None, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != 'admin': raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    excel_file = crud.exportar_relatorio_historico_excel(db, org_id=current_user.organizacao_id, entidade_id=entidade_id, data_inicio=data_inicio, data_fim=data_fim)
    filename = f"relatorio_historico_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(excel_file, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename=\"{filename}\""})


# --- Produtos ---
# ... (Rotas de produtos inalteradas) ...
@app.post("/produtos/importar_geral", response_model=schemas.ImportacaoResultado, tags=["Produtos", "Import"])
async def importar_planilha_geral(file: UploadFile = File(...), entidade_id: Optional[int] = Form(None), db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if not file.filename.lower().endswith(('.xlsx', '.xls')): raise HTTPException(status_code=400, detail="Formato de arquivo inválido. Use .xlsx ou .xls.")
    file_contents = await file.read()
    try:
        resultado = crud.processar_importacao_estoque(db=db, user=current_user, file_contents=file_contents, entidade_id=entidade_id)
        return resultado
    except ValueError as e: db.rollback(); raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e: db.rollback(); print(f"Erro inesperado na importação: {e}"); raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Erro interno no servidor: {e}")

@app.get("/api/produtos", response_model=List[schemas.ProdutoSchema], tags=["Produtos"])
def api_listar_produtos(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != 'admin': raise HTTPException(status_code=403, detail="Acesso negado.")
    return crud.listar_produtos(db=db, user=current_user)

@app.put("/api/produtos/{produto_id}", response_model=schemas.ProdutoSchema, tags=["Produtos"])
def api_atualizar_custo_produto(produto_id: int, custo_update: schemas.ProdutoUpdateCusto, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try: produto_atualizado = crud.atualizar_custo_produto(db=db, produto_id=produto_id, novo_custo=custo_update.custo, user=current_user)
    except ValueError as e: raise HTTPException(status_code=400, detail=str(e))
    if not produto_atualizado: raise HTTPException(status_code=404, detail="Produto não encontrado ou não pertence à sua organização.")
    return produto_atualizado


# --- Gerenciamento de Usuários ---
# ... (Rotas GET /api/users, POST /api/users, PUT /api/users/{id}, PUT /api/users/{id}/status inalteradas) ...
@app.get("/api/users", response_model=List[schemas.UserListSchema], tags=["Usuários"])
def api_listar_usuarios(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != 'admin': raise HTTPException(status_code=403, detail="Acesso negado.")
    return crud.listar_usuarios_organizacao(db=db, admin_user=current_user)

@app.post("/api/users", response_model=schemas.UserListSchema, status_code=status.HTTP_201_CREATED, tags=["Usuários"])
def api_criar_usuario_loja(user_data: schemas.LojaUserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try: novo_usuario = crud.criar_usuario_loja(db=db, user_data=user_data, admin_user=current_user)
    except ValueError as e: raise HTTPException(status_code=400, detail=str(e))
    except Exception as e: print(f"Erro: {e}"); raise HTTPException(status_code=500, detail="Erro interno.")
    usuario_com_entidade = db.query(models.User).options(joinedload(models.User.entidade)).filter(models.User.id == novo_usuario.id).one_or_none()
    return usuario_com_entidade if usuario_com_entidade else novo_usuario

@app.put("/api/users/{user_id}", response_model=schemas.UserListSchema, tags=["Usuários"])
def api_atualizar_usuario_loja(user_id: int, user_data: schemas.LojaUserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try: usuario_atualizado = crud.atualizar_usuario_loja(db=db, user_id_to_update=user_id, user_update_data=user_data, admin_user=current_user)
    except ValueError as e: raise HTTPException(status_code=400, detail=str(e))
    except Exception as e: print(f"Erro: {e}"); raise HTTPException(status_code=500, detail="Erro interno.")
    if not usuario_atualizado: raise HTTPException(status_code=404, detail="Usuário não encontrado ou não pertence à sua organização.")
    return usuario_atualizado

@app.put("/api/users/{user_id}/status", response_model=schemas.UserListSchema, tags=["Usuários"])
def api_toggle_user_status(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        usuario_atualizado = crud.toggle_user_status(db=db, user_id_to_toggle=user_id, admin_user=current_user)
        if not usuario_atualizado: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado ou não pertence à sua organização.")
        return usuario_atualizado
    except ValueError as e: raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e: print(f"Erro ao mudar status do usuário {user_id}: {e}"); raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro interno ao atualizar status do usuário.")

# --- (NOVA ROTA) Resetar Senha ---
@app.put("/api/users/{user_id}/reset-password", status_code=status.HTTP_200_OK, tags=["Usuários"])
def api_reset_user_password(user_id: int, payload: schemas.UserResetPasswordPayload, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Endpoint para o administrador resetar a senha de um usuário de loja.
    """
    try:
        sucesso = crud.reset_user_password(
            db=db,
            user_id_to_reset=user_id,
            new_password=payload.new_password,
            admin_user=current_user
        )
        if not sucesso:
             raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado ou não pertence à sua organização.")

        return {"message": "Senha do usuário atualizada com sucesso."}

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(f"Erro ao resetar senha do usuário {user_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro interno ao resetar a senha.")


# --- Comunicação ---
# ... (Rotas de comunicação inalteradas) ...
@app.post("/comunicacao/nova", response_model=schemas.ConversaCompleta, status_code=status.HTTP_201_CREATED, tags=["Comunicação"])
def api_criar_nova_conversa(nova_conversa: schemas.NovaConversaCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try: return crud.criar_nova_conversa(db, current_user, nova_conversa)
    except ValueError as e: raise HTTPException(status_code=403, detail=str(e))

@app.get("/comunicacao/conversas", response_model=List[schemas.ConversaParaLista], tags=["Comunicação"])
def api_listar_conversas(incluir_fechadas: bool = False, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.listar_conversas(db, current_user, incluir_fechadas)

# ... (restante das rotas de comunicação) ...
@app.get("/comunicacao/conversas/{conversa_id}", response_model=schemas.ConversaCompleta, tags=["Comunicação"])
def api_obter_detalhes_conversa(conversa_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    conversa = crud.obter_detalhes_conversa(db, current_user, conversa_id)
    if not conversa: raise HTTPException(status_code=404, detail="Conversa não encontrada.")
    return conversa

@app.post("/comunicacao/conversas/{conversa_id}/responder", response_model=schemas.Mensagem, tags=["Comunicação"])
def api_adicionar_resposta(conversa_id: int, resposta: schemas.MensagemCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try: return crud.adicionar_resposta(db, current_user, conversa_id, resposta)
    except ValueError as e: raise HTTPException(status_code=400, detail=str(e))

@app.post("/comunicacao/conversas/{conversa_id}/encerrar", response_model=schemas.ConversaCompleta, tags=["Comunicação"])
def api_encerrar_conversa(conversa_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try: return crud.encerrar_conversa(db, current_user, conversa_id)
    except ValueError as e: raise HTTPException(status_code=403, detail=str(e))

@app.get("/comunicacao/notificacoes", response_model=schemas.Notificacao, tags=["Comunicação", "Dashboard"])
def api_contar_notificacoes(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return {"nao_lidas": crud.contar_notificacoes(db, current_user)}

@app.get("/comunicacao/mensagens/recentes", response_model=List[schemas.ConversaParaLista], tags=["Comunicação", "Dashboard"])
def api_get_mensagens_recentes(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_mensagens_recentes(db, current_user)
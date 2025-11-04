# FILE: seed.py (Versão GLOBAL - Correta com Emails)

from database import SessionLocal, engine, Base
from models import Organizacao, Entidade, User
from security import get_password_hash
import sys

# Cria as tabelas (garante que existam)
Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    print("Iniciando o seeding do banco de dados GLOBAL...")

    # 1. Criar a Organização (O Cliente)
    org_nome = "Spirito Santo"
    org = db.query(Organizacao).filter(Organizacao.nome == org_nome).first()
    if not org:
        org = Organizacao(nome=org_nome)
        db.add(org)
        db.commit()
        db.refresh(org)
        print(f"✅ Organização '{org.nome}' criada (ID: {org.id}).")
    else:
        print(f"⚠️  Organização '{org.nome}' já existe (ID: {org.id}).")

    # 2. Criar a Entidade (Loja Matriz)
    entidade_nome = "Matriz"
    matriz = db.query(Entidade).filter(Entidade.nome == entidade_nome, Entidade.organizacao_id == org.id).first()
    if not matriz:
        matriz = Entidade(nome=entidade_nome, organizacao_id=org.id)
        db.add(matriz)
        db.commit()
        db.refresh(matriz)
        print(f"✅ Entidade '{matriz.nome}' criada para a organização '{org.nome}'.")
    else:
        print(f"⚠️  Entidade '{matriz.nome}' já existe.")

    # 3. Criar o Usuário ADMIN (com email)
    admin_user = "admin@spiritosanto.com" # <<< USA EMAIL AGORA
    admin_pass = "123" # Mantenha ou altere a senha
    user_admin = db.query(User).filter(User.username == admin_user).first()
    if not user_admin:
        admin_hash = get_password_hash(admin_pass)
        novo_admin = User(
            username=admin_user, # <<< USA EMAIL AGORA
            hashed_password=admin_hash,
            role="admin",
            organizacao_id=org.id,
            entidade_id=None
        )
        db.add(novo_admin)
        print(f"👑 Usuário '{admin_user}' criado com a senha: {admin_pass}")
    else:
        print(f"👑 Usuário '{admin_user}' já existe.")

    # 4. Criar um Usuário LOJA (Exemplo com email)
    loja_user = "loja@spiritosanto.com" # <<< USA EMAIL AGORA
    loja_pass = "123" # Mantenha ou altere a senha
    user_loja = db.query(User).filter(User.username == loja_user).first()
    if not user_loja:
        loja_hash = get_password_hash(loja_pass)
        novo_loja = User(
            username=loja_user, # <<< USA EMAIL AGORA
            hashed_password=loja_hash,
            role="user",
            organizacao_id=org.id,
            entidade_id=matriz.id # Associa à Matriz
        )
        db.add(novo_loja)
        print(f"👤 Usuário '{loja_user}' criado com a senha: {loja_pass}")
    else:
        print(f"👤 Usuário '{loja_user}' já existe.")

    db.commit()
    print("\nSeeding global concluído!")

except Exception as e:
    print(f"\nERRO durante o seeding: {e}")
    db.rollback()
finally:
    db.close()
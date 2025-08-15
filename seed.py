# FILE: seed.py

from database import SessionLocal, engine
from models import Base, Entidade, User
from security import get_password_hash
import secrets
import string

Base.metadata.create_all(bind=engine)
db = SessionLocal()

def gerar_senha_aleatoria(tamanho=6):
    """Gera uma senha numérica aleatória de 6 dígitos."""
    alfabeto = string.digits
    return ''.join(secrets.choice(alfabeto) for i in range(tamanho))

# --- Lista de Entidades ---
entidades_para_criar = [
    "Matriz", "iguatemi", "moinhos", "outlet"
]

print("Iniciando o seeding do banco de dados...")
entidades_db = {} 

# --- 1. Cria as Entidades ---
for nome_entidade in entidades_para_criar:
    entidade_existente = db.query(Entidade).filter(Entidade.nome == nome_entidade).first()
    if not entidade_existente:
        nova_entidade = Entidade(nome=nome_entidade)
        db.add(nova_entidade)
        db.commit()
        db.refresh(nova_entidade)
        print(f"✅ Entidade '{nome_entidade}' criada.")
        entidades_db[nome_entidade] = nova_entidade
    else:
        print(f"⚠️ Entidade '{nome_entidade}' já existe.")
        entidades_db[nome_entidade] = entidade_existente

# --- 2. Cria os Usuários das Lojas ---
for nome_entidade in ["iguatemi", "moinhos", "outlet"]:
    usuario_existente = db.query(User).filter(User.username == nome_entidade).first()
    if not usuario_existente:
        senha_texto_puro = gerar_senha_aleatoria()
        senha_hash = get_password_hash(senha_texto_puro)
        entidade_loja = entidades_db[nome_entidade]
        novo_usuario = User(
            username=nome_entidade, 
            hashed_password=senha_hash,
            entidade_id=entidade_loja.id
        )
        db.add(novo_usuario)
        print(f"👤 Usuário '{nome_entidade}' criado com a senha: {senha_texto_puro}")
    else:
        print(f"👤 Usuário '{nome_entidade}' já existe.")

# --- 3. Cria o Usuário Admin ---
usuario_admin_existente = db.query(User).filter(User.username == "admin").first()
if not usuario_admin_existente:
    senha_texto_puro_admin = "123456"
    senha_hash_admin = get_password_hash(senha_texto_puro_admin)
    entidade_matriz = entidades_db["Matriz"]
    admin_user = User(
        username="admin",
        hashed_password=senha_hash_admin,
        entidade_id=entidade_matriz.id
    )
    db.add(admin_user)
    print(f"👑 Usuário admin criado com a senha padrão: {senha_texto_puro_admin}")
else:
    print(f"👑 Usuário admin já existe.")

db.commit()
print("\nSeeding concluído!")
db.close()
# FILE: seed.py

from database import SessionLocal, engine
from models import Base, Entidade

# Garante que as tabelas sejam criadas
Base.metadata.create_all(bind=engine)

# Inicia uma sessão com o banco de dados
db = SessionLocal()

# --- Lista de Entidades que você quer criar ---
# Adicione ou remova nomes de lojas/locais conforme necessário
entidades_para_criar = [
    "iguatemi",
    "moinhos",
    "outlet"
]

print("Iniciando o seeding do banco de dados...")

for nome_entidade in entidades_para_criar:
    # Verifica se a entidade já existe para não criar duplicatas
    entidade_existente = db.query(Entidade).filter(Entidade.nome == nome_entidade).first()
    
    if not entidade_existente:
        # Se não existe, cria a nova entidade
        nova_entidade = Entidade(nome=nome_entidade)
        db.add(nova_entidade)
        print(f"✅ Entidade '{nome_entidade}' criada com sucesso.")
    else:
        print(f"⚠️ Entidade '{nome_entidade}' já existe. Nenhuma ação foi tomada.")

# Salva as alterações no banco de dados
db.commit()

print("\nSeeding concluído!")

# Fecha a sessão
db.close()
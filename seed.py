from database import SessionLocal, engine
from models import Entidade, Base

def seed_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    nomes_entidades = ['iguatemi', 'moinhos', 'matriz', 'outlet']
    
    print("Iniciando o povoamento da tabela de entidades...")
    for nome in nomes_entidades:
        entidade_existente = db.query(Entidade).filter(Entidade.nome == nome).first()
        if not entidade_existente:
            nova_entidade = Entidade(nome=nome)
            db.add(nova_entidade)
            print(f"- Entidade '{nome}' criada.")
        else:
            print(f"- Entidade '{nome}' já existe.")
            
    db.commit()
    db.close()
    print("Povoamento concluído!")

if __name__ == "__main__":
    seed_data()
# FILE: models.py
# (Versão ATUALIZADA - Adicionado campo is_active no User)

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Text, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

# --- MODELO: Organizacao (O Cliente/Empresa) ---
class Organizacao(Base):
    __tablename__ = "organizacoes"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True, nullable=False)
    data_criacao = Column(DateTime(timezone=True), server_default=func.now())

    # Relacionamentos
    usuarios = relationship("User", back_populates="organizacao", cascade="all, delete-orphan")
    entidades = relationship("Entidade", back_populates="organizacao", cascade="all, delete-orphan")
    produtos = relationship("Produto", back_populates="organizacao", cascade="all, delete-orphan")

# --- MODELO: User (O Usuário do sistema) ---
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    organizacao_id = Column(Integer, ForeignKey("organizacoes.id"), nullable=False)
    role = Column(String, default="user", nullable=False)
    entidade_id = Column(Integer, ForeignKey("entidades.id"), nullable=True) # Admin não tem entidade
    is_active = Column(Boolean, default=True, nullable=False) # <<< NOVA COLUNA ADICIONADA AQUI

    # Relacionamentos
    organizacao = relationship("Organizacao", back_populates="usuarios")
    entidade = relationship("Entidade", back_populates="usuarios")
    mensagens = relationship("Mensagem", back_populates="autor")

# --- MODELO: Entidade (A Loja) ---
class Entidade(Base):
    __tablename__ = "entidades"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True, nullable=False)
    organizacao_id = Column(Integer, ForeignKey("organizacoes.id"), nullable=False)

    # Relacionamentos
    organizacao = relationship("Organizacao", back_populates="entidades")
    usuarios = relationship("User", back_populates="entidade")
    auditorias = relationship("Auditoria", back_populates="entidade", cascade="all, delete-orphan")
    estoques = relationship("Estoque", back_populates="entidade", cascade="all, delete-orphan")
    conversas = relationship("Conversa", back_populates="entidade", cascade="all, delete-orphan")

# --- MODELO: Produto (O Item) ---
class Produto(Base):
    __tablename__ = "produtos"
    id = Column(Integer, primary_key=True, index=True)
    nome_item = Column(String, index=True, nullable=False)
    grupo = Column(String, index=True)
    custo = Column(Float, default=0.0) # Coluna para impacto financeiro
    organizacao_id = Column(Integer, ForeignKey("organizacoes.id"), nullable=False)

    # Relacionamentos
    organizacao = relationship("Organizacao", back_populates="produtos")
    estoques = relationship("Estoque", back_populates="produto", cascade="all, delete-orphan")

# --- MODELO: Estoque (A Quantidade do Item na Loja) ---
class Estoque(Base):
    __tablename__ = "estoques"
    id = Column(Integer, primary_key=True, index=True)
    produto_id = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    entidade_id = Column(Integer, ForeignKey("entidades.id"), nullable=False)
    quantidade_sistema = Column(Integer, default=0)

    # Relacionamentos
    produto = relationship("Produto", back_populates="estoques")
    entidade = relationship("Entidade", back_populates="estoques")

# --- MODELO: Auditoria (O Evento de Contagem) ---
class Auditoria(Base):
    __tablename__ = "auditorias"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True)
    codigo_referencia = Column(String, index=True)
    responsavel = Column(String)
    data_inicio = Column(DateTime(timezone=True), server_default=func.now())
    data_fim = Column(DateTime(timezone=True), nullable=True)
    entidade_id = Column(Integer, ForeignKey("entidades.id"), nullable=False)

    # Relacionamentos
    entidade = relationship("Entidade", back_populates="auditorias")
    escopo = relationship("EscopoAuditoria", back_populates="auditoria", cascade="all, delete-orphan")

# --- MODELO: EscopoAuditoria (O Item dentro da Contagem) ---
class EscopoAuditoria(Base):
    __tablename__ = "escopo_auditoria"
    id = Column(Integer, primary_key=True, index=True)
    auditoria_id = Column(Integer, ForeignKey("auditorias.id"), nullable=False)
    categoria_nome = Column(String, nullable=False) # (nome_item / grupo)
    qtd_sistema = Column(Integer, default=0)
    qtd_contada = Column(Integer, default=0)
    diferenca = Column(Integer, default=0)
    data_contagem = Column(DateTime(timezone=True), nullable=True)

    # Relacionamentos
    auditoria = relationship("Auditoria", back_populates="escopo")

# --- MODELO: Configuracao (Configurações do Sistema) ---
class Configuracao(Base):
    __tablename__ = "configuracao"
    chave = Column(String, primary_key=True, unique=True, nullable=False)
    valor = Column(String, nullable=False)

# --- MODELO: Conversa (Tópico de Comunicação) ---
class Conversa(Base):
    __tablename__ = "conversas"
    id = Column(Integer, primary_key=True, index=True)
    assunto = Column(String, nullable=False)
    entidade_id = Column(Integer, ForeignKey("entidades.id"), nullable=False)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    ultima_atualizacao = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    status = Column(String, default="ABERTA")

    # Relacionamentos
    entidade = relationship("Entidade", back_populates="conversas")
    mensagens = relationship("Mensagem", back_populates="conversa", cascade="all, delete-orphan")

# --- MODELO: Mensagem (Mensagem da Comunicação) ---
class Mensagem(Base):
    __tablename__ = "mensagens"
    id = Column(Integer, primary_key=True, index=True)
    conversa_id = Column(Integer, ForeignKey("conversas.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    conteudo = Column(Text, nullable=False)
    enviado_em = Column(DateTime(timezone=True), server_default=func.now())
    lida = Column(Boolean, default=False, nullable=False)

    # Relacionamentos
    conversa = relationship("Conversa", back_populates="mensagens")
    autor = relationship("User", back_populates="mensagens")
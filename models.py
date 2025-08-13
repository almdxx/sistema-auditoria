# FILE: models.py

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from database import Base

class Entidade(Base):
    __tablename__ = "entidades"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, unique=True, nullable=False)
    estoques = relationship("Estoque", back_populates="entidade", cascade="all, delete-orphan")
    auditorias = relationship("Auditoria", back_populates="entidade")
    usuarios = relationship("User", back_populates="entidade")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    entidade_id = Column(Integer, ForeignKey("entidades.id"), nullable=False)
    entidade = relationship("Entidade", back_populates="usuarios")

class Produto(Base):
    __tablename__ = "produtos"
    id = Column(Integer, primary_key=True, index=True)
    nome_item = Column(String, unique=True, index=True, nullable=False)
    grupo = Column(String, index=True)
    estoques = relationship("Estoque", back_populates="produto", cascade="all, delete-orphan")

class Estoque(Base):
    __tablename__ = "estoques"
    id = Column(Integer, primary_key=True, index=True)
    quantidade_sistema = Column(Integer, default=0)
    produto_id = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    entidade_id = Column(Integer, ForeignKey("entidades.id"), nullable=False)
    produto = relationship("Produto", back_populates="estoques")
    entidade = relationship("Entidade", back_populates="estoques")

class Auditoria(Base):
    __tablename__ = "auditorias"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True, nullable=False)
    codigo_referencia = Column(String, unique=True, index=True, nullable=False)
    entidade_id = Column(Integer, ForeignKey("entidades.id"), nullable=False)
    responsavel = Column(String, nullable=False)
    data_inicio = Column(DateTime(timezone=True), nullable=False)
    data_fim = Column(DateTime(timezone=True), nullable=True)
    entidade = relationship("Entidade", back_populates="auditorias")
    escopo = relationship("EscopoAuditoria", back_populates="auditoria", cascade="all, delete-orphan")

class EscopoAuditoria(Base):
    __tablename__ = "escopo_auditoria"
    id = Column(Integer, primary_key=True, index=True)
    categoria_nome = Column(String, index=True, nullable=False)
    auditoria_id = Column(Integer, ForeignKey("auditorias.id"), nullable=False)
    qtd_sistema = Column(Integer, default=0, nullable=False)
    qtd_contada = Column(Integer, default=0, nullable=False)
    diferenca = Column(Integer, default=0, nullable=False)
    data_contagem = Column(DateTime(timezone=True), nullable=True)
    auditoria = relationship("Auditoria", back_populates="escopo")

class Configuracao(Base):
    __tablename__ = "configuracao"
    chave = Column(String, primary_key=True)
    valor = Column(String, nullable=False)
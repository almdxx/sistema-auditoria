from sqlalchemy import Column, Integer, String, ForeignKey, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Entidade(Base):
    __tablename__ = "entidades"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, unique=True, nullable=False)
    auditorias = relationship("Auditoria", back_populates="entidade")
    estoques = relationship("Estoque", back_populates="entidade", cascade="all, delete-orphan")
    contagens_categoria = relationship("ContagemCategoria", back_populates="entidade")

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
    nome = Column(String, index=True)
    entidade_id = Column(Integer, ForeignKey("entidades.id"), nullable=False)
    itens = relationship("ItemAuditoria", back_populates="auditoria", cascade="all, delete-orphan")
    entidade = relationship("Entidade", back_populates="auditorias")

class ItemAuditoria(Base):
    __tablename__ = "itens_auditoria"
    id = Column(Integer, primary_key=True, index=True)
    auditoria_id = Column(Integer, ForeignKey("auditorias.id"), nullable=False)
    produto_id = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    qtd_sistema = Column(Integer, default=0)
    qtd_fisica = Column(Integer, default=0)
    qtd_gerente = Column(Integer, nullable=True)
    diferenca = Column(Integer, default=0)
    auditoria = relationship("Auditoria", back_populates="itens")
    produto = relationship("Produto")

class ContagemCategoria(Base):
    __tablename__ = "contagens_categoria"
    id = Column(Integer, primary_key=True, index=True)
    data_contagem = Column(Date, nullable=False, default=func.now())
    responsavel = Column(String, nullable=False, index=True)
    categoria_nome = Column(String, nullable=False, index=True)
    qtd_contada = Column(Integer, nullable=False)
    qtd_sistema = Column(Integer, nullable=False)
    diferenca = Column(Integer, nullable=False)
    entidade_id = Column(Integer, ForeignKey("entidades.id"), nullable=False)
    entidade = relationship("Entidade", back_populates="contagens_categoria")
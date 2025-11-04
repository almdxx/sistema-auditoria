# FILE: schemas.py
# (Versão ATUALIZADA - Mínimo de senha aumentado para 8)

from pydantic import BaseModel, ConfigDict, EmailStr, Field # Adicionado Field
from typing import List, Optional
from datetime import datetime, date

# --- SCHEMA: Organizacao (Resposta) ---
class Organizacao(BaseModel):
    id: int
    nome: str
    model_config = ConfigDict(from_attributes=True)

# --- SCHEMA: Entidade (Resposta) ---
class Entidade(BaseModel):
    id: int
    nome: str
    organizacao_id: int
    model_config = ConfigDict(from_attributes=True)

# --- SCHEMA: UserInDB (Resposta / Usuário Logado) ---
class UserInDB(BaseModel):
    id: int
    username: EmailStr
    role: str
    organizacao_id: int
    entidade_id: Optional[int] = None
    entidade: Optional[Entidade] = None
    organizacao: Organizacao
    model_config = ConfigDict(from_attributes=True)

# --- SCHEMA: Token (Resposta Login) ---
class Token(BaseModel):
    access_token: str
    token_type: str

# --- SCHEMA: TokenData (Payload do JWT) ---
class TokenData(BaseModel):
    sub: Optional[str] = None
    organizacao_id: Optional[int] = None
    role: Optional[str] = None

# --- SCHEMA: UserBase (Base) ---
class UserBase(BaseModel):
    username: EmailStr

# --- SCHEMA: UserCreate (Input - Para criar via API se necessário) ---
# (Não usado diretamente, mas pode ser atualizado por consistência)
class UserCreate(BaseModel):
    username: EmailStr
    password: str = Field(..., min_length=8) # Atualizado min_length
    role: str = "user"
    entidade_id: Optional[int] = None

# --- SCHEMA: SignUpRequest (Input - Para Cadastro/Signup futuro) ---
class SignUpRequest(BaseModel):
    nome_empresa: str
    admin_email: EmailStr
    admin_password: str = Field(..., min_length=8) # Atualizado min_length


# --- SCHEMA: AuditoriaDeletePayload (Input) ---
class AuditoriaDeletePayload(BaseModel):
    motivo: str
    password: str # Senha do admin para confirmação, não tem mínimo aqui

# --- SCHEMA: AuditoriaScopeCreate (Input) ---
class AuditoriaScopeCreate(BaseModel):
    responsavel: str
    categorias_escopo: List[str]
    entidade_id: Optional[int] = None

# --- SCHEMA: EscopoAuditoriaSchema (Resposta) ---
class EscopoAuditoriaSchema(BaseModel):
    categoria_nome: str
    qtd_sistema: int
    qtd_contada: int
    diferenca: int
    data_contagem: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

# --- SCHEMA: AuditoriaComEscopo (Resposta - Detalhes) ---
class AuditoriaComEscopo(BaseModel):
    id: int
    nome: str
    codigo_referencia: str
    responsavel: str
    data_inicio: datetime
    data_fim: Optional[datetime] = None
    entidade: Entidade
    escopo: List[EscopoAuditoriaSchema] = []
    model_config = ConfigDict(from_attributes=True)

# --- SCHEMA: AuditoriaDetalhadaParaLista (Resposta - Lista) ---
class AuditoriaDetalhadaParaLista(BaseModel):
    id: int
    nome: str
    codigo_referencia: str
    responsavel: str
    data_inicio: datetime
    status: str
    entidade: Entidade
    model_config = ConfigDict(from_attributes=True)

# --- SCHEMA: ImportacaoResultado (Resposta) ---
class ImportacaoResultado(BaseModel):
    sucesso: bool
    mensagem: str
    criados: int = 0
    atualizados: int = 0
    custos_atualizados: int = 0
    erros: List[str] = []


# --- SCHEMA: ContagemManualItem (Input) ---
class ContagemManualItem(BaseModel):
    categoria_nome: str
    qtd_contada: int

# --- SCHEMA: ContagemManualCreate (Input) ---
class ContagemManualCreate(BaseModel):
    contagens: List[ContagemManualItem]

# --- SCHEMA: KpiSchema (Resposta - Relatório) ---
class KpiSchema(BaseModel):
    auditorias_no_periodo: int
    total_itens_divergentes: int
    taxa_acuracia: float
    impacto_financeiro: float

# --- SCHEMA: RelatorioHistoricoItem (Resposta - Relatório) ---
class RelatorioHistoricoItem(BaseModel):
    codigo_auditoria: str
    entidade_nome: str
    data_fim: datetime
    categoria_nome: str
    qtd_sistema: int
    qtd_contada: int
    diferenca: int
    impacto_item: float
    model_config = ConfigDict(from_attributes=True)

# --- SCHEMA: RelatorioCompleto (Resposta - Relatório) ---
class RelatorioCompleto(BaseModel):
    kpis: KpiSchema
    diferencas: List[RelatorioHistoricoItem]

# --- SCHEMA: RelatorioDiferenca (Não usado atualmente) ---
class RelatorioDiferenca(BaseModel):
    categoria_nome: str
    total_sistema: int
    total_contada: int
    diferenca_total: int
    impacto_financeiro: float
    model_config = ConfigDict(from_attributes=True)

# --- SCHEMA: UserSimple (Resposta - Mensagens) ---
class UserSimple(BaseModel):
    id: int
    username: EmailStr
    model_config = ConfigDict(from_attributes=True)

# --- SCHEMA: Mensagem (Resposta - Mensagens) ---
class Mensagem(BaseModel):
    id: int
    conteudo: str
    enviado_em: datetime
    lida: bool
    autor: UserSimple
    model_config = ConfigDict(from_attributes=True)

# --- SCHEMA: MensagemCreate (Input) ---
class MensagemCreate(BaseModel):
    conteudo: str

# --- SCHEMA: NovaConversaCreate (Input) ---
class NovaConversaCreate(BaseModel):
    assunto: str
    primeira_mensagem: str

# --- SCHEMA: ConversaParaLista (Resposta - Lista) ---
class ConversaParaLista(BaseModel):
    id: int
    assunto: str
    status: str
    entidade: Entidade
    ultima_atualizacao: datetime
    mensagens_nao_lidas: int
    model_config = ConfigDict(from_attributes=True)

# --- SCHEMA: ConversaCompleta (Resposta - Detalhes) ---
class ConversaCompleta(BaseModel):
    id: int
    assunto: str
    status: str
    entidade: Entidade
    mensagens: List[Mensagem]
    model_config = ConfigDict(from_attributes=True)

# --- SCHEMA: Notificacao (Resposta) ---
class Notificacao(BaseModel):
    nao_lidas: int

# --- SCHEMA: ResumoDiferenca (Resposta - Dashboard) ---
class ResumoDiferenca(BaseModel):
    categoria_nome: str
    diferenca: int

# --- SCHEMA: UltimaAuditoria (Resposta - Dashboard) ---
class UltimaAuditoria(BaseModel):
    codigo_referencia: str
    data_fim: Optional[datetime] = None
    entidade_nome: str
    diferencas: List[ResumoDiferenca]

# --- SCHEMA: CategoriaComEstoque (Resposta) ---
class CategoriaComEstoque(BaseModel):
    nome: str
    estoque_total: int

# --- SCHEMA: ProdutoUpdateCusto (Input) ---
class ProdutoUpdateCusto(BaseModel):
    custo: float

# --- SCHEMA: ProdutoSchema (Resposta) ---
class ProdutoSchema(BaseModel):
    id: int
    nome_item: str
    grupo: Optional[str] = None
    custo: float
    organizacao_id: int
    model_config = ConfigDict(from_attributes=True)

# --- SCHEMAS PARA GERENCIAMENTO DE USUÁRIOS ---

# --- SCHEMA: LojaUserCreate (Input) ---
class LojaUserCreate(BaseModel):
    username: EmailStr
    password: str = Field(..., min_length=8) # Atualizado min_length
    entidade_id: int

# --- SCHEMA: EntidadeSimple (Auxiliar) ---
class EntidadeSimple(BaseModel):
    id: int
    nome: str
    model_config = ConfigDict(from_attributes=True)

# --- SCHEMA: UserListSchema (Resposta) ---
class UserListSchema(BaseModel):
    id: int
    username: EmailStr
    role: str
    entidade: Optional[EntidadeSimple] = None
    organizacao_id: int
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

# --- Schema para receber dados ao ATUALIZAR um utilizador de loja ---
class LojaUserUpdate(BaseModel):
    entidade_id: int

# --- Schema para payload de Reset de Senha ---
class UserResetPasswordPayload(BaseModel):
    new_password: str = Field(..., min_length=8) # Atualizado min_length

# --- SCHEMAS PARA GERENCIAMENTO DE ENTIDADES ---

# --- Schema para CRIAR uma nova entidade (loja) ---
class EntidadeCreate(BaseModel):
    nome: str

# --- Schema para ATUALIZAR uma entidade (loja) ---
class EntidadeUpdate(BaseModel):
    nome: str
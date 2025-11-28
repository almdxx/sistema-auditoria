# Módulo de Auditoria & Gestão de Estoque (SaaS)

![Status](https://img.shields.io/badge/Status-Em_Desenvolvimento-yellow)
![Python](https://img.shields.io/badge/Python-3.12+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)
![License](https://img.shields.io/badge/License-MIT-lightgrey.svg)

## 📋 Sobre o Projeto

O **Módulo de Auditoria** é uma aplicação web completa no modelo **SaaS (Software as a Service)** B2B, desenvolvida para facilitar o controle de estoque, realizar auditorias de precisão e gerenciar perdas em redes de varejo.

O sistema foi projetado com uma arquitetura **Multi-tenant**, garantindo que os dados de cada organização (cliente) fiquem isolados e seguros. Ele permite que administradores gerenciem múltiplas lojas, usuários e produtos, enquanto as equipes locais realizam contagens de estoque e reportam divergências.

---

## 🚀 Funcionalidades Principais

### 🏢 Gestão Administrativa
- **Multi-tenancy:** Isolamento total de dados por organização.
- **Cadastro Público (Sign-up):** Fluxo autônomo para novas empresas se registrarem.
- **Gestão de Lojas (Entidades):** Criação e edição de filiais.
- **Gestão de Usuários:** Controle de acesso baseado em papéis (Admin vs. Usuário Loja), ativação/desativação de contas e reset de senha.
- **Gestão de Produtos:** Listagem e ajuste manual de custos para cálculo de impacto financeiro.

### 📦 Operação e Auditoria
- **Importação de Estoque:** Processamento de planilhas Excel (`.xlsx`) para atualização em massa do estoque sistêmico.
- **Criação de Auditorias:** Definição de escopo por categorias e responsável.
- **Contagem Cega/Guiada:** Interface para inserção de contagens físicas.
- **Análise de Divergências:** Comparação automática entre estoque sistêmico e físico com destaque visual.

### 📊 Inteligência e Relatórios
- **Dashboard:** Visão geral com KPIs de acuracidade e últimas atividades.
- **Relatório Geral:** Histórico consolidado de divergências com filtros por data e loja.
- **Exportação:** Geração de relatórios detalhados em Excel.

### 💬 Comunicação
- **Chat Interno:** Sistema de mensagens entre lojas e a administração para resolver pendências de auditoria.

---

## 🛠️ Tecnologias Utilizadas

### Backend
- **Linguagem:** Python 3.12+
- **Framework:** FastAPI (Alta performance e validação automática)
- **ORM:** SQLAlchemy (Interação com Banco de Dados)
- **Banco de Dados:** PostgreSQL
- **Autenticação:** JWT (JSON Web Tokens) com OAuth2
- **Processamento de Dados:** Pandas (Manipulação de arquivos Excel)
- **Segurança:** Passlib (Hashing de senhas com Bcrypt)

### Frontend
- **Linguagem:** JavaScript (Vanilla ES6+), HTML5, CSS3
- **Framework CSS:** Bootstrap 5 (Responsividade e Componentes)
- **Utilitários:** Chart.js (Gráficos), TomSelect (Selects avançados)
- **Arquitetura:** Single Page Application (SPA) feel, consumindo API RESTful.

---

## ⚙️ Pré-requisitos

Antes de começar, certifique-se de ter instalado em sua máquina:
* [Python 3.12+](https://www.python.org/)
* [PostgreSQL](https://www.postgresql.org/)
* [Git](https://git-scm.com/)

---

## 🚀 Como Executar o Projeto

### 1. Clone o repositório
```bash
git clone [https://github.com/almdxx/sistema-auditoria.git](https://github.com/almdxx/sistema-auditoria.git)
cd sistema-auditoria

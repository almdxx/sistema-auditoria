// FILE: frontend/nav.js
// (Versão ATUALIZADA - Renomeado link e adicionado Lojas)

document.addEventListener('DOMContentLoaded', async () => {
    const navPlaceholder = document.getElementById('nav-placeholder');
    if (!navPlaceholder) return; 

    const token = localStorage.getItem('accessToken');
    if (!token) {
        if (window.location.pathname !== '/login.html' && window.location.pathname !== '/login') {
            window.location.href = '/login';
        }
        return; 
    }

    let currentUser = null;
    try {
        const response = await fetch('/users/me', { headers: { 'Authorization': `Bearer ${token}` } });
        if (response.status === 401) { 
             localStorage.removeItem('accessToken');
             window.location.href = '/login';
             return; 
        }
        if (!response.ok) {
            throw new Error(`Erro ao buscar dados do usuário: ${response.statusText}`);
        }
        currentUser = await response.json();
        
        if (window.appState) {
            window.appState.currentUser = currentUser;
        }

    } catch (error) {
        console.error("Erro ao buscar usuário:", error);
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return; 
    }

    const username = currentUser ? currentUser.username : 'Utilizador';
    const isAdmin = currentUser && currentUser.role === 'admin';

    const navHtml = `
    <header class="top-bar p-3 d-flex justify-content-between align-items-center shadow-sm">
        <div class="d-flex align-items-center">
            <button class="btn btn-icon-menu" type="button" data-bs-toggle="offcanvas" data-bs-target="#mainMenuOffcanvas" aria-controls="mainMenuOffcanvas">
                <i class="bi bi-list"></i>
            </button>
            <a class="navbar-brand-text" href="/">Módulo de Auditoria</a>
        </div>
        <div class="d-flex align-items-center">
            <span id="user-info" class="navbar-text me-3 text-truncate" style="max-width: 150px;" title="${username}">Olá, ${username}</span>
            <button id="logout-button" class="btn btn-outline-secondary btn-sm">Sair</button>
        </div>
    </header>

    <div class="offcanvas offcanvas-start" tabindex="-1" id="mainMenuOffcanvas" aria-labelledby="mainMenuOffcanvasLabel">
        <div class="offcanvas-header border-bottom">
            <h5 class="offcanvas-title" id="mainMenuOffcanvasLabel">Menu Principal</h5>
            <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div class="offcanvas-body">
            <ul class="navbar-nav">
                <li class="nav-item"><a class="nav-link" href="/"><i class="bi bi-house-door-fill me-2"></i> Início</a></li>
                <li class="nav-item"><a class="nav-link" href="/auditorias.html"><i class="bi bi-card-checklist me-2"></i> Auditorias</a></li>
                ${isAdmin ? `
                <li class="nav-item"><a class="nav-link" href="/relatorio.html"><i class="bi bi-graph-up me-2"></i> Relatório Geral</a></li>
                <li class="nav-item"><a class="nav-link" href="/produtos.html"><i class="bi bi-box-seam-fill me-2"></i> Produtos</a></li>
                <li class="nav-item"><a class="nav-link" href="/usuarios.html"><i class="bi bi-people-fill me-2"></i> Usuários</a></li> <li class="nav-item"><a class="nav-link" href="/lojas.html"><i class="bi bi-shop-window me-2"></i> Lojas</a></li> ` : ''}
                <li class="nav-item"><a class="nav-link" href="/atualizar-estoque.html"><i class="bi bi-upload me-2"></i> Atualizar Estoque</a></li>
                <li class="nav-item"><a class="nav-link" href="/comunicacoes.html"><i class="bi bi-chat-dots-fill me-2"></i> Comunicações</a></li>
                <hr class="my-2">
                <li class="nav-item"><a class="nav-link" href="/ajuda.html"><i class="bi bi-question-circle-fill me-2"></i> Ajuda</a></li>
            </ul>
        </div>
    </div>
    `;

    navPlaceholder.innerHTML = navHtml;

    const currentPage = window.location.pathname;
    const navLinks = navPlaceholder.querySelectorAll('.offcanvas .nav-link'); 
    navLinks.forEach(link => {
        let linkHref = link.getAttribute('href');
        if ((currentPage === '/' || currentPage === '/index.html') && linkHref === '/') {
             link.classList.add('active');
        } else if (linkHref !== '/' && currentPage.startsWith(linkHref)) { 
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('accessToken');
            window.location.href = '/login'; 
        });
    }
});
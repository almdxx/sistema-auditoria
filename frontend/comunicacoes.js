// FILE: frontend/comunicacoes.js
// (Versão REFATORADA)

document.addEventListener('DOMContentLoaded', async () => {
    // apiFetch e showToast agora são globais (utils.js)
    
    // Elementos do DOM
    const listaConversasEl = document.getElementById('lista-conversas');
    const placeholderConversaEl = document.getElementById('placeholder-conversa');
    const conversaAtivaContainerEl = document.getElementById('conversa-ativa-container');
    const conversaAssuntoStatusEl = document.getElementById('conversa-assunto-status');
    const mensagensContainerEl = document.getElementById('mensagens-container');
    const btnNovaConversa = document.getElementById('btn-nova-conversa');
    const formResposta = document.getElementById('form-resposta');
    const inputResposta = document.getElementById('input-resposta');
    const btnEnviarResposta = document.getElementById('btn-enviar-resposta');
    const btnSalvarConversa = document.getElementById('btn-salvar-conversa');
    const novaConversaModal = new bootstrap.Modal(document.getElementById('novaConversaModal'));
    const btnEncerrarConversa = document.getElementById('btn-encerrar-conversa');
    const filtroContainer = document.getElementById('filtro-container');
    const filtroFechadas = document.getElementById('filtro-fechadas');
    
    const confirmarEncerramentoModal = new bootstrap.Modal(document.getElementById('confirmarEncerramentoModal'));
    const btnConfirmarEncerramento = document.getElementById('btn-confirmar-encerramento');

    let currentUser = null; // Será pego do window.appState
    let activeConversaId = null;

    // apiFetch foi removido, usamos o global

    const formatarData = (dataStr) => new Date(dataStr).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

    function renderizarListaConversas(conversas) {
        if (conversas.length === 0) {
            listaConversasEl.innerHTML = `<div class="list-group-item text-muted text-center p-4">Nenhuma conversa encontrada.</div>`;
            return;
        }
        listaConversasEl.innerHTML = conversas.map(c => {
            const isFechada = c.status === 'FECHADA';
            return `
            <a href="#" class="list-group-item list-group-item-action ${c.id === activeConversaId ? 'active' : ''} ${isFechada ? 'list-group-item-light' : ''}" data-id="${c.id}">
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1 text-truncate"><i class="bi ${isFechada ? 'bi-lock-fill' : 'bi-chat-dots-fill'} me-2"></i>${c.assunto}</h6>
                    ${!isFechada && c.mensagens_nao_lidas > 0 ? `<span class="badge bg-danger rounded-pill">${c.mensagens_nao_lidas}</span>` : ''}
                </div>
                <small class="text-muted">De: ${c.entidade.nome.toUpperCase()} - Status: ${c.status}</small>
            </a>
        `}).join('');
    }

    async function carregarListaConversas() {
        const incluirFechadas = filtroFechadas.checked;
        try {
            const conversas = await apiFetch(`/comunicacao/conversas?incluir_fechadas=${incluirFechadas}`); // Usa apiFetch global
            renderizarListaConversas(conversas);
        } catch (error) {
            // Erro já tratado pelo toast do apiFetch
            listaConversasEl.innerHTML = `<div class="list-group-item text-danger">Erro ao carregar conversas.</div>`;
        }
    }

    async function carregarDetalhesConversa(id) {
        activeConversaId = id;
        placeholderConversaEl.style.display = 'none';
        conversaAtivaContainerEl.style.display = 'block';
        mensagensContainerEl.innerHTML = '<div class="p-5 text-center"><div class="spinner-border text-primary" role="status"></div></div>';
        
        try {
            const conversa = await apiFetch(`/comunicacao/conversas/${id}`); // Usa apiFetch global
            const isFechada = conversa.status === 'FECHADA';
            
            conversaAssuntoStatusEl.textContent = `${conversa.assunto} (${conversa.status})`;
            mensagensContainerEl.innerHTML = conversa.mensagens.map(msg => {
                const isMe = msg.autor.id === currentUser.id;
                return `<div class="d-flex ${isMe ? 'justify-content-end' : ''} mb-3"><div class="card" style="max-width: 75%;"><div class="card-body p-2"><p class="card-text mb-1">${msg.conteudo}</p><small class="text-muted d-block text-end">${msg.autor.username} - ${formatarData(msg.enviado_em)}</small></div></div></div>`;
            }).join('');
            mensagensContainerEl.scrollTop = mensagensContainerEl.scrollHeight;

            if (isFechada) {
                formResposta.style.display = 'none';
                btnEncerrarConversa.style.display = 'none';
            } else {
                formResposta.style.display = 'flex';
                // Mostra o botão de encerrar se o usuário for admin
                btnEncerrarConversa.style.display = currentUser.role === 'admin' ? 'block' : 'none';
            }
            
            await carregarListaConversas();
        } catch (error) {
            // Erro já tratado pelo toast do apiFetch
            mensagensContainerEl.innerHTML = `<p class="text-danger">Erro ao carregar mensagens.</p>`;
        }
    }

    async function enviarResposta(e) {
        e.preventDefault();
        const conteudo = inputResposta.value.trim();
        if (!conteudo || !activeConversaId) return;

        btnEnviarResposta.disabled = true;
        try {
            await apiFetch(`/comunicacao/conversas/${activeConversaId}/responder`, { // Usa apiFetch global
                method: 'POST',
                body: JSON.stringify({ conteudo: conteudo })
            });
            inputResposta.value = '';
            await carregarDetalhesConversa(activeConversaId);
        } catch (error) {
            // Erro já tratado pelo toast do apiFetch
            showToast(`Erro ao enviar resposta: ${error.message}`, true); // Mostra o erro
        } finally {
            btnEnviarResposta.disabled = false;
        }
    }

    async function criarNovaConversa() {
        const assunto = document.getElementById('input-assunto').value.trim();
        const primeira_mensagem = document.getElementById('input-primeira-mensagem').value.trim();
        const erroDiv = document.getElementById('modal-conversa-erro');
        if (!assunto || !primeira_mensagem) {
            erroDiv.textContent = 'Assunto e mensagem são obrigatórios.';
            erroDiv.classList.remove('d-none');
            return;
        }
        erroDiv.classList.add('d-none');

        try {
            await apiFetch('/comunicacao/nova', { // Usa apiFetch global
                method: 'POST',
                body: JSON.stringify({ assunto, primeira_mensagem })
            });
            novaConversaModal.hide();
            document.getElementById('form-nova-conversa').reset();
            showToast('Conversa iniciada com sucesso!');
            await carregarListaConversas();
        } catch(error) {
            // Erro já tratado pelo toast do apiFetch
            erroDiv.textContent = error.message;
            erroDiv.classList.remove('d-none');
        }
    }

    btnEncerrarConversa.addEventListener('click', () => {
        if (activeConversaId) {
            confirmarEncerramentoModal.show();
        }
    });

    btnConfirmarEncerramento.addEventListener('click', async () => {
        if (!activeConversaId) return;

        try {
            await apiFetch(`/comunicacao/conversas/${activeConversaId}/encerrar`, { method: 'POST' }); // Usa apiFetch global
            confirmarEncerramentoModal.hide();
            showToast('Conversa encerrada.');
            await carregarDetalhesConversa(activeConversaId);
            await carregarListaConversas();
        } catch (error) {
            // Erro já tratado pelo toast do apiFetch
            showToast(`Erro ao encerrar conversa: ${error.message}`, true);
        }
    });

    async function init() {
        // Pega o usuário do estado global (definido em nav.js)
        currentUser = window.appState.currentUser;
        if (!currentUser) {
            currentUser = await apiFetch('/users/me'); // Fallback
            window.appState.currentUser = currentUser;
        }
        
        if (currentUser.role === 'admin') {
            filtroContainer.style.display = 'block';
        } else {
            btnNovaConversa.style.display = 'block';
        }
        
        await carregarListaConversas();

        listaConversasEl.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link) {
                e.preventDefault();
                const id = parseInt(link.dataset.id);
                document.querySelectorAll('#lista-conversas a').forEach(a => a.classList.remove('active'));
                link.classList.add('active');
                carregarDetalhesConversa(id);
            }
        });
        
        formResposta.addEventListener('submit', enviarResposta);
        btnSalvarConversa.addEventListener('click', criarNovaConversa);
        filtroFechadas.addEventListener('change', carregarListaConversas);
    }

    init();
});
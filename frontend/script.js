// FILE: frontend/script.js
// (Versão REFATORADA)

document.addEventListener('DOMContentLoaded', () => {
    // Funções utilitárias (apiFetch, showToast) foram movidas para utils.js

    // --- ELEMENTOS DO DOM ---
    const elements = {
        painelAvisoEstoque: document.getElementById('painel-aviso-estoque'),
        notificacaoAuditoria: document.getElementById('notificacao-auditoria'),
        notificacaoMensagens: document.getElementById('notificacao-mensagens'),
        painelNotificacoes: document.getElementById('painel-notificacoes'),
    };

    // --- LÓGICA DA PÁGINA ---
    async function verificarStatusEstoque() {
        try {
            const cacheBuster = `?_=${new Date().getTime()}`;
            // Usa o apiFetch global de utils.js
            const data = await apiFetch(`/configuracao/ultima_atualizacao_estoque${cacheBuster}`);
            if (data === null) { return; }; // Sai se a resposta for vazia
            
            let avisoHtml = '';
            let statusOk = false;
            
            if (data === "Nunca") { statusOk = false; } else {
                const [dataParte, horaParte] = data.split(' às ');
                const [dia, mes, ano] = dataParte.split('/');
                const [hora, minuto] = horaParte.split(':');
                const ultimaAtt = new Date(`${ano}-${mes}-${dia}T${hora}:${minuto}:00`);
                const agora = new Date();
                const diferencaMinutos = (agora - ultimaAtt) / 1000 / 60;
                if (diferencaMinutos <= 30 && agora.getDate() === ultimaAtt.getDate()) { statusOk = true; }
            }
            
            if (statusOk) {
                avisoHtml = `<div class="card-body text-center d-flex flex-column justify-content-center align-items-center text-success"><i class="bi bi-check-circle-fill" style="font-size: 4rem;"></i><h4 class="mt-3">Estoque Atualizado!</h4><p class="lead">A última atualização foi em <strong>${data}</strong>.</p><p>Você já pode iniciar uma nova auditoria com dados consistentes.</p><a href="/auditorias.html" class="btn btn-primary btn-lg mt-3"><i class="bi bi-card-checklist me-2"></i> Ir para Auditorias</a></div>`;
            } else {
                avisoHtml = `<div class="card-body text-center d-flex flex-column justify-content-center align-items-center text-danger"><i class="bi bi-exclamation-triangle-fill" style="font-size: 4rem;"></i><h4 class="mt-3">Atenção: Estoque Desatualizado!</h4><p class="lead">A última atualização do estoque foi em <strong>${data}</strong>.</p><p>Para garantir a precisão da sua auditoria, é necessário atualizar o estoque. O sistema não permitirá a criação de novas auditorias até que isso seja feito.</p><a href="/atualizar-estoque.html" class="btn btn-atualizar-estoque btn-lg mt-3"><i class="bi bi-upload me-2"></i> Atualizar Estoque Agora</a></div>`;
            }
            elements.painelAvisoEstoque.innerHTML = avisoHtml;
        
        } catch (error) {
            // Erros de API já são tratados pelo apiFetch global (mostra toast)
            // Apenas definimos um estado de erro no painel
            elements.painelAvisoEstoque.innerHTML = `<div class="card-body text-center d-flex flex-column justify-content-center align-items-center text-danger"><i class="bi bi-wifi-off" style="font-size: 4rem;"></i><h4 class="mt-3">Erro de Conexão</h4><p>Não foi possível verificar o status do estoque.</p></div>`;
        }
    }

    async function carregarNotificacoes() {
        try {
            const cacheBuster = `?_=${new Date().getTime()}`;
            
            // Carrega última auditoria
            const ultimaAuditoria = await apiFetch(`/auditorias/ultima-finalizada${cacheBuster}`);
            if (ultimaAuditoria) {
                let diferencasHtml = ultimaAuditoria.diferencas.length > 0
                    ? '<ul class="list-unstyled mb-0">' + ultimaAuditoria.diferencas.map(d => `<li>${d.categoria_nome}: <strong class="${d.diferenca > 0 ? 'text-primary' : 'text-danger'}">${d.diferenca > 0 ? '+' : ''}${d.diferenca}</strong></li>`).join('') + '</ul>'
                    : '<p class="text-success mb-0">Nenhuma diferença encontrada.</p>';
                elements.notificacaoAuditoria.innerHTML = `<div class="alert alert-secondary"><strong>${ultimaAuditoria.codigo_referencia}</strong> (${ultimaAuditoria.entidade_nome})<br><small>Finalizada em: ${new Date(ultimaAuditoria.data_fim).toLocaleDateString('pt-BR')}</small>${diferencasHtml}</div>`;
            } else {
                elements.notificacaoAuditoria.innerHTML = '<p class="text-muted">Nenhuma auditoria finalizada encontrada.</p>';
            }
            
            // Carrega mensagens recentes
            const mensagens = await apiFetch(`/comunicacao/mensagens/recentes${cacheBuster}`);
            if (mensagens && mensagens.length > 0) {
                elements.notificacaoMensagens.innerHTML = '<div class="list-group">' + mensagens.map(msg => `<a href="/comunicacoes.html" class="list-group-item list-group-item-action"><div class="d-flex w-100 justify-content-between"><h6 class="mb-1 text-truncate">${msg.assunto}</h6><span class="badge bg-danger rounded-pill">${msg.mensagens_nao_lidas}</span></div><small class="text-muted">De: ${msg.entidade.nome.toUpperCase()}</small></a>`).join('') + '</div>';
            } else {
                elements.notificacaoMensagens.innerHTML = '<p class="text-muted">Nenhuma mensagem nova.</p>';
            }
        } catch (error) {
            // Erros de API já são tratados pelo apiFetch global
            elements.notificacaoAuditoria.innerHTML = '<p class="text-danger">Erro ao carregar auditorias.</p>';
            elements.notificacaoMensagens.innerHTML = '<p class="text-danger">Erro ao carregar mensagens.</p>';
        }
    }
    
    async function atualizarDashboard() {
        if (!elements.painelNotificacoes) return; // Sai se os elementos não existirem
        
        elements.painelNotificacoes.classList.remove('elemento-atualizado');
        void elements.painelNotificacoes.offsetWidth;
        
        await verificarStatusEstoque();
        await carregarNotificacoes();
        
        elements.painelNotificacoes.classList.add('elemento-atualizado');
    }

    function init() {
        atualizarDashboard();
        setInterval(atualizarDashboard, 30000); // 30 segundos
    }

    init();
});
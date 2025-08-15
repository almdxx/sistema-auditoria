// FILE: script.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- OBJETO CENTRAL DE SELETORES DE ELEMENTOS ---
    const elements = {
        formNovaAuditoriaEscopo: document.getElementById('form-nova-auditoria-escopo'),
        inputAuditoriaResponsavel: document.getElementById('auditoria-responsavel'),
        selectAuditoriaEntidade: document.getElementById('auditoria-entidade-select'),
        adminEntidadeCriarContainer: document.getElementById('admin-entidade-criar-container'),
        adminEntidadeImportarContainer: document.getElementById('admin-entidade-importar-container'),
        containerCategoriasCheckbox: document.getElementById('container-categorias-checkbox'),
        checkSelecionarTodas: document.getElementById('selecionar-todas-categorias'),
        selectAuditoriaAtiva: document.getElementById('auditoria-ativa-select'),
        formImportarGeral: document.getElementById('form-importar-geral'),
        selectImportarEntidade: document.getElementById('importar-entidade-select'),
        inputPlanilhaGeral: document.getElementById('input-planilha-geral'),
        dataUltimaAtualizacaoEl: document.getElementById('data-ultima-atualizacao'),
        painelAuditoriaAtiva: document.getElementById('painel-auditoria-ativa'),
        painelTitulo: document.getElementById('painel-titulo'),
        painelDataInicio: document.getElementById('painel-data-inicio'),
        painelDataFim: document.getElementById('painel-data-fim'),
        tabelaContagemManualBody: document.getElementById('tabela-contagem-manual'),
        placeholderDetalhe: document.getElementById('placeholder-detalhe'),
        formContagemManual: document.getElementById('form-contagem-manual'),
        userInfoEl: document.getElementById('user-info'),
        logoutButton: document.getElementById('logout-button'),
        toastContainer: document.querySelector('.toast-container'),
        dashboardContainer: document.getElementById('dashboard-container'),
        graficoCanvas: document.getElementById('grafico-resumo-auditoria'),
        centralNotificacoes: document.getElementById('central-notificacoes'),
        confirmacaoModal: document.getElementById('confirmacaoModal'),
        confirmacaoModalLabel: document.getElementById('confirmacaoModalLabel'),
        confirmacaoModalBody: document.getElementById('confirmacaoModalBody'),
        confirmacaoModalBtnConfirmar: document.getElementById('confirmacaoModalBtnConfirmar'),
        confirmacaoModalBtnCancelar: document.getElementById('confirmacaoModalBtnCancelar'),
        linkRelatorioGeral: document.getElementById('link-relatorio-geral'),
        btnExportarGrafico: document.getElementById('btn-exportar-grafico'),
        dashboardTitulo: document.getElementById('dashboard-titulo'),
        adminDashboardFiltroContainer: document.getElementById('admin-dashboard-filtro-container'),
        dashboardEntidadeSelect: document.getElementById('dashboard-entidade-select'),
        graficoPlaceholder: document.getElementById('grafico-placeholder'),
        // Botões
        btnCriarAuditoria: document.getElementById('btn-criar-auditoria'),
        btnImportarEstoque: document.getElementById('btn-importar-estoque'),
        btnSalvarContagens: document.getElementById('btn-salvar-contagens'),
        btnExportarExcel: document.getElementById('btn-exportar-excel'),
        btnFinalizarAuditoria: document.getElementById('btn-finalizar-auditoria'),
        statusAuditoriaFinalizada: document.getElementById('status-auditoria-finalizada'),
    };

    // --- VARIÁVEIS DE ESTADO GLOBAL ---
    let auditoriasDisponiveis = [];
    let auditoriaAtivaId = null;
    let currentUser = null;
    let graficoResumo = null;
    let confirmacaoCallback = null;

    // --- FUNÇÕES UTILITÁRIAS ---
    function showToast(message, type = 'success') {
        const toastId = `toast-${Date.now()}`;
        const toastColor = type === 'success' ? 'bg-success' : 'bg-danger';
        const toastHtml = `
            <div id="${toastId}" class="toast align-items-center text-white ${toastColor} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">${message}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>`;
        elements.toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        const toastEl = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    }

    function toggleButtonLoading(button, isLoading, originalText = '') {
        if (!button) return;
        if (isLoading) {
            button.disabled = true;
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processando...`;
        } else {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || originalText;
        }
    }

    function exibirConfirmacaoModal({ titulo, corpo, textoBotaoConfirmar = 'Confirmar', textoBotaoCancelar = 'Cancelar', onConfirm }) {
        elements.confirmacaoModalLabel.innerHTML = titulo;
        elements.confirmacaoModalBody.innerHTML = corpo;
        elements.confirmacaoModalBtnConfirmar.textContent = textoBotaoConfirmar;
        elements.confirmacaoModalBtnCancelar.textContent = textoBotaoCancelar;
        elements.confirmacaoModalBtnCancelar.style.display = textoBotaoCancelar ? 'inline-block' : 'none';
        confirmacaoCallback = onConfirm;
        const modal = new bootstrap.Modal(elements.confirmacaoModal);
        modal.show();
    }

    // --- FUNÇÃO PRINCIPAL DE API ---
    async function apiFetch(url, options = {}, isFile = false) {
        const token = localStorage.getItem('accessToken');
        if (!token) { window.location.href = '/login'; return; }
        const headers = { 'Authorization': `Bearer ${token}`, ...options.headers };
        if (!(options.body instanceof FormData)) { headers['Content-Type'] = 'application/json'; }
        try {
            const response = await fetch(url, { ...options, headers });
            if (response.status === 401) {
                localStorage.removeItem('accessToken');
                window.location.href = '/login';
                throw new Error('Sessão expirada. Por favor, faça login novamente.');
            }
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(errorData.detail || `Erro (Status: ${response.status})`);
            }
            if (isFile) return response;
            return response.status === 204 ? null : await response.json();
        } catch (error) {
            console.error('Erro na API:', error);
            showToast(error.message, 'danger');
            throw error;
        }
    }
    
    // --- FUNÇÕES DO DASHBOARD E ATUALIZAÇÃO ---
    async function carregarUltimaAtualizacao() {
        try {
            elements.dataUltimaAtualizacaoEl.textContent = 'Carregando...';
            const data = await apiFetch('/configuracao/ultima_atualizacao_estoque');
            elements.dataUltimaAtualizacaoEl.textContent = data;
            return data;
        } catch (e) {
            elements.dataUltimaAtualizacaoEl.textContent = "Erro ao carregar";
            return "Erro ao carregar";
        }
    }

    function renderizarGraficoConsolidado(dados, entidadeNome = '') {
        if (!elements.graficoCanvas) return;
        elements.dashboardTitulo.textContent = `Resumo Consolidado ${entidadeNome}`;
        if (graficoResumo) {
            graficoResumo.destroy();
            graficoResumo = null;
        }
        if (!dados || dados.length === 0) {
            elements.graficoCanvas.style.display = 'none';
            if (elements.graficoPlaceholder) elements.graficoPlaceholder.classList.remove('d-none');
            return;
        }
        elements.graficoCanvas.style.display = 'block';
        if (elements.graficoPlaceholder) elements.graficoPlaceholder.classList.add('d-none');
        const ctx = elements.graficoCanvas.getContext('2d');
        const labels = dados.map(item => item.categoria_nome);
        const dataDiferencas = dados.map(item => item.diferenca_total);
        const fullData = dados;
        const bodyColor = getComputedStyle(document.documentElement).getPropertyValue('--bs-body-color');
        graficoResumo = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Diferença Consolidada',
                    data: dataDiferencas,
                    backgroundColor: context => context.dataset.data[context.dataIndex] >= 0 ? 'rgba(54, 162, 235, 0.7)' : 'rgba(255, 99, 132, 0.7)',
                    borderColor: context => context.dataset.data[context.dataIndex] >= 0 ? 'rgba(54, 162, 235, 1)' : 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                indexAxis: 'y',
                scales: { y: { ticks: { color: bodyColor }, grid: { color: 'rgba(128, 128, 128, 0.2)' } }, x: { ticks: { color: bodyColor }, grid: { color: 'rgba(128, 128, 128, 0.2)' } } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const item = fullData[context.dataIndex];
                                return [`Sistema: ${item.total_sistema}`, `Contado: ${item.total_contada}`, `Diferença: ${item.diferenca_total > 0 ? '+' : ''}${item.diferenca_total}`];
                            }
                        }
                    }
                }
            }
        });
    }

    function atualizarCentralNotificacoes(detalhesUltimaAuditoria, ultimaAtualizacao) {
        if (!elements.centralNotificacoes) return;
        let notificacoesHtml = '<ul>';
        if (detalhesUltimaAuditoria) {
            if (detalhesUltimaAuditoria.data_fim) {
                notificacoesHtml += `<li><i class="bi bi-check-circle-fill text-success"></i><span>Auditoria <strong>${detalhesUltimaAuditoria.codigo_referencia}</strong> foi finalizada com sucesso.</span></li>`;
            } else {
                notificacoesHtml += `<li><i class="bi bi-exclamation-triangle-fill text-warning"></i><span>Atenção: Auditoria <strong>${detalhesUltimaAuditoria.codigo_referencia}</strong> está em andamento.</span></li>`;
            }
        } else {
            notificacoesHtml += `<li><i class="bi bi-info-circle-fill text-info"></i><span>Nenhuma auditoria encontrada. Crie uma para começar.</span></li>`;
        }
        if (ultimaAtualizacao && ultimaAtualizacao !== "Nunca atualizado" && ultimaAtualizacao !== "Erro ao carregar") {
            notificacoesHtml += `<li><i class="bi bi-box-seam-fill text-primary"></i><span>O estoque foi atualizado pela última vez em <strong>${ultimaAtualizacao}</strong>.</span></li>`;
        }
        notificacoesHtml += '</ul>';
        elements.centralNotificacoes.innerHTML = notificacoesHtml;
    }

    function exportarGrafico() {
        if (!graficoResumo) {
            showToast("Não há gráfico para exportar.", "danger");
            return;
        }
        const link = document.createElement('a');
        link.href = graficoResumo.toDataURL('image/png', 1.0);
        link.download = 'resumo_consolidado.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Gráfico exportado com sucesso!");
    }

    // --- FUNÇÕES DE CARREGAMENTO INICIAL ---
    async function fetchCurrentUser() {
        try {
            currentUser = await apiFetch('/users/me');
            if (elements.userInfoEl) elements.userInfoEl.textContent = `Olá, ${currentUser.username}`;
            const isAdmin = currentUser.username === 'admin';
            if (elements.adminEntidadeCriarContainer) elements.adminEntidadeCriarContainer.classList.toggle('d-none', !isAdmin);
            if (elements.adminEntidadeImportarContainer) elements.adminEntidadeImportarContainer.classList.toggle('d-none', !isAdmin);
            if (elements.linkRelatorioGeral) elements.linkRelatorioGeral.classList.toggle('d-none', !isAdmin);
            if (elements.adminDashboardFiltroContainer) elements.adminDashboardFiltroContainer.classList.toggle('d-none', !isAdmin);
        } catch (error) { }
    }

    async function carregarEntidades() {
        try {
            const entidades = await apiFetch('/entidades/');
            const options = entidades.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
            if (elements.selectAuditoriaEntidade) elements.selectAuditoriaEntidade.innerHTML = `<option value="">Selecione...</option>${options}`;
            if (elements.selectImportarEntidade) elements.selectImportarEntidade.innerHTML = `<option value="">Selecione...</option>${options}`;
            if (elements.dashboardEntidadeSelect) {
                elements.dashboardEntidadeSelect.innerHTML = `<option value="">Todas as Entidades</option>${options}`;
            }
        } catch (error) {
            const errorHtml = '<option value="">Erro ao carregar</option>';
            if (elements.selectAuditoriaEntidade) elements.selectAuditoriaEntidade.innerHTML = errorHtml;
            if (elements.selectImportarEntidade) elements.selectImportarEntidade.innerHTML = errorHtml;
            if (elements.dashboardEntidadeSelect) elements.dashboardEntidadeSelect.innerHTML = errorHtml;
        }
    }

    async function carregarCategoriasParaFormulario() {
        try {
            if (!elements.containerCategoriasCheckbox) return;
            elements.containerCategoriasCheckbox.innerHTML = '<p class="text-muted">Carregando...</p>';
            const categorias = await apiFetch('/categorias/importadas/');
            if (categorias.length === 0) {
                elements.containerCategoriasCheckbox.innerHTML = '<p class="text-info">Nenhuma categoria encontrada. Use a aba "Atualizar Estoque Geral".</p>';
                elements.checkSelecionarTodas.disabled = true;
            } else {
                const checkboxesHtml = categorias.map(cat => `<div class="form-check"><input class="form-check-input categoria-checkbox" type="checkbox" value="${cat}" id="cat-${cat.replace(/\s+/g, '')}"><label class="form-check-label" for="cat-${cat.replace(/\s+/g, '')}">${cat}</label></div>`).join('');
                elements.containerCategoriasCheckbox.innerHTML = checkboxesHtml;
                elements.checkSelecionarTodas.disabled = false;
            }
        } catch (error) { }
    }

    async function carregarAuditoriasAtivas() {
        try {
            auditoriasDisponiveis = await apiFetch('/auditorias/');
            const valorAnterior = elements.selectAuditoriaAtiva.value;
            elements.selectAuditoriaAtiva.innerHTML = '';
            if (auditoriasDisponiveis.length === 0) {
                elements.selectAuditoriaAtiva.innerHTML = '<option value="">Crie uma auditoria para começar</option>';
            } else {
                elements.selectAuditoriaAtiva.innerHTML = '<option value="">Selecione uma auditoria...</option>';
                auditoriasDisponiveis.forEach(auditoria => {
                    const option = document.createElement('option');
                    option.value = auditoria.id;
                    option.textContent = `${auditoria.codigo_referencia}: ${auditoria.nome}`;
                    elements.selectAuditoriaAtiva.appendChild(option);
                });
            }
            elements.selectAuditoriaAtiva.value = valorAnterior;
        } catch (error) { }
    }
    
    // --- LÓGICA DE CRIAÇÃO E IMPORTAÇÃO ---
    function alternarTodasCategorias() {
        const checkboxes = elements.containerCategoriasCheckbox.querySelectorAll('.categoria-checkbox');
        checkboxes.forEach(checkbox => checkbox.checked = elements.checkSelecionarTodas.checked);
    }

    async function salvarNovaAuditoriaComEscopo(event) {
        event.preventDefault();
        const responsavel = elements.inputAuditoriaResponsavel.value.trim();
        const categoriasSelecionadas = Array.from(elements.containerCategoriasCheckbox.querySelectorAll('input:checked')).map(cb => cb.value);
        const payload = { responsavel, categorias_escopo: categoriasSelecionadas };
        if (currentUser.username === 'admin') {
            const entidadeId = elements.selectAuditoriaEntidade.value;
            if (!entidadeId) { return showToast('Admin, por favor selecione uma entidade.', 'danger'); }
            payload.entidade_id = parseInt(entidadeId);
        }
        if (!payload.responsavel || categoriasSelecionadas.length === 0) {
            return showToast('Responsável e pelo menos uma Categoria são obrigatórios.', 'danger');
        }
        toggleButtonLoading(elements.btnCriarAuditoria, true);
        try {
            const novaAuditoria = await apiFetch('/auditorias/nova_com_escopo/', { method: 'POST', body: JSON.stringify(payload) });
            showToast(`Auditoria "${novaAuditoria.codigo_referencia}" criada com sucesso!`);
            elements.formNovaAuditoriaEscopo.reset();
            await carregarAuditoriasAtivas();
            await atualizarPaineisDeInfo();
            elements.selectAuditoriaAtiva.value = novaAuditoria.id;
            await exibirPainelAuditoria(novaAuditoria.id);
        } catch (error) {
        } finally {
            toggleButtonLoading(elements.btnCriarAuditoria, false);
        }
    }

    async function importarEstoqueGeral(event) {
        event.preventDefault();
        let entidadeId = null;
        if (currentUser.username === 'admin') {
            entidadeId = elements.selectImportarEntidade.value;
            if (!entidadeId) { return showToast('Admin, por favor selecione uma entidade para a importação.', 'danger'); }
        }
        const arquivo = elements.inputPlanilhaGeral.files[0];
        if (!arquivo) { return showToast('Por favor, selecione um arquivo.', 'danger'); }
        const formData = new FormData();
        formData.append('file', arquivo);
        if (entidadeId) { formData.append('entidade_id', entidadeId); }
        
        toggleButtonLoading(elements.btnImportarEstoque, true);
        try {
            const resultado = await apiFetch('/produtos/importar_geral', { method: 'POST', body: formData });
            showToast(resultado.mensagem);
            elements.formImportarGeral.reset();
            await atualizarPaineisDeInfo();
            await carregarCategoriasParaFormulario();
        } catch (error) {
        } finally {
            toggleButtonLoading(elements.btnImportarEstoque, false);
        }
    }

    // --- LÓGICA DO PAINEL DA AUDITORIA ATIVA ---
    function handleContagemInput(event) {
        const input = event.target;
        if (!input.matches('input[type="number"]')) return;
        const row = input.closest('tr');
        const qtdSistema = parseInt(row.dataset.qtdSistema, 10);
        const qtdContada = parseInt(input.value, 10) || 0;
        const diferenca = qtdContada - qtdSistema;
        const diferencaCell = row.querySelector('.diferenca-cell');
        const avisoRecontagem = row.querySelector('.recontagem-aviso');
        diferencaCell.textContent = diferenca;
        row.classList.remove('diferenca-negativa', 'diferenca-positiva', 'diferenca-zero');
        if (diferenca < 0) {
            row.classList.add('diferenca-negativa');
            diferencaCell.innerHTML = `<i class="bi bi-exclamation-triangle-fill text-danger diferenca-icone"></i> ${diferenca}`;
            avisoRecontagem.classList.remove('d-none');
        } else if (diferenca > 0) {
            row.classList.add('diferenca-positiva');
            diferencaCell.innerHTML = `<i class="bi bi-plus-circle-fill text-primary diferenca-icone"></i> +${diferenca}`;
            avisoRecontagem.classList.remove('d-none');
        } else {
            row.classList.add('diferenca-zero');
            diferencaCell.innerHTML = `<i class="bi bi-check-circle-fill text-success diferenca-icone"></i> ${diferenca}`;
            avisoRecontagem.classList.add('d-none');
        }
    }

    async function exibirPainelAuditoria(id) {
        auditoriaAtivaId = id;
        if (!auditoriaAtivaId) {
            document.body.classList.remove('modo-detalhes');
            return;
        }
        try {
            const detalhes = await apiFetch(`/auditorias/${auditoriaAtivaId}`);
            elements.painelTitulo.textContent = `${detalhes.codigo_referencia}: ${detalhes.nome}`;
            const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
            elements.painelDataInicio.textContent = new Date(detalhes.data_inicio).toLocaleString('pt-BR', options);
            const isFinalizada = !!detalhes.data_fim;
            elements.statusAuditoriaFinalizada.classList.toggle('d-none', !isFinalizada);
            if (isFinalizada) {
                elements.painelDataFim.textContent = new Date(detalhes.data_fim).toLocaleString('pt-BR', options);
            } else {
                elements.painelDataFim.textContent = "Em andamento";
            }
            if (elements.btnFinalizarAuditoria) elements.btnFinalizarAuditoria.disabled = isFinalizada;
            if (elements.btnSalvarContagens) elements.btnSalvarContagens.disabled = isFinalizada;
            elements.tabelaContagemManualBody.innerHTML = '';
            if (detalhes.escopo.length > 0) {
                detalhes.escopo.forEach(item => {
                    const row = document.createElement('tr');
                    const diferenca = item.qtd_contada - item.qtd_sistema;
                    let diferencaClasse = '';
                    let diferencaHtml = `${diferenca}`;
                    if (diferenca < 0) { diferencaClasse = 'diferenca-negativa'; diferencaHtml = `<i class="bi bi-exclamation-triangle-fill text-danger diferenca-icone"></i> ${diferenca}`; } 
                    else if (diferenca > 0) { diferencaClasse = 'diferenca-positiva'; diferencaHtml = `<i class="bi bi-plus-circle-fill text-primary diferenca-icone"></i> +${diferenca}`; }
                    else if (item.data_contagem) { diferencaClasse = 'diferenca-zero'; diferencaHtml = `<i class="bi bi-check-circle-fill text-success diferenca-icone"></i> ${diferenca}`; }
                    row.className = diferencaClasse;
                    row.dataset.categoria = item.categoria_nome;
                    row.dataset.qtdSistema = item.qtd_sistema;
                    const disabledAttr = isFinalizada ? 'disabled' : '';
                    row.innerHTML = `
                        <td>${item.categoria_nome}</td>
                        <td>${item.qtd_sistema}</td>
                        <td class="contagem-cell">
                            <input type="number" class="form-control form-control-sm" value="${item.qtd_contada || ''}" placeholder="0" ${disabledAttr}>
                            <span class="recontagem-aviso ${diferenca !== 0 && item.data_contagem ? '' : 'd-none'}"><i class="bi bi-arrow-repeat"></i> Recontar</span>
                        </td>
                        <td class="diferenca-cell">${diferencaHtml}</td>
                    `;
                    elements.tabelaContagemManualBody.appendChild(row);
                });
            } else {
                elements.tabelaContagemManualBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Nenhuma categoria no escopo.</td></tr>';
            }
            document.body.classList.add('modo-detalhes');
        } catch (error) {
            console.error("Falha ao buscar detalhes da auditoria:", error);
            document.body.classList.remove('modo-detalhes');
        }
    }

    async function executarSalvamento() {
        if (!auditoriaAtivaId) return showToast("Nenhuma auditoria selecionada.", 'danger');
        const contagens = Array.from(elements.tabelaContagemManualBody.querySelectorAll('tr')).map(row => ({
            categoria_nome: row.dataset.categoria,
            qtd_contada: parseInt(row.querySelector('input[type="number"]').value) || 0
        }));
        toggleButtonLoading(elements.btnSalvarContagens, true);
        try {
            await apiFetch(`/auditorias/${auditoriaAtivaId}/contagem_manual`, { method: 'POST', body: JSON.stringify({ contagens }) });
            showToast('Contagens manuais salvas com sucesso!');
            await exibirPainelAuditoria(auditoriaAtivaId);
            await atualizarPaineisDeInfo();
        } catch (error) {
        } finally {
            toggleButtonLoading(elements.btnSalvarContagens, false);
        }
    }

    async function salvarContagensManuais(event) {
        event.preventDefault();
        let existemDiferencas = false;
        const rows = elements.tabelaContagemManualBody.querySelectorAll('tr');
        for (const row of rows) {
            const diferencaCell = row.querySelector('.diferenca-cell');
            const diferenca = parseInt(diferencaCell.textContent.trim().replace('+', ''), 10);
            if (!isNaN(diferenca) && diferenca !== 0) {
                existemDiferencas = true;
                break;
            }
        }
        if (existemDiferencas) {
            exibirConfirmacaoModal({
                titulo: '<i class="bi bi-exclamation-triangle-fill text-warning"></i> Confirmação Necessária',
                corpo: 'Deseja realmente salvar a sua contagem? <strong>Sua auditoria contém diferenças!</strong>',
                textoBotaoConfirmar: 'Sim, desejo salvar',
                textoBotaoCancelar: 'Recontar',
                onConfirm: executarSalvamento
            });
        } else {
            await executarSalvamento();
        }
    }

    async function finalizarAuditoria() {
        if (!auditoriaAtivaId) return showToast("Nenhuma auditoria selecionada.", 'danger');
        exibirConfirmacaoModal({
            titulo: '<i class="bi bi-lock-fill"></i> Finalizar Auditoria',
            corpo: 'Tem certeza que deseja finalizar esta auditoria? Esta ação não pode ser desfeita e irá travar a edição.',
            textoBotaoConfirmar: 'Sim, finalizar',
            onConfirm: async () => {
                toggleButtonLoading(elements.btnFinalizarAuditoria, true);
                try {
                    await apiFetch(`/auditorias/${auditoriaAtivaId}/finalizar`, { method: 'POST' });
                    showToast("Auditoria finalizada com sucesso!");
                    await carregarAuditoriasAtivas();
                    await atualizarPaineisDeInfo();
                    await exibirPainelAuditoria(auditoriaAtivaId);
                } catch (error) {
                } finally {
                    toggleButtonLoading(elements.btnFinalizarAuditoria, false);
                }
            }
        });
    }

    async function exportarAuditoriaExcel() {
        if (!auditoriaAtivaId) return showToast("Nenhuma auditoria selecionada.", 'danger');
        toggleButtonLoading(elements.btnExportarExcel, true);
        try {
            const response = await apiFetch(`/auditorias/${auditoriaAtivaId}/exportar_excel`, {}, true);
            const blob = await response.blob();
            const auditoriaAtiva = auditoriasDisponiveis.find(a => a.id == auditoriaAtivaId);
            const nomeArquivo = `${auditoriaAtiva.codigo_referencia}.xlsx`;
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = nomeArquivo;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            exibirConfirmacaoModal({
                titulo: '<i class="bi bi-check-circle-fill text-success"></i> Exportação Concluída',
                corpo: `O arquivo <strong>${nomeArquivo}</strong> foi preparado para download.`,
                textoBotaoConfirmar: 'OK',
                textoBotaoCancelar: '',
                onConfirm: () => { }
            });
        } catch (error) {
            console.error("Falha no download da exportação:", error);
        } finally {
            toggleButtonLoading(elements.btnExportarExcel, false);
        }
    }

    function logout() {
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
    }

    // --- INICIALIZAÇÃO E EVENTOS ---
    function initEventListeners() {
        if (elements.checkSelecionarTodas) elements.checkSelecionarTodas.addEventListener('change', alternarTodasCategorias);
        if (elements.formNovaAuditoriaEscopo) elements.formNovaAuditoriaEscopo.addEventListener('submit', salvarNovaAuditoriaComEscopo);
        if (elements.selectAuditoriaAtiva) elements.selectAuditoriaAtiva.addEventListener('change', (event) => exibirPainelAuditoria(event.target.value));
        if (elements.formContagemManual) elements.formContagemManual.addEventListener('submit', salvarContagensManuais);
        if (elements.formImportarGeral) elements.formImportarGeral.addEventListener('submit', importarEstoqueGeral);
        if (elements.btnExportarExcel) elements.btnExportarExcel.addEventListener('click', exportarAuditoriaExcel);
        if (elements.btnFinalizarAuditoria) elements.btnFinalizarAuditoria.addEventListener('click', finalizarAuditoria);
        if (elements.logoutButton) elements.logoutButton.addEventListener('click', logout);
        if (elements.tabelaContagemManualBody) elements.tabelaContagemManualBody.addEventListener('input', handleContagemInput);
        if (elements.btnExportarGrafico) elements.btnExportarGrafico.addEventListener('click', exportarGrafico);
        if (elements.dashboardEntidadeSelect) {
            elements.dashboardEntidadeSelect.addEventListener('change', (event) => {
                const entidadeId = event.target.value;
                atualizarPaineisDeInfo(entidadeId || null);
            });
        }
        if (elements.confirmacaoModalBtnConfirmar) {
            elements.confirmacaoModalBtnConfirmar.addEventListener('click', () => {
                if (typeof confirmacaoCallback === 'function') {
                    confirmacaoCallback();
                }
                const modal = bootstrap.Modal.getInstance(elements.confirmacaoModal);
                if(modal) modal.hide();
            });
        }
    }

    // --- FUNÇÃO CENTRALIZADORA DE ATUALIZAÇÃO ---
    async function atualizarPaineisDeInfo(entidadeId = null) {
        if (currentUser.username !== 'admin') {
            entidadeId = currentUser.entidade_id;
        }
        let url = '/relatorios/diferencas_consolidadas';
        if (entidadeId) { url += `?entidade_id=${entidadeId}`; }
        
        try {
            const dadosConsolidados = await apiFetch(url);
            const select = elements.dashboardEntidadeSelect;
            let entidadeNome = '(Geral)';
            if (entidadeId && select) {
                const option = select.querySelector(`option[value="${entidadeId}"]`);
                if (option) { entidadeNome = `(${option.textContent})`; }
            }
            renderizarGraficoConsolidado(dadosConsolidados, entidadeNome);
        } catch (error) {
            console.error("Falha ao carregar dados do dashboard", error);
            renderizarGraficoConsolidado([], 'Erro ao carregar');
        }

        const ultimaAtualizacao = await carregarUltimaAtualizacao();
        
        if (auditoriasDisponiveis && auditoriasDisponiveis.length > 0) {
            const ultimaAuditoriaId = auditoriasDisponiveis[0].id;
            try {
                const detalhesUltimaAuditoria = await apiFetch(`/auditorias/${ultimaAuditoriaId}`);
                atualizarCentralNotificacoes(detalhesUltimaAuditoria, ultimaAtualizacao);
            } catch (e) {
                atualizarCentralNotificacoes(null, ultimaAtualizacao);
            }
        } else {
            atualizarCentralNotificacoes(null, ultimaAtualizacao);
        }
    }

    // --- CARREGAMENTO INICIAL DA PÁGINA ---
    async function init() {
        await fetchCurrentUser();
        if (currentUser) {
            initEventListeners();
            await carregarEntidades();
            await carregarCategoriasParaFormulario();
            await carregarAuditoriasAtivas();
            await atualizarPaineisDeInfo();
        }
    }

    init();
});
// FILE: script.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- SELETORES DE ELEMENTOS ---
    const formNovaAuditoriaEscopo = document.getElementById('form-nova-auditoria-escopo');
    const inputAuditoriaResponsavel = document.getElementById('auditoria-responsavel');
    const selectAuditoriaEntidade = document.getElementById('auditoria-entidade-select');
    const adminEntidadeContainer = document.getElementById('admin-entidade-container');
    const containerCategoriasCheckbox = document.getElementById('container-categorias-checkbox');
    const checkSelecionarTodas = document.getElementById('selecionar-todas-categorias');
    const selectAuditoriaAtiva = document.getElementById('auditoria-ativa-select');
    const formImportarGeral = document.getElementById('form-importar-geral');
    const selectImportarEntidade = document.getElementById('importar-entidade-select');
    const inputPlanilhaGeral = document.getElementById('input-planilha-geral');
    const dataUltimaAtualizacaoEl = document.getElementById('data-ultima-atualizacao');
    const painelAuditoriaAtiva = document.getElementById('painel-auditoria-ativa');
    const painelTitulo = document.getElementById('painel-titulo');
    const painelDataInicio = document.getElementById('painel-data-inicio');
    const painelDataFim = document.getElementById('painel-data-fim');
    const tabelaContagemManualBody = document.getElementById('tabela-contagem-manual');
    const placeholderDetalhe = document.getElementById('placeholder-detalhe');
    const formContagemManual = document.getElementById('form-contagem-manual');
    const btnSalvarContagens = document.getElementById('btn-salvar-contagens');
    const btnExportarExcel = document.getElementById('btn-exportar-excel');
    const btnFinalizarAuditoria = document.getElementById('btn-finalizar-auditoria');
    const statusAuditoriaFinalizada = document.getElementById('status-auditoria-finalizada');
    const userInfoEl = document.getElementById('user-info');
    const logoutButton = document.getElementById('logout-button');

    // --- VARIÁVEIS DE ESTADO GLOBAL ---
    let auditoriasDisponiveis = [];
    let auditoriaAtivaId = null;
    let currentUser = null;

    // --- FUNÇÃO PRINCIPAL DE API (COM AUTENTICAÇÃO) ---
    async function apiFetch(url, options = {}, isFile = false) {
        const token = localStorage.getItem('accessToken');
        if (!token) {
            window.location.href = '/login';
            return;
        }

        const headers = {
            'Authorization': `Bearer ${token}`,
            ...options.headers,
        };
        
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

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

            if (isFile) {
                return response;
            }
            return response.status === 204 ? null : await response.json();
        } catch (error) {
            console.error('Erro na API:', error);
            alert(`Erro: ${error.message}`);
            throw error;
        }
    }

    // --- FUNÇÕES DE CARREGAMENTO INICIAL ---
    async function fetchCurrentUser() {
        try {
            currentUser = await apiFetch('/users/me');
            if (userInfoEl) userInfoEl.textContent = `Olá, ${currentUser.username}`;
            if (adminEntidadeContainer) {
                if (currentUser.username === 'admin') {
                    adminEntidadeContainer.classList.remove('d-none');
                } else {
                    adminEntidadeContainer.classList.add('d-none');
                }
            }
        } catch (error) { /* apiFetch já lida com o redirecionamento */ }
    }

    async function carregarEntidades() {
        try {
            const entidades = await apiFetch('/entidades/');
            const options = entidades.map(e => `<option value="${e.id}" data-nome="${e.nome}">${e.nome}</option>`).join('');
            const innerHtml = `<option value="">Selecione...</option>${options}`;
            if(selectAuditoriaEntidade) selectAuditoriaEntidade.innerHTML = innerHtml;
            if(selectImportarEntidade) selectImportarEntidade.innerHTML = innerHtml;
        } catch (error) {
            const errorHtml = '<option value="">Erro ao carregar</option>';
            if(selectAuditoriaEntidade) selectAuditoriaEntidade.innerHTML = errorHtml;
            if(selectImportarEntidade) selectImportarEntidade.innerHTML = errorHtml;
        }
    }

    async function carregarCategoriasParaFormulario() {
        try {
            if(!containerCategoriasCheckbox) return;
            containerCategoriasCheckbox.innerHTML = '<p class="text-muted">Carregando...</p>';
            const categorias = await apiFetch('/categorias/importadas/');
            if (categorias.length === 0) {
                containerCategoriasCheckbox.innerHTML = '<p class="text-info">Nenhuma categoria encontrada. Use a aba "Atualizar Estoque Geral".</p>';
                checkSelecionarTodas.disabled = true;
            } else {
                const checkboxesHtml = categorias.map(cat => `<div class="form-check"><input class="form-check-input categoria-checkbox" type="checkbox" value="${cat}" id="cat-${cat.replace(/\s+/g, '')}"><label class="form-check-label" for="cat-${cat.replace(/\s+/g, '')}">${cat}</label></div>`).join('');
                containerCategoriasCheckbox.innerHTML = checkboxesHtml;
                checkSelecionarTodas.disabled = false;
            }
        } catch (error) {}
    }
    
    async function carregarAuditoriasAtivas() {
        try {
            auditoriasDisponiveis = await apiFetch('/auditorias/');
            const valorAnterior = selectAuditoriaAtiva.value;
            selectAuditoriaAtiva.innerHTML = '';
            if (auditoriasDisponiveis.length === 0) {
                selectAuditoriaAtiva.innerHTML = '<option value="">Crie uma auditoria para começar</option>';
            } else {
                selectAuditoriaAtiva.innerHTML = '<option value="">Selecione uma auditoria...</option>';
                auditoriasDisponiveis.forEach(auditoria => {
                    const option = document.createElement('option');
                    option.value = auditoria.id;
                    option.textContent = `${auditoria.codigo_referencia}: ${auditoria.nome}`;
                    selectAuditoriaAtiva.appendChild(option);
                });
            }
            selectAuditoriaAtiva.value = valorAnterior;
        } catch(error) {}
    }

    async function carregarUltimaAtualizacao() {
        try {
            dataUltimaAtualizacaoEl.textContent = 'Carregando...';
            const data = await apiFetch('/configuracao/ultima_atualizacao_estoque');
            dataUltimaAtualizacaoEl.textContent = data;
        } catch(e) {
            dataUltimaAtualizacaoEl.textContent = "Erro ao carregar";
        }
    }

    // --- LÓGICA DO FORMULÁRIO DE CRIAÇÃO ---
    function alternarTodasCategorias() {
        const checkboxes = containerCategoriasCheckbox.querySelectorAll('.categoria-checkbox');
        checkboxes.forEach(checkbox => checkbox.checked = checkSelecionarTodas.checked);
    }

    async function salvarNovaAuditoriaComEscopo(event) {
        event.preventDefault();
        const responsavel = inputAuditoriaResponsavel.value.trim();
        const categoriasSelecionadas = Array.from(containerCategoriasCheckbox.querySelectorAll('input:checked')).map(cb => cb.value);

        const entidadeId = (currentUser.username === 'admin') 
            ? selectAuditoriaEntidade.value 
            : currentUser.entidade_id;

        if (!responsavel || !entidadeId || categoriasSelecionadas.length === 0) {
            alert('Responsável, Entidade e pelo menos uma Categoria são obrigatórios.');
            return;
        }
        
        const payload = { entidade_id: parseInt(entidadeId), responsavel: responsavel, categorias_escopo: categoriasSelecionadas };
        
        try {
            const novaAuditoria = await apiFetch('/auditorias/nova_com_escopo/', { method: 'POST', body: JSON.stringify(payload) });
            alert(`Auditoria "${novaAuditoria.nome}" (Código: ${novaAuditoria.codigo_referencia}) criada com sucesso!`);
            formNovaAuditoriaEscopo.reset();
            await carregarAuditoriasAtivas();
            selectAuditoriaAtiva.value = novaAuditoria.id;
            selectAuditoriaAtiva.dispatchEvent(new Event('change'));
        } catch (error) {}
    }

    // --- LÓGICA DE IMPORTAÇÃO GERAL ---
    async function importarEstoqueGeral(event) {
        event.preventDefault();
        const entidadeId = selectImportarEntidade.value;
        const arquivo = inputPlanilhaGeral.files[0];
        if (!entidadeId || !arquivo) {
            alert('Selecione uma entidade e um arquivo para a importação geral.');
            return;
        }
        const formData = new FormData();
        formData.append('entidade_id', entidadeId);
        formData.append('file', arquivo);

        try {
            const resultado = await apiFetch('/produtos/importar_geral', { method: 'POST', body: formData });
            alert(resultado.mensagem);
            formImportarGeral.reset();
            await carregarCategoriasParaFormulario();
            await carregarUltimaAtualizacao();
        } catch (error) {}
    }

    // --- LÓGICA DO PAINEL DA AUDITORIA ATIVA ---
    async function exibirPainelAuditoria(event) {
        auditoriaAtivaId = event.target.value;
        if (!auditoriaAtivaId) {
            painelAuditoriaAtiva.classList.add('d-none');
            placeholderDetalhe.classList.remove('d-none');
            return;
        }
        try {
            const detalhes = await apiFetch(`/auditorias/${auditoriaAtivaId}`);
            painelTitulo.textContent = `${detalhes.codigo_referencia}: ${detalhes.nome}`;
            
            const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
            painelDataInicio.textContent = new Date(detalhes.data_inicio).toLocaleString('pt-BR', options);
            
            const isFinalizada = !!detalhes.data_fim;
            
            if (isFinalizada) {
                painelDataFim.textContent = new Date(detalhes.data_fim).toLocaleString('pt-BR', options);
                statusAuditoriaFinalizada.classList.remove('d-none');
            } else {
                painelDataFim.textContent = "Em andamento";
                statusAuditoriaFinalizada.classList.add('d-none');
            }
            
            btnFinalizarAuditoria.disabled = isFinalizada;
            btnSalvarContagens.disabled = isFinalizada;

            tabelaContagemManualBody.innerHTML = '';
            if (detalhes.escopo.length > 0) {
                detalhes.escopo.forEach(item => {
                    const row = document.createElement('tr');
                    row.dataset.categoria = item.categoria_nome;
                    const diferenca = item.qtd_contada - item.qtd_sistema;
                    const diferencaClasse = diferenca < 0 ? 'diferenca-negativa' : (diferenca > 0 ? 'diferenca-positiva' : '');
                    const disabledAttr = isFinalizada ? 'disabled' : '';
                    row.innerHTML = `
                        <td>${item.categoria_nome}</td>
                        <td>${item.qtd_sistema}</td>
                        <td><input type="number" class="form-control form-control-sm" value="${item.qtd_contada || ''}" placeholder="0" ${disabledAttr}></td>
                        <td class="${diferencaClasse}">${diferenca}</td>
                    `;
                    tabelaContagemManualBody.appendChild(row);
                });
            } else {
                tabelaContagemManualBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Nenhuma categoria no escopo.</td></tr>';
            }
            placeholderDetalhe.classList.add('d-none');
            painelAuditoriaAtiva.classList.remove('d-none');
        } catch(error) {}
    }

    async function salvarContagensManuais(event) {
        event.preventDefault();
        if (!auditoriaAtivaId) return alert("Nenhuma auditoria selecionada.");
        const contagens = [];
        const rows = tabelaContagemManualBody.querySelectorAll('tr');
        rows.forEach(row => {
            contagens.push({
                categoria_nome: row.dataset.categoria,
                qtd_contada: parseInt(row.querySelector('input[type="number"]').value) || 0
            });
        });
        try {
            await apiFetch(`/auditorias/${auditoriaAtivaId}/contagem_manual`, {
                method: 'POST',
                body: JSON.stringify({ contagens: contagens })
            });
            alert('Contagens manuais salvas com sucesso!');
            selectAuditoriaAtiva.dispatchEvent(new Event('change'));
        } catch (error) {}
    }

    async function finalizarAuditoria() {
        if (!auditoriaAtivaId) return alert("Nenhuma auditoria selecionada.");
        if (!confirm("Tem certeza que deseja finalizar esta auditoria? Esta ação não pode ser desfeita e irá travar a edição.")) return;
        try {
            await apiFetch(`/auditorias/${auditoriaAtivaId}/finalizar`, { method: 'POST' });
            alert("Auditoria finalizada com sucesso!");
            selectAuditoriaAtiva.dispatchEvent(new Event('change'));
        } catch (error) {}
    }

    async function exportarAuditoriaExcel() {
        if (!auditoriaAtivaId) {
            alert("Nenhuma auditoria selecionada.");
            return;
        }
        try {
            const response = await apiFetch(`/auditorias/${auditoriaAtivaId}/exportar_excel`, {}, true);
            const blob = await response.blob();
            const auditoriaAtiva = auditoriasDisponiveis.find(a => a.id == auditoriaAtivaId);
            const nomeArquivo = `${auditoriaAtiva.codigo_referencia}.xlsx`;
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.setAttribute("download", nomeArquivo);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error("Falha no download da exportação:", error);
        }
    }

    // --- LÓGICA DE LOGOUT ---
    function logout() {
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
    }

    // --- INICIALIZAÇÃO E EVENTOS ---
    if(checkSelecionarTodas) checkSelecionarTodas.addEventListener('change', alternarTodasCategorias);
    if(formNovaAuditoriaEscopo) formNovaAuditoriaEscopo.addEventListener('submit', salvarNovaAuditoriaComEscopo);
    if(selectAuditoriaAtiva) selectAuditoriaAtiva.addEventListener('change', exibirPainelAuditoria);
    if(formContagemManual) formContagemManual.addEventListener('submit', salvarContagensManuais);
    if(formImportarGeral) formImportarGeral.addEventListener('submit', importarEstoqueGeral);
    if(btnExportarExcel) btnExportarExcel.addEventListener('click', exportarAuditoriaExcel);
    if(btnFinalizarAuditoria) btnFinalizarAuditoria.addEventListener('click', finalizarAuditoria);
    if(logoutButton) logoutButton.addEventListener('click', logout);
    
    // --- CARREGAMENTO INICIAL DA PÁGINA ---
    async function init() {
        await fetchCurrentUser();
        if (currentUser) {
            carregarEntidades();
            carregarCategoriasParaFormulario();
            carregarAuditoriasAtivas();
            carregarUltimaAtualizacao();
        }
    }

    init();
});
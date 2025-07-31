document.addEventListener('DOMContentLoaded', () => {
    // Seletores
    const formImportar = document.getElementById('form-importar-estoque');
    const selectEntidadeImport = document.getElementById('entidade-select-importar');
    const inputArquivo = document.getElementById('input-planilha');
    const formCriarAuditoria = document.getElementById('form-nova-auditoria');
    const selectEntidadeCriar = document.getElementById('entidade-select-auditoria');
    const listaAuditorias = document.getElementById('lista-auditorias');
    const placeholderDetalhe = document.getElementById('placeholder-detalhe');
    const detalheContainer = document.getElementById('detalhe-auditoria-container');
    const detalheNome = document.getElementById('detalhe-auditoria-nome');
    const tabelaItensBody = document.getElementById('tabela-itens-auditoria');
    const formContagemCategoria = document.getElementById('form-contagem-categoria');
    const inputDataContagem = document.getElementById('contagem-data');
    const inputResponsavel = document.getElementById('contagem-responsavel');
    const selectEntidadeContagem = document.getElementById('contagem-entidade');
    const selectCategoriaContagem = document.getElementById('contagem-categoria');
    const inputQtdSistema = document.getElementById('contagem-qtd-sistema');
    const inputQtdContada = document.getElementById('contagem-qtd-contada');
    const formFiltrosContagem = document.getElementById('form-filtros-contagem');
    const filtroData = document.getElementById('filtro-data');
    const filtroCategoria = document.getElementById('filtro-categoria');
    const filtroEntidade = document.getElementById('filtro-entidade');
    const filtroResponsavel = document.getElementById('filtro-responsavel');
    const btnLimparFiltros = document.getElementById('btn-limpar-filtros');
    const tabelaRelatorioBody = document.getElementById('tabela-relatorio-contagem');

    // API Fetch
    async function apiFetch(url, options = {}) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(errorData.detail || `Erro (Status: ${response.status})`);
            }
            return response.status === 204 ? null : await response.json();
        } catch (error) { console.error('Erro na API:', error); throw error; }
    }

    // Funções
    async function carregarEntidades() {
        try {
            const entidades = await apiFetch('/entidades/');
            const options = entidades.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
            const innerHtml = `<option value="">Selecione...</option>${options}`;
            selectEntidadeImport.innerHTML = innerHtml;
            selectEntidadeCriar.innerHTML = innerHtml;
            selectEntidadeContagem.innerHTML = innerHtml;
            filtroEntidade.innerHTML = `<option value="">Todas</option>${options}`;
        } catch (error) { alert(`Erro ao carregar entidades: ${error.message}`); }
    }

    async function criarAuditoria(event) {
        event.preventDefault();
        const entidadeId = selectEntidadeCriar.value;
        if (!entidadeId) { alert('Selecione uma entidade.'); return; }
        const nomeEntidade = selectEntidadeCriar.options[selectEntidadeCriar.selectedIndex].text;
        const hoje = new Date();
        const nomeAuditoria = `Auditoria ${nomeEntidade} ${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        try {
            const novaAuditoria = await apiFetch('/auditorias/', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: nomeAuditoria, entidade_id: parseInt(entidadeId) }),
            });
            alert(`Auditoria "${novaAuditoria.nome}" criada.`);
            await carregarAuditorias();
            mostrarDetalhesAuditoria(novaAuditoria.id);
        } catch (error) { alert(`Erro ao criar auditoria: ${error.message}`); }
    }
    
    async function mostrarDetalhesAuditoria(auditoriaId) {
        try {
            const detalhes = await apiFetch(`/auditorias/${auditoriaId}`);
            placeholderDetalhe.classList.add('d-none');
            detalheContainer.classList.remove('d-none');
            detalheNome.textContent = `Detalhes de: ${detalhes.nome}`;
            tabelaItensBody.innerHTML = '';
            detalhes.itens.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${item.grupo || ''}</td><td>${item.nome_item}</td><td>${item.qtd_sistema}</td><td><input type="number" class="form-control form-control-sm" value="${item.qtd_fisica}" onchange="salvarContagem(this, ${auditoriaId}, ${item.produto_id})"></td><td><input type="number" class="form-control form-control-sm" value="${item.qtd_gerente || ''}" onchange="salvarContagem(this, ${auditoriaId}, ${item.produto_id})"></td><td id="diferenca-${item.produto_id}">${item.diferenca}</td>`;
                tabelaItensBody.appendChild(tr);
            });
        } catch (error) { alert(`Erro ao carregar detalhes: ${error.message}`); }
    }

    window.salvarContagem = async function(inputElement, auditoriaId, produtoId) {
        const linha = inputElement.closest('tr');
        const inputFisica = linha.querySelector('input[onchange*="qtd_fisica"]');
        const inputGerente = linha.querySelector('input[onchange*="qtd_gerente"]');
        const formData = new FormData();
        formData.append('produto_id', produtoId);
        formData.append('qtd_fisica', inputFisica.value || 0);
        if (inputGerente.value) formData.append('qtd_gerente', inputGerente.value);
        try {
            const resultado = await apiFetch(`/auditorias/${auditoriaId}/contagem`, { method: 'POST', body: formData });
            const celulaDiferenca = document.getElementById(`diferenca-${produtoId}`);
            celulaDiferenca.textContent = resultado.diferenca;
            celulaDiferenca.style.color = resultado.diferenca !== 0 ? '#ff5c5c' : 'inherit';
        } catch (error) { alert(`Erro ao salvar contagem: ${error.message}`); }
    };

    async function carregarAuditorias() {
        try {
            const auditorias = await apiFetch('/auditorias/');
            listaAuditorias.innerHTML = '';
            if (!auditorias.length) {
                listaAuditorias.innerHTML = '<li class="list-group-item">Nenhuma auditoria encontrada.</li>';
            } else {
                auditorias.forEach(auditoria => {
                    const item = document.createElement('li');
                    item.className = 'list-group-item list-group-item-action';
                    item.style.cursor = 'pointer';
                    item.textContent = `ID ${auditoria.id}: ${auditoria.nome} (${auditoria.entidade.nome})`;
                    item.onclick = () => mostrarDetalhesAuditoria(auditoria.id);
                    listaAuditorias.appendChild(item);
                });
            }
        } catch (error) { alert(`Erro ao carregar auditorias: ${error.message}`); }
    }

    async function importarPlanilha(event) {
        event.preventDefault();
        const entidadeId = selectEntidadeImport.value;
        const arquivo = inputArquivo.files[0];
        if (!entidadeId || !arquivo) { alert('Selecione uma entidade e um arquivo.'); return; }
        const formData = new FormData();
        formData.append('entidade_id', entidadeId);
        formData.append('file', arquivo);
        try {
            const resultado = await apiFetch('/produtos/importar', { method: 'POST', body: formData });
            alert(resultado.mensagem);
            preencherCategoriasDropdown();
            carregarRelatorioContagens();
        } catch (error) { alert(`Erro ao importar planilha: ${error.message}`); }
    }

    async function preencherCategoriasDropdown() {
        try {
            const categorias = await apiFetch('/categorias/');
            const options = categorias.map(c => `<option value="${c}">${c}</option>`).join('');
            selectCategoriaContagem.innerHTML = `<option value="">Selecione...</option>${options}`;
            filtroCategoria.innerHTML = `<option value="">Todas</option>${options}`;
        } catch (error) { alert(`Erro ao carregar categorias: ${error.message}`); }
    }

    async function atualizarEstoqueSistema() {
        const categoria = selectCategoriaContagem.value;
        const entidadeId = selectEntidadeContagem.value;
        if (!categoria || !entidadeId) { inputQtdSistema.value = ''; return; }
        try {
            inputQtdSistema.value = 'Calculando...';
            const data = await apiFetch(`/categorias/estoque/?entidade_id=${entidadeId}&categoria_nome=${categoria}`);
            inputQtdSistema.value = data.qtd_sistema;
        } catch (error) { alert(`Erro ao buscar estoque: ${error.message}`); inputQtdSistema.value = 'Erro'; }
    }

    async function salvarContagemCategoria(event) {
        event.preventDefault();
        const dados = {
            data_contagem: inputDataContagem.value, responsavel: inputResponsavel.value.trim(),
            categoria_nome: selectCategoriaContagem.value, qtd_sistema: parseInt(inputQtdSistema.value, 10),
            qtd_contada: parseInt(inputQtdContada.value, 10), entidade_id: parseInt(selectEntidadeContagem.value, 10)
        };
        if (!dados.entidade_id || !dados.categoria_nome || !dados.responsavel) { alert('Responsável, Entidade e Categoria são obrigatórios.'); return; }
        if (isNaN(dados.qtd_sistema) || isNaN(dados.qtd_contada)) { alert('Valores de quantidade inválidos.'); return; }
        try {
            await apiFetch('/contagens/categoria/', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados),
            });
            alert('Contagem salva com sucesso!');
            formContagemCategoria.reset();
            inputDataContagem.value = new Date().toISOString().split('T')[0];
            inputQtdSistema.value = '';
            carregarRelatorioContagens();
        } catch(error) { alert(`Erro ao salvar contagem: ${error.message}`); }
    }

    async function carregarRelatorioContagens() {
        const params = new URLSearchParams();
        if (filtroData.value) params.append('data', filtroData.value);
        if (filtroCategoria.value) params.append('categoria', filtroCategoria.value);
        if (filtroEntidade.value) params.append('entidade_id', filtroEntidade.value);
        if (filtroResponsavel.value) params.append('responsavel', filtroResponsavel.value.trim());
        try {
            const relatorio = await apiFetch(`/contagens/categoria/?${params.toString()}`);
            tabelaRelatorioBody.innerHTML = '';
            if (!relatorio.length) {
                tabelaRelatorioBody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum registro encontrado.</td></tr>';
                return;
            }
            relatorio.forEach(r => {
                const diferencaClasse = r.diferenca !== 0 ? 'text-danger fw-bold' : '';
                tabelaRelatorioBody.innerHTML += `<tr><td>${new Date(r.data_contagem + 'T00:00:00').toLocaleDateString()}</td><td>${r.entidade.nome}</td><td>${r.categoria_nome}</td><td>${r.responsavel}</td><td>${r.qtd_sistema}</td><td>${r.qtd_contada}</td><td class="${diferencaClasse}">${r.diferenca}</td></tr>`;
            });
        } catch(error) { alert(`Erro ao carregar relatório: ${error.message}`); }
    }

    // Inicialização
    inputDataContagem.value = new Date().toISOString().split('T')[0];
    formImportar.addEventListener('submit', importarPlanilha);
    formCriarAuditoria.addEventListener('submit', criarAuditoria);
    selectEntidadeContagem.addEventListener('change', atualizarEstoqueSistema);
    selectCategoriaContagem.addEventListener('change', atualizarEstoqueSistema);
    formContagemCategoria.addEventListener('submit', salvarContagemCategoria);
    formFiltrosContagem.addEventListener('submit', (e) => { e.preventDefault(); carregarRelatorioContagens(); });
    btnLimparFiltros.addEventListener('click', () => { formFiltrosContagem.reset(); carregarRelatorioContagens(); });

    carregarEntidades();
    carregarAuditorias();
    preencherCategoriasDropdown();
    carregarRelatorioContagens();
});
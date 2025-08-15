document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO DOM ---
    const userInfoEl = document.getElementById('user-info');
    const logoutButton = document.getElementById('logout-button');
    const graficoCanvas = document.getElementById('grafico-diferencas-gerais');
    const tabelaBody = document.getElementById('tabela-diferencas-gerais');
    const sumarioContainer = document.getElementById('sumario-container');
    const erroPlaceholder = document.getElementById('erro-placeholder');
    const relatorioContainer = document.getElementById('relatorio-container');
    
    let graficoDiferencas = null;

    // --- FUNÇÕES DE API E UTILITÁRIAS ---
    async function apiFetch(url, options = {}) {
        const token = localStorage.getItem('accessToken');
        if (!token) { window.location.href = '/login'; return; }
        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers };
        try {
            const response = await fetch(url, { ...options, headers });
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('accessToken');
                window.location.href = '/login';
                throw new Error('Sessão expirada ou sem permissão. Faça login novamente.');
            }
            if (!response.ok) {
                 const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(errorData.detail || `Erro: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Erro na API:', error);
            throw error;
        }
    }

    function logout() {
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
    }

    // --- FUNÇÕES DE RENDERIZAÇÃO ---
    function renderizarSumario(dados) {
        if (!sumarioContainer) return;
        const categoriasComDiferenca = dados.length;
        const maiorSobra = dados.reduce((max, item) => item.diferenca_total > max.diferenca_total ? item : max, {diferenca_total: -Infinity, categoria_nome: 'N/A'});
        const maiorFalta = dados.reduce((min, item) => item.diferenca_total < min.diferenca_total ? item : min, {diferenca_total: Infinity, categoria_nome: 'N/A'});

        sumarioContainer.innerHTML = `
            <div class="col-md-4">
                <div class="card text-center h-100 card-sumario card-diferencas">
                    <div class="card-body">
                        <i class="bi bi-list-ol card-sumario-icone"></i>
                        <h2 class="card-title">${categoriasComDiferenca}</h2>
                        <p class="card-text">Categorias com Diferenças</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card text-center h-100 card-sumario card-sobra">
                    <div class="card-body">
                        <i class="bi bi-graph-up-arrow card-sumario-icone"></i>
                        <h2 class="card-title">+${maiorSobra.diferenca_total || 0}</h2>
                        <p class="card-text">Maior Sobra (${maiorSobra.categoria_nome})</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card text-center h-100 card-sumario card-falta">
                    <div class="card-body">
                        <i class="bi bi-graph-down-arrow card-sumario-icone"></i>
                        <h2 class="card-title">${maiorFalta.diferenca_total || 0}</h2>
                        <p class="card-text">Maior Falta (${maiorFalta.categoria_nome})</p>
                    </div>
                </div>
            </div>
        `;
    }

    function renderizarGrafico(dados) {
        if (!graficoCanvas) return;
        const ctx = graficoCanvas.getContext('2d');
        const labels = dados.map(item => item.categoria_nome);
        const data = dados.map(item => item.diferenca_total);
        if (graficoDiferencas) graficoDiferencas.destroy();
        const bodyColor = getComputedStyle(document.documentElement).getPropertyValue('--bs-body-color');
        graficoDiferencas = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{ label: 'Diferença Consolidada', data: data, backgroundColor: data.map(v => v >= 0 ? 'rgba(54, 162, 235, 0.7)' : 'rgba(255, 99, 132, 0.7)') }]
            },
            options: { responsive: true, indexAxis: 'y', scales: { y: { ticks: { color: bodyColor } }, x: { ticks: { color: bodyColor } } }, plugins: { legend: { display: false } } }
        });
    }

    function renderizarTabela(dados) {
        if (!tabelaBody) return;
        tabelaBody.innerHTML = '';
        if (dados.length === 0) {
            tabelaBody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhuma diferença encontrada em auditorias finalizadas.</td></tr>';
            return;
        }
        dados.forEach(item => {
            const row = document.createElement('tr');
            const diferenca = item.diferenca_total;
            const diferencaClasse = diferenca > 0 ? 'text-primary' : 'text-danger';
            row.innerHTML = `
                <td>${item.categoria_nome}</td>
                <td>${item.total_sistema}</td>
                <td>${item.total_contada}</td>
                <td class="fw-bold ${diferencaClasse}">${diferenca > 0 ? '+' : ''}${diferenca}</td>
            `;
            tabelaBody.appendChild(row);
        });
    }

    // --- INICIALIZAÇÃO ---
    async function init() {
        if (logoutButton) logoutButton.addEventListener('click', logout);
        try {
            const user = await apiFetch('/users/me');
            if (userInfoEl) userInfoEl.textContent = `Olá, ${user.username}`;
            
            const dadosRelatorio = await apiFetch('/relatorios/diferencas_consolidadas');
            
            renderizarSumario(dadosRelatorio);
            renderizarGrafico(dadosRelatorio);
            renderizarTabela(dadosRelatorio);
        } catch (error) {
            if (relatorioContainer) relatorioContainer.classList.add('d-none');
            if (erroPlaceholder) {
                erroPlaceholder.classList.remove('d-none');
                erroPlaceholder.innerHTML = `<div class="alert alert-danger">Não foi possível carregar o relatório. Motivo: ${error.message}</div>`;
            }
        }
    }

    init();
});
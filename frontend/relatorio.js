// FILE: frontend/relatorio.js
// (Versão REFATORADA)

document.addEventListener('DOMContentLoaded', () => {
    const erroPlaceholder = document.getElementById('erro-placeholder');
    const relatorioContainer = document.getElementById('relatorio-container');
    const sumarioContainer = document.getElementById('sumario-container');
    const graficoCanvas = document.getElementById('grafico-diferencas-gerais');
    const graficoPlaceholder = document.getElementById('grafico-placeholder');
    const tabelaBody = document.getElementById('tabela-diferencas-gerais');
    const filtroDataInicio = document.getElementById('filtro-data-inicio');
    const filtroDataFim = document.getElementById('filtro-data-fim');
    const filtroEntidadeContainer = document.getElementById('filtro-entidade-container');
    const filtroEntidade = document.getElementById('filtro-entidade');
    const btnAplicarFiltros = document.getElementById('btn-aplicar-filtros');
    const btnExportarRelatorio = document.getElementById('btn-exportar-relatorio');

    let graficoDiferencas = null;

    // apiFetch foi removido, usamos o global de utils.js
    // formatarBRL foi removido, usamos o global de utils.js

    // --- FUNÇÃO renderizarSumario CORRIGIDA ---
    function renderizarSumario(kpis) {
        if (!kpis) {
            sumarioContainer.innerHTML = '<p class="text-muted">Não foi possível carregar o sumário.</p>';
            return;
        };

        // Garante que os valores sejam numéricos antes de formatar
        const impactoFinanceiro = Number(kpis.impacto_financeiro) || 0;
        const auditoriasNoPeriodo = Number(kpis.auditorias_no_periodo) || 0;
        const totalItensDivergentes = Number(kpis.total_itens_divergentes) || 0;
        const taxaAcuracia = Number(kpis.taxa_acuracia) || 0;

        // Define classes e ícones
        const impactoClasse = impactoFinanceiro < 0 ? 'card-falta' : (impactoFinanceiro > 0 ? 'card-sobra' : 'card-neutro'); // Adiciona classe neutra para 0
        const impactoIcon = impactoFinanceiro < 0 ? 'bi-graph-down-arrow' : 'bi-graph-up-arrow';

        sumarioContainer.innerHTML = `
            <div class="col-lg-3 col-md-6 mb-4">
                <div class="card text-center h-100 card-sumario card-auditorias shadow-sm">
                    <div class="card-body position-relative d-flex flex-column justify-content-center">
                        <i class="bi bi-card-checklist card-sumario-icone"></i>
                        <h2 class="card-title display-5 fw-bold mb-1">${auditoriasNoPeriodo}</h2>
                        <p class="card-text mt-2">Auditorias no Período</p>
                    </div>
                </div>
            </div>
            <div class="col-lg-3 col-md-6 mb-4">
                 <div class="card text-center h-100 card-sumario ${impactoClasse} shadow-sm">
                     <div class="card-body position-relative d-flex flex-column justify-content-center">
                        <i class="bi ${impactoIcon} card-sumario-icone"></i>
                        <h2 class="card-title display-5 fw-bold mb-1">${formatarBRL(impactoFinanceiro)}</h2> <p class="card-text mt-2">Impacto Financeiro Total</p>
                    </div>
                </div>
            </div>
            <div class="col-lg-3 col-md-6 mb-4">
                <div class="card text-center h-100 card-sumario card-divergentes shadow-sm">
                     <div class="card-body position-relative d-flex flex-column justify-content-center">
                        <i class="bi bi-funnel card-sumario-icone"></i>
                        <h2 class="card-title display-5 fw-bold mb-1">${totalItensDivergentes}</h2>
                        <p class="card-text mt-2">Total de Itens Divergentes</p>
                    </div>
                </div>
            </div>
            <div class="col-lg-3 col-md-6 mb-4">
                <div class="card text-center h-100 card-sumario card-precisao shadow-sm">
                     <div class="card-body position-relative d-flex flex-column justify-content-center">
                        <i class="bi bi-bullseye card-sumario-icone"></i>
                        <h2 class="card-title display-5 fw-bold mb-1">${taxaAcuracia.toFixed(2)}%</h2>
                        <p class="card-text mt-2">Precisão do Estoque</p>
                    </div>
                </div>
            </div>
        `;
    } // --- FIM DA FUNÇÃO renderizarSumario ---

    // --- FUNÇÃO renderizarGrafico (Gráfico de Quantidade) ---
    function renderizarGrafico(dados) {
        if (graficoDiferencas) {
            graficoDiferencas.destroy();
        }

        // Agrupa a DIFERENÇA (QUANTIDADE) por categoria
        const diferencaPorCategoria = dados.reduce((acc, item) => {
            const diferencaNum = Number(item.diferenca) || 0;
            acc[item.categoria_nome] = (acc[item.categoria_nome] || 0) + diferencaNum;
            return acc;
        }, {});

        const labels = Object.keys(diferencaPorCategoria);
        const data = Object.values(diferencaPorCategoria);

        if (labels.length === 0 || data.every(v => v === 0)) {
            graficoCanvas.style.display = 'none';
            graficoPlaceholder.style.display = 'block';
            return;
        } else {
            graficoCanvas.style.display = 'block';
            graficoPlaceholder.style.display = 'none';
        }

        const ctx = graficoCanvas.getContext('2d');
        const bodyColor = getComputedStyle(document.documentElement).getPropertyValue('--bs-body-color').trim();
        const gridColor = `rgba(${getComputedStyle(document.documentElement).getPropertyValue('--bs-body-color-rgb').trim()}, 0.1)`;

        Chart.register(ChartDataLabels);

        const isHorizontal = labels.length > 10;
        const indexAxis = isHorizontal ? 'y' : 'x';

        graficoDiferencas = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Diferença (Quantidade)',
                    data: data,
                    backgroundColor: data.map(v => v >= 0 ? 'rgba(54, 162, 235, 0.7)' : 'rgba(255, 99, 132, 0.7)'),
                    borderColor: data.map(v => v >= 0 ? 'rgb(54, 162, 235)' : 'rgb(255, 99, 132)'),
                    borderWidth: 1,
                    maxBarThickness: 70
                }]
            },
            options: {
                indexAxis: indexAxis,
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    [isHorizontal ? 'x' : 'y']: {
                        ticks: { color: bodyColor, precision: 0 },
                        grid: { color: gridColor },
                        grace: '10%'
                    },
                     [isHorizontal ? 'y' : 'x']: {
                        ticks: { color: bodyColor },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed[isHorizontal ? 'x' : 'y'];
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += (value > 0 ? '+' : '') + value;
                                return label;
                            }
                        }
                    },
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        color: bodyColor,
                        font: { weight: 'bold' },
                        formatter: (value) => (value > 0 ? '+' : '') + value,
                        display: function(context) {
                            return context.dataset.data[context.dataIndex] !== 0;
                        }
                    }
                }
            }
        });
    } // --- FIM DA FUNÇÃO renderizarGrafico ---

    function renderizarTabela(dados) {
        tabelaBody.innerHTML = '';
        if (!dados || dados.length === 0) {
            tabelaBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Nenhuma diferença encontrada para os filtros selecionados.</td></tr>';
            return;
        }
        dados.forEach(item => {
            const row = document.createElement('tr');
            const diferenca = Number(item.diferenca) || 0;
            const impacto = Number(item.impacto_item) || 0;
            const qtdSistema = Number(item.qtd_sistema) || 0;
            const qtdContada = Number(item.qtd_contada) || 0;
            const classeCor = diferenca > 0 ? 'text-primary' : (diferenca < 0 ? 'text-danger' : '');

            row.innerHTML = `
                <td>${item.codigo_auditoria || 'N/A'}</td>
                <td>${(item.entidade_nome || '').toUpperCase()}</td>
                <td>${item.data_fim ? new Date(item.data_fim).toLocaleDateString('pt-BR') : 'N/A'}</td>
                <td>${item.categoria_nome || 'N/A'}</td>
                <td class="text-end">${qtdSistema}</td>
                <td class="text-end">${qtdContada}</td>
                <td class="fw-bold text-end ${classeCor}">${diferenca > 0 ? '+' : ''}${diferenca}</td>
                <td class="fw-bold text-end ${classeCor}">${formatarBRL(impacto)}</td> `;
            tabelaBody.appendChild(row);
        });
    }

    async function setupFiltros() {
         try {
            const entidades = await apiFetch('/entidades/'); // Usa apiFetch global
            if (entidades && entidades.length > 1) {
                 filtroEntidade.innerHTML = '<option value="">Todas as Entidades</option>';
                filtroEntidade.innerHTML += entidades.map(e => `<option value="${e.id}">${e.nome.toUpperCase()}</option>`).join('');
                filtroEntidadeContainer.style.display = 'block';
            } else {
                 filtroEntidadeContainer.style.display = 'none';
            }
        } catch (error) {
            // Erro já tratado pelo toast do apiFetch
            console.error("Erro ao configurar filtros:", error);
            filtroEntidadeContainer.style.display = 'none';
        }
    }

    function getQueryString() {
        let queryParams = new URLSearchParams();
        if (filtroDataInicio.value) queryParams.append('data_inicio', filtroDataInicio.value);
        if (filtroDataFim.value) queryParams.append('data_fim', filtroDataFim.value);
        if (filtroEntidade.value) queryParams.append('entidade_id', filtroEntidade.value);
        return queryParams.toString();
    }

    async function carregarRelatorio() {
        sumarioContainer.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Carregando...</span></div></div>';
        tabelaBody.innerHTML = '';
        if (graficoDiferencas) graficoDiferencas.destroy();
        graficoCanvas.style.display = 'none';
        graficoPlaceholder.style.display = 'none';
        erroPlaceholder.classList.add('d-none');
        relatorioContainer.style.display = 'block';

        try {
            const queryString = getQueryString();
            const dadosRelatorioCompleto = await apiFetch(`/relatorios/diferencas_consolidadas?${queryString}`); // Usa apiFetch global

             if (!dadosRelatorioCompleto || !dadosRelatorioCompleto.kpis) {
                 throw new Error("Dados do relatório não puderam ser carregados ou estão incompletos.");
             }

            renderizarSumario(dadosRelatorioCompleto.kpis);
            renderizarGrafico(dadosRelatorioCompleto.diferencas || []);
            renderizarTabela(dadosRelatorioCompleto.diferencas || []);

        } catch (error) {
            // Erro já tratado pelo toast do apiFetch
            console.error("Erro detalhado ao carregar relatório:", error);
            relatorioContainer.style.display = 'none';
            erroPlaceholder.classList.remove('d-none');
            erroPlaceholder.innerHTML = `<div class="alert alert-danger">Não foi possível carregar o relatório. Motivo: ${error.message || 'Erro desconhecido'}</div>`;
            sumarioContainer.innerHTML = '';
        }
    }

    async function exportarRelatorio() {
        btnExportarRelatorio.disabled = true;
        const originalText = btnExportarRelatorio.innerHTML;
        btnExportarRelatorio.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Gerando...`;

        try {
            const queryString = getQueryString();
            const blob = await apiFetch(`/relatorios/exportar_excel?${queryString}`, {}, true); // Usa apiFetch global

             if (!blob) {
                 throw new Error("A resposta do servidor para exportação estava vazia.");
             }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `relatorio_historico_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

        } catch (error) {
            // Erro já tratado pelo toast do apiFetch
            console.error("Erro ao exportar relatório:", error);
            // alert(`Erro ao exportar o relatório: ${error.message || 'Erro desconhecido'}`); // O toast já foi mostrado
        } finally {
            btnExportarRelatorio.disabled = false;
            btnExportarRelatorio.innerHTML = originalText;
        }
    }

    async function init() {
         try {
             await setupFiltros();
             await carregarRelatorio();

             btnAplicarFiltros.addEventListener('click', carregarRelatorio);
             btnExportarRelatorio.addEventListener('click', exportarRelatorio);

         } catch (error) {
             // Erro já tratado pelo toast do apiFetch
             console.error("Erro na inicialização do relatório:", error);
             
             // Verifica se o usuário é admin
             const user = window.appState.currentUser || await apiFetch('/users/me');
             if (user && user.role !== 'admin') {
                 document.querySelector('main').innerHTML = `<div class="alert alert-danger"><h4><i class="bi bi-exclamation-triangle-fill"></i> Acesso Negado</h4><p>Esta página de relatório é exclusiva para administradores.</p></div>`;
                 if (document.getElementById('nav-placeholder')) document.getElementById('nav-placeholder').style.display = 'none';
                 if (document.querySelector('footer')) document.querySelector('footer').style.display = 'none';
             } else {
                 erroPlaceholder.classList.remove('d-none');
                 erroPlaceholder.innerHTML = `<div class="alert alert-danger">Erro ao inicializar a página: ${error.message || 'Erro desconhecido'}</div>`;
             }
         }
    }

    init();
});
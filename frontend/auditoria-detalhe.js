// FILE: frontend/auditoria-detalhe.js
// (Versão ATUALIZADA - Adicionado botão Confirmar Contagem)

document.addEventListener('DOMContentLoaded', () => {
    // Funções globais de utils.js (apiFetch, showToast)
    const auditoriaId = new URLSearchParams(window.location.search).get('id');
    const confirmationModal = new bootstrap.Modal(document.getElementById('confirmarFinalizarModal'));
    const tabelaBody = document.getElementById('tabela-contagem-body'); // Mover para cá para usar no listener

    // Função carregarDetalhesAuditoria (Modificada para incluir botão)
    async function carregarDetalhesAuditoria() {
        if (!auditoriaId) {
            document.querySelector('main').innerHTML = '<p class="text-danger">ID da auditoria não encontrado.</p>';
            return;
        }

        try {
            const auditoria = await apiFetch(`/auditorias/${auditoriaId}`);
            const isFinalizada = !!auditoria.data_fim;
            let temDiferencas = false;

            const header = document.getElementById('auditoria-header');
            header.innerHTML = `
                <h2 class="mb-1">${auditoria.codigo_referencia} <span class="badge fs-6 align-middle ${isFinalizada ? 'bg-success' : 'bg-warning text-dark'}">${isFinalizada ? 'Finalizada' : 'Em andamento'}</span></h2>
                <p class="lead text-muted"><strong>Entidade:</strong> ${auditoria.entidade.nome} | <strong>Responsável:</strong> ${auditoria.responsavel}</p>
            `;

            // Limpa tabela antes de preencher
            tabelaBody.innerHTML = '';

            auditoria.escopo.forEach(item => { // Usando forEach para facilitar acesso ao item.qtd_sistema
                let rowClass = '';
                if (item.diferenca !== 0) {
                    temDiferencas = true;
                    rowClass = item.diferenca < 0 ? 'diferenca-negativa' : 'diferenca-positiva';
                }
                const diferencaIcon = item.diferenca !== 0 ? `<i class="bi bi-exclamation-triangle-fill text-${item.diferenca < 0 ? 'danger' : 'primary'}"></i>` : '';
                const valorContado = item.data_contagem === null ? '' : item.qtd_contada;
                const inputId = `qtd-contada-${item.categoria_nome.replace(/\s+/g, '-')}`; // Cria um ID único para o input

                // Gera o HTML da linha com input-group e botão
                const rowHtml = `
                    <tr class="${rowClass}">
                        <td>${item.categoria_nome}</td>
                        <td class="text-center align-middle">${item.qtd_sistema}</td>
                        <td>
                            ${!isFinalizada ? `
                            <div class="input-group">
                                <input type="number" class="form-control" id="${inputId}" data-categoria="${item.categoria_nome}" value="${valorContado}">
                                <button class="btn btn-outline-secondary btn-confirmar-contagem" type="button" title="Confirmar contagem igual ao sistema" data-target-input="${inputId}" data-qtd-sistema="${item.qtd_sistema}">
                                    <i class="bi bi-check-lg"></i>
                                </button>
                            </div>
                            ` : `
                            <input type="number" class="form-control" value="${valorContado}" disabled>
                            `}
                        </td>
                        <td class="text-center fw-bold align-middle">${diferencaIcon} ${item.diferenca}</td>
                    </tr>
                `;
                tabelaBody.innerHTML += rowHtml; // Adiciona a linha à tabela
            });


            const actionButtons = document.getElementById('action-buttons');
            const recontagemAlertContainer = document.getElementById('recontagem-alert-container');
            recontagemAlertContainer.innerHTML = '';

            if (!isFinalizada && temDiferencas) {
                recontagemAlertContainer.innerHTML = `
                    <div class="alert alert-warning text-center" role="alert">
                        <h4 class="alert-heading"><i class="bi bi-exclamation-triangle-fill"></i> Atenção: Diferenças Encontradas!</h4>
                        <p>Foram detectadas divergências entre a contagem e o estoque do sistema. Por favor, reconfira os itens destacados antes de finalizar a auditoria para garantir a precisão dos dados.</p>
                    </div>`;
            }

            if (isFinalizada) {
                actionButtons.innerHTML = `
                    <a href="/auditorias.html" class="btn btn-secondary"><i class="bi bi-arrow-left me-2"></i> Voltar para Lista</a>
                    <button id="btn-exportar" class="btn btn-success"><i class="bi bi-file-earmark-excel-fill me-2"></i> Exportar para Excel</button>
                `;
                document.getElementById('btn-exportar').addEventListener('click', exportarExcel);
            } else {
                actionButtons.innerHTML = `
                    <a href="/auditorias.html" class="btn btn-secondary"><i class="bi bi-arrow-left me-2"></i> Voltar para Lista</a>
                    <button id="btn-salvar-contagens" class="btn btn-info text-white"><i class="bi bi-save-fill me-2"></i> Salvar Contagens</button>
                    <button id="btn-finalizar" class="btn btn-danger"><i class="bi bi-check-circle-fill me-2"></i> Finalizar Auditoria</button>
                `;
                document.getElementById('btn-salvar-contagens').addEventListener('click', salvarContagens);
                document.getElementById('btn-finalizar').addEventListener('click', handleFinalizarClick);
            }

        } catch (error) {
            document.querySelector('main').innerHTML = `<div class="alert alert-danger">Erro ao carregar auditoria: ${error.message}</div>`;
        }
    }

    // Função salvarContagens (Modificada para pegar valor de inputs pelo ID)
    async function salvarContagens() {
        const inputs = document.querySelectorAll('#tabela-contagem-body input[type="number"]'); // Seleciona apenas inputs numéricos
        const contagens = Array.from(inputs).map(input => ({
            categoria_nome: input.dataset.categoria,
            qtd_contada: parseInt(input.value) || 0
        }));

        try {
            await apiFetch(`/auditorias/${auditoriaId}/contagem_manual`, {
                method: 'POST',
                body: JSON.stringify({ contagens: contagens })
            });
            showToast('Contagens salvas com sucesso!');
            await carregarDetalhesAuditoria(); // Recarrega para mostrar diferenças atualizadas
            return true;
        } catch (error) {
            // Erro já tratado pelo toast
            return false;
        }
    }

    // Função exportarExcel (inalterada)
    async function exportarExcel() { /* ... código inalterado ... */
        try {
            const blob = await apiFetch(`/auditorias/${auditoriaId}/exportar_excel`, {}, true);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `auditoria_${auditoriaId}.xlsx`;
            document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
        } catch(error) { /* Erro tratado pelo toast */ }
    }

    // Função handleFinalizarClick (inalterada)
    async function handleFinalizarClick() { /* ... código inalterado ... */
        const sucesso = await salvarContagens();
        if (sucesso) { confirmationModal.show(); }
    }

    // Listener do modal de finalização (inalterado)
    document.getElementById('btn-confirmar-finalizacao-modal').addEventListener('click', async () => { /* ... código inalterado ... */
        const inputPalavraChave = document.getElementById('confirmacao-palavra-chave');
        const erroDiv = document.getElementById('confirmacao-erro');
        if (inputPalavraChave.value.toUpperCase() !== 'FINALIZAR') { erroDiv.classList.remove('d-none'); return; }
        erroDiv.classList.add('d-none');
        try {
            await apiFetch(`/auditorias/${auditoriaId}/finalizar`, { method: 'POST' });
            confirmationModal.hide(); showToast('Auditoria finalizada com sucesso!');
            await carregarDetalhesAuditoria();
        } catch (error) { inputPalavraChave.value = ''; }
    });

    // --- (NOVA) Função para lidar com clique no botão Confirmar ---
    function confirmarContagem(event) {
        const button = event.target.closest('.btn-confirmar-contagem');
        if (!button) return; // Sai se não foi no botão

        const inputId = button.dataset.targetInput;
        const qtdSistema = button.dataset.qtdSistema;
        const inputElement = document.getElementById(inputId);

        if (inputElement) {
            inputElement.value = qtdSistema; // Define o valor do input

            // Feedback visual rápido (opcional)
            button.classList.remove('btn-outline-secondary');
            button.classList.add('btn-success'); // Muda para verde
             button.querySelector('i').className = 'bi bi-check-all'; // Ícone duplo check
            setTimeout(() => {
                button.classList.remove('btn-success');
                button.classList.add('btn-outline-secondary'); // Volta ao normal
                 button.querySelector('i').className = 'bi bi-check-lg'; // Volta ícone normal
            }, 500); // Meio segundo
        }
    }

    // --- (NOVO) Event Listener delegado para os botões Confirmar ---
    tabelaBody.addEventListener('click', confirmarContagem);


    // Inicia carregando os detalhes
    carregarDetalhesAuditoria();
});
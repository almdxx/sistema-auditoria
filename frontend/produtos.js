// FILE: frontend/produtos.js
// (Versão REFATORADA)

document.addEventListener('DOMContentLoaded', () => {
    // apiFetch, showToast e formatarBRL agora são globais (utils.js)
    
    const loadingPlaceholder = document.getElementById('loading-placeholder');
    const tableContainer = document.getElementById('produtos-table-container');
    const tabelaBody = document.getElementById('tabela-produtos-body');
    const emptyStateContainer = document.getElementById('empty-state-container');
    const editarCustoModal = new bootstrap.Modal(document.getElementById('editarCustoModal'));
    const salvarCustoBtn = document.getElementById('salvar-custo-btn');
    const modalErrorPlaceholder = document.getElementById('modal-error-placeholder');
    const modalProdutoIdInput = document.getElementById('modal-produto-id');
    const modalProdutoNomeSpan = document.getElementById('modal-produto-nome');
    const modalProdutoCustoInput = document.getElementById('modal-produto-custo');
    const spinnerSalvar = salvarCustoBtn.querySelector('.spinner-border');

    // Funções apiFetch, showToast e formatarBRL removidas

    // Função para carregar e renderizar a lista de produtos
    async function carregarProdutos() {
        loadingPlaceholder.style.display = 'block';
        tableContainer.style.display = 'none';
        emptyStateContainer.style.display = 'none';
        tabelaBody.innerHTML = ''; // Limpa tabela antes de carregar

        try {
            const produtos = await apiFetch('/api/produtos'); // Usa apiFetch global

            if (!produtos || produtos.length === 0) {
                emptyStateContainer.style.display = 'block';
            } else {
                tabelaBody.innerHTML = produtos.map(produto => `
                    <tr data-produto-id="${produto.id}">
                        <td>${produto.nome_item}</td>
                        <td>${produto.grupo || '-'}</td>
                        <td class="text-end fw-bold">${formatarBRL(produto.custo)}</td> <td class="text-center">
                            <button class="btn btn-sm btn-outline-primary btn-editar"
                                    data-id="${produto.id}"
                                    data-nome="${produto.nome_item}"
                                    data-custo="${produto.custo}">
                                <i class="bi bi-pencil-square"></i> Editar Custo
                            </button>
                        </td>
                    </tr>
                `).join('');
                tableContainer.style.display = 'block';
            }
        } catch (error) {
            // O erro já é mostrado pelo showToast dentro do apiFetch global
             emptyStateContainer.innerHTML = `<p class="text-danger text-center">Erro ao carregar produtos. Verifique as permissões ou tente novamente.</p>`;
             emptyStateContainer.style.display = 'block';
        } finally {
            loadingPlaceholder.style.display = 'none';
        }
    }

    // Função para abrir o modal de edição
    function abrirModalEdicao(event) {
        const button = event.target.closest('.btn-editar');
        if (!button) return;

        const id = button.dataset.id;
        const nome = button.dataset.nome;
        const custo = button.dataset.custo;

        modalProdutoIdInput.value = id;
        modalProdutoNomeSpan.textContent = nome;
        modalProdutoCustoInput.value = parseFloat(custo).toFixed(2); // Formata para 2 casas decimais
        modalErrorPlaceholder.classList.add('d-none'); // Esconde erro anterior
        editarCustoModal.show();
    }

    // Função para salvar o novo custo
    async function salvarCusto() {
        const id = modalProdutoIdInput.value;
        const novoCusto = parseFloat(modalProdutoCustoInput.value);

        modalErrorPlaceholder.classList.add('d-none'); // Esconde erro

        // Validação simples no frontend
        if (isNaN(novoCusto) || novoCusto < 0) {
            modalErrorPlaceholder.textContent = 'Por favor, insira um custo válido (número maior ou igual a zero).';
            modalErrorPlaceholder.classList.remove('d-none');
            return;
        }

        spinnerSalvar.classList.remove('d-none');
        salvarCustoBtn.disabled = true;

        try {
            await apiFetch(`/api/produtos/${id}`, { // Usa apiFetch global
                method: 'PUT',
                body: JSON.stringify({ custo: novoCusto }) // Envia no formato esperado pelo schema ProdutoUpdateCusto
            });
            editarCustoModal.hide();
            showToast('Custo atualizado com sucesso!'); // Usa showToast global
            // Atualiza a linha específica na tabela para não recarregar tudo
            const linhaAtualizada = tabelaBody.querySelector(`tr[data-produto-id="${id}"]`);
            if(linhaAtualizada) {
                 linhaAtualizada.cells[2].textContent = formatarBRL(novoCusto); // Usa formatarBRL global
                 // Atualiza o data-custo no botão também
                 const btnEditar = linhaAtualizada.querySelector('.btn-editar');
                 if (btnEditar) btnEditar.dataset.custo = novoCusto.toFixed(2);
            } else {
                 await carregarProdutos(); // Recarrega tudo se não encontrar a linha (fallback)
            }

        } catch (error) {
            // Erro já tratado pelo showToast no apiFetch
             modalErrorPlaceholder.textContent = `Erro ao salvar: ${error.message}`;
             modalErrorPlaceholder.classList.remove('d-none');
        } finally {
            spinnerSalvar.classList.add('d-none');
            salvarCustoBtn.disabled = false;
        }
    }

    // --- INICIALIZAÇÃO ---
    // Adiciona listener para cliques na tabela (para pegar os botões de editar)
    tabelaBody.addEventListener('click', abrirModalEdicao);
    // Adiciona listener para o botão salvar do modal
    salvarCustoBtn.addEventListener('click', salvarCusto);

    // Carrega os produtos ao iniciar a página
    carregarProdutos();
});
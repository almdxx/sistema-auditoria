// FILE: frontend/lojas.js
// (ARQUIVO NOVO)

document.addEventListener('DOMContentLoaded', () => {
    // Funções globais (apiFetch, showToast) vêm de utils.js
    
    const loadingPlaceholder = document.getElementById('loading-placeholder');
    const tableContainer = document.getElementById('lojas-table-container');
    const tabelaBody = document.getElementById('tabela-lojas-body');
    const emptyStateContainer = document.getElementById('empty-state-container');
    const btnNovaLoja = document.getElementById('btn-nova-loja');

    // Elementos do Modal
    const lojaModal = new bootstrap.Modal(document.getElementById('lojaModal'));
    const lojaModalLabel = document.getElementById('lojaModalLabel');
    const formLoja = document.getElementById('loja-form');
    const salvarLojaBtn = document.getElementById('salvar-loja-btn');
    const modalErrorPlaceholder = document.getElementById('modal-error-placeholder');
    const modalLojaIdInput = document.getElementById('modal-loja-id');
    const modalLojaNomeInput = document.getElementById('modal-loja-nome');
    const spinnerSalvar = salvarLojaBtn.querySelector('.spinner-border');

    // Função para carregar e renderizar a lista de lojas
    async function carregarLojas() {
        loadingPlaceholder.style.display = 'block';
        tableContainer.style.display = 'none';
        emptyStateContainer.style.display = 'none';
        tabelaBody.innerHTML = '';

        try {
            // Verifica se é admin (medida de segurança no frontend)
            let currentUser = window.appState.currentUser;
            if (!currentUser) {
                currentUser = await apiFetch('/users/me');
                window.appState.currentUser = currentUser;
            }
            if (currentUser.role !== 'admin') {
                window.location.href = '/'; // Redireciona se não for admin
                return;
            }

            const lojas = await apiFetch('/entidades/'); // Rota principal de listagem

            if (!lojas || lojas.length === 0) {
                emptyStateContainer.style.display = 'block';
            } else {
                tabelaBody.innerHTML = lojas.map(loja => `
                    <tr data-loja-id="${loja.id}">
                        <td>${loja.id}</td>
                        <td class="loja-nome">${loja.nome.toUpperCase()}</td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-outline-primary btn-editar"
                                    data-id="${loja.id}"
                                    data-nome="${loja.nome}">
                                <i class="bi bi-pencil-square"></i> Editar
                            </button>
                            </td>
                    </tr>
                `).join('');
                tableContainer.style.display = 'block';
            }
        } catch (error) {
            // Erro já tratado pelo toast do apiFetch
            emptyStateContainer.innerHTML = `<p class="text-danger text-center">Erro ao carregar lojas.</p>`;
            emptyStateContainer.style.display = 'block';
        } finally {
            loadingPlaceholder.style.display = 'none';
        }
    }

    // Função para preparar o modal (para Criar ou Editar)
    function prepararModal(id = null, nome = '') {
        formLoja.reset();
        modalErrorPlaceholder.classList.add('d-none');
        modalLojaIdInput.value = id || '';
        modalLojaNomeInput.value = nome;

        if (id) {
            lojaModalLabel.textContent = 'Editar Loja';
        } else {
            lojaModalLabel.textContent = 'Adicionar Nova Loja';
        }
    }

    // Função para salvar (Criar ou Atualizar)
    async function salvarLoja() {
        const id = modalLojaIdInput.value;
        const nome = modalLojaNomeInput.value.trim();

        modalErrorPlaceholder.classList.add('d-none');
        if (!nome) {
            modalErrorPlaceholder.textContent = 'O nome da loja é obrigatório.';
            modalErrorPlaceholder.classList.remove('d-none');
            return;
        }

        spinnerSalvar.classList.remove('d-none');
        salvarLojaBtn.disabled = true;

        const isEditing = !!id;
        const url = isEditing ? `/api/entidades/${id}` : '/api/entidades';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const lojaAtualizada = await apiFetch(url, {
                method: method,
                body: JSON.stringify({ nome: nome })
            });

            lojaModal.hide();
            showToast(isEditing ? 'Loja atualizada com sucesso!' : 'Loja criada com sucesso!');

            // Atualiza a tabela dinamicamente
            if (isEditing) {
                const linha = tabelaBody.querySelector(`tr[data-loja-id="${id}"]`);
                if (linha) {
                    linha.querySelector('.loja-nome').textContent = lojaAtualizada.nome.toUpperCase();
                    linha.querySelector('.btn-editar').dataset.nome = lojaAtualizada.nome;
                } else {
                    await carregarLojas(); // Fallback
                }
            } else {
                await carregarLojas(); // Recarrega tudo ao criar uma nova
            }

        } catch (error) {
            // Erro já tratado pelo toast do apiFetch
            modalErrorPlaceholder.textContent = `Erro: ${error.message}`;
            modalErrorPlaceholder.classList.remove('d-none');
        } finally {
            spinnerSalvar.classList.add('d-none');
            salvarLojaBtn.disabled = false;
        }
    }

    // --- INICIALIZAÇÃO e EVENT LISTENERS ---

    // Listener para o botão "Adicionar Nova Loja"
    btnNovaLoja.addEventListener('click', () => {
        prepararModal(); // Chama sem ID e nome
    });

    // Listener de clique na tabela para pegar botões "Editar"
    tabelaBody.addEventListener('click', (event) => {
        const button = event.target.closest('.btn-editar');
        if (button) {
            const id = button.dataset.id;
            const nome = button.dataset.nome;
            prepararModal(id, nome);
            lojaModal.show();
        }
    });

    // Listener para o botão salvar do modal
    salvarLojaBtn.addEventListener('click', salvarLoja);

    // Limpa o modal quando ele é fechado
    document.getElementById('lojaModal').addEventListener('hidden.bs.modal', () => {
        formLoja.reset();
        modalErrorPlaceholder.classList.add('d-none');
        modalLojaIdInput.value = '';
    });

    // Carrega as lojas ao iniciar a página
    carregarLojas();
});
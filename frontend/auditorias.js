// FILE: frontend/auditorias.js
// (Versão REFATORADA)

document.addEventListener('DOMContentLoaded', () => {
    // apiFetch e showToast agora são globais (utils.js)
    
    const novaAuditoriaModal = new bootstrap.Modal(document.getElementById('novaAuditoriaModal'));
    const confirmacaoExclusaoModal = new bootstrap.Modal(document.getElementById('confirmarExclusaoModal'));
    const form = document.getElementById('nova-auditoria-form');
    const salvarBtn = document.getElementById('salvar-auditoria-btn');
    const spinner = salvarBtn.querySelector('.spinner-border');
    const errorPlaceholder = document.getElementById('modal-error-placeholder');
    let currentUser = null; // Será pego do window.appState
    let tomSelectCategorias = null;
    let auditoriaParaExcluirId = null;

    // apiFetch foi removido daqui, usamos o global

    async function carregarAuditorias() {
        const loadingPlaceholder = document.getElementById('loading-placeholder');
        const emptyStateContainer = document.getElementById('empty-state-container');
        const tableContainer = document.getElementById('auditorias-table-container');
        const tabelaBody = document.getElementById('tabela-auditorias-body');
        const btnHeader = document.getElementById('btn-criar-auditoria-header');
        
        loadingPlaceholder.style.display = 'block';
        emptyStateContainer.style.display = 'none';
        tableContainer.style.display = 'none';
        btnHeader.style.display = 'none';

        try {
            // Pega o usuário do estado global (definido em nav.js)
            currentUser = window.appState.currentUser;
            // Se nav.js ainda não rodou, busca manualmente (fallback)
            if (!currentUser) {
                currentUser = await apiFetch('/users/me');
                window.appState.currentUser = currentUser; // Salva para outros
            }
            
            const auditorias = await apiFetch('/auditorias/');
            
            if (auditorias.length === 0) {
                emptyStateContainer.style.display = 'block';
            } else {
                tabelaBody.innerHTML = auditorias.map(auditoria => {
                    const statusClass = auditoria.status === 'Finalizada' ? 'bg-success' : 'bg-warning text-dark';
                    
                    let deleteButtonHtml = '';
                    if (currentUser && currentUser.role === 'admin') { // Verificação de role
                        deleteButtonHtml = `
                            <button class="btn btn-sm btn-outline-danger ms-2 btn-excluir" 
                                    data-auditoria-id="${auditoria.id}" 
                                    data-auditoria-codigo="${auditoria.codigo_referencia}">
                                <i class="bi bi-trash-fill"></i>
                            </button>`;
                    }

                    return `
                        <tr>
                            <td class="fw-bold">${auditoria.codigo_referencia}</td>
                            <td>${auditoria.entidade.nome}</td>
                            <td>${auditoria.responsavel}</td>
                            <td>${new Date(auditoria.data_inicio).toLocaleString('pt-BR')}</td>
                            <td><span class="badge ${statusClass}">${auditoria.status}</span></td>
                            <td>
                                <a href="/auditoria-detalhe.html?id=${auditoria.id}" class="btn btn-sm btn-outline-primary"><i class="bi bi-pencil-square me-1"></i> Detalhes</a>
                                ${deleteButtonHtml}
                            </td>
                        </tr>`;
                }).join('');
                tableContainer.style.display = 'block';
                btnHeader.style.display = 'block';
            }
        } catch (error) {
            // Erro já tratado pelo toast do apiFetch
            emptyStateContainer.innerHTML = `<p class="text-danger text-center">Erro ao carregar auditorias: ${error.message}</p>`;
            emptyStateContainer.style.display = 'block';
        } finally {
            loadingPlaceholder.style.display = 'none';
        }
    }

    async function prepararModal() {
        try {
            // Garante que currentUser está carregado
            if (!currentUser) {
                currentUser = await apiFetch('/users/me');
                window.appState.currentUser = currentUser;
            }

            const [categorias, entidades] = await Promise.all([
                apiFetch('/categorias/importadas/'),
                currentUser.role === 'admin' ? apiFetch('/entidades/') : Promise.resolve(null)
            ]);
            
            const catSelect = document.getElementById('categorias-select');
            if (tomSelectCategorias) {
                tomSelectCategorias.destroy();
            }
            catSelect.innerHTML = categorias.map(cat => 
                `<option value="${cat.nome}">${cat.nome} (${cat.estoque_total} itens)</option>`
            ).join('');
            tomSelectCategorias = new TomSelect(catSelect, {
                plugins: ['remove_button'],
                create: false,
                render:{
                    item: function(data, escape) {
                        return `<div class="item">${escape(data.text.split('(')[0].trim())}</div>`;
                    },
                }
            });
            if (entidades) {
                const entContainer = document.getElementById('entidade-select-container');
                const entSelect = document.getElementById('entidade-select');
                entSelect.innerHTML = entidades.map(ent => `<option value="${ent.id}">${ent.nome.toUpperCase()}</option>`).join('');
                entContainer.style.display = 'block';
            } else {
                 document.getElementById('entidade-select-container').style.display = 'none';
            }
        } catch (error) {
            // Erro já tratado pelo toast do apiFetch
            errorPlaceholder.textContent = `Erro ao carregar dados do formulário: ${error.message}`;
            errorPlaceholder.classList.remove('d-none');
        }
    }
    
    async function salvarNovaAuditoria() {
        errorPlaceholder.classList.add('d-none');
        spinner.classList.remove('d-none');
        salvarBtn.disabled = true;
        
        const responsavel = document.getElementById('responsavel').value;
        const categoriasSelecionadas = tomSelectCategorias.items;
        
        if (!responsavel || categoriasSelecionadas.length === 0) {
            errorPlaceholder.textContent = 'Por favor, preencha o nome do responsável e selecione ao menos uma categoria.';
            errorPlaceholder.classList.remove('d-none');
            spinner.classList.add('d-none');
            salvarBtn.disabled = false;
            return;
        }

        const payload = {
            responsavel: responsavel,
            categorias_escopo: categoriasSelecionadas,
        };
        
        if (currentUser.role === 'admin') {
            payload.entidade_id = document.getElementById('entidade-select').value;
        }

        try {
            await apiFetch('/auditorias/nova_com_escopo/', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            novaAuditoriaModal.hide();
            await carregarAuditorias();
            showToast('Nova auditoria criada com sucesso!', false); // Adiciona toast de sucesso
        } catch (error) {
            // Erro já tratado pelo toast do apiFetch, apenas exibe no modal
            errorPlaceholder.textContent = error.message;
            errorPlaceholder.classList.remove('d-none');
        } finally {
            spinner.classList.add('d-none');
            salvarBtn.disabled = false;
        }
    }

    document.addEventListener('click', (event) => {
        const target = event.target.closest('.btn-excluir');
        if (target) {
            auditoriaParaExcluirId = target.dataset.auditoriaId;
            document.getElementById('codigo-auditoria-exclusao').textContent = target.dataset.auditoriaCodigo;
            confirmacaoExclusaoModal.show();
        }
    });

    document.getElementById('btn-confirmar-exclusao-modal').addEventListener('click', async () => {
        const motivo = document.getElementById('motivo-exclusao').value;
        const password = document.getElementById('senha-exclusao').value;
        const erroDiv = document.getElementById('exclusao-erro');
        
        if (!password) {
            erroDiv.textContent = 'A senha de confirmação é obrigatória.';
            erroDiv.classList.remove('d-none');
            return;
        }
        if (motivo.length < 10) {
            erroDiv.textContent = 'O motivo é muito curto. Por favor, detalhe mais.';
            erroDiv.classList.remove('d-none');
            return;
        }
        erroDiv.classList.add('d-none');

        try {
            await apiFetch(`/auditorias/${auditoriaParaExcluirId}`, {
                method: 'DELETE',
                body: JSON.stringify({ 
                    motivo: motivo,
                    password: password
                })
            });
            confirmacaoExclusaoModal.hide();
            showToast('Auditoria deletada com sucesso!', false); // Toast de sucesso
            await carregarAuditorias();
        } catch(error) {
            // Erro já tratado pelo toast do apiFetch, apenas exibe no modal
            erroDiv.textContent = `Erro: ${error.message}`;
            erroDiv.classList.remove('d-none');
        }
    });

    document.getElementById('confirmarExclusaoModal').addEventListener('hidden.bs.modal', () => {
        document.getElementById('motivo-exclusao').value = '';
        document.getElementById('senha-exclusao').value = '';
        document.getElementById('exclusao-erro').classList.add('d-none');
    });

    document.getElementById('novaAuditoriaModal').addEventListener('show.bs.modal', prepararModal);
    document.getElementById('novaAuditoriaModal').addEventListener('hidden.bs.modal', () => { form.reset(); if (tomSelectCategorias) tomSelectCategorias.clear(); errorPlaceholder.classList.add('d-none'); });
    salvarBtn.addEventListener('click', salvarNovaAuditoria);

    carregarAuditorias();
});
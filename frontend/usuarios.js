// FILE: frontend/usuarios.js
// (Versão ATUALIZADA - Funcionalidade Resetar Senha adicionada)

document.addEventListener('DOMContentLoaded', () => {
    // Funções globais de utils.js (apiFetch, showToast)

    const loadingPlaceholder = document.getElementById('loading-placeholder');
    const tableContainer = document.getElementById('usuarios-table-container');
    const tabelaBody = document.getElementById('tabela-usuarios-body');
    const emptyStateContainer = document.getElementById('empty-state-container');

    // Modais
    const novoUsuarioModal = new bootstrap.Modal(document.getElementById('novoUsuarioModal'));
    const editarUsuarioModal = new bootstrap.Modal(document.getElementById('editarUsuarioModal'));
    const confirmarStatusModal = new bootstrap.Modal(document.getElementById('confirmarStatusModal'));
    const resetPasswordModal = new bootstrap.Modal(document.getElementById('resetPasswordModal')); // NOVO MODAL

    // Elementos Modal Novo
    const formNovoUsuario = document.getElementById('novo-usuario-form');
    const salvarUsuarioBtn = document.getElementById('salvar-usuario-btn');
    const modalErrorPlaceholder = document.getElementById('modal-error-placeholder');
    const modalUsuarioEmailInput = document.getElementById('modal-usuario-email');
    const modalUsuarioSenhaInput = document.getElementById('modal-usuario-senha');
    const modalUsuarioEntidadeSelect = document.getElementById('modal-usuario-entidade');
    const spinnerSalvar = salvarUsuarioBtn.querySelector('.spinner-border');

    // Elementos Modal Editar
    const salvarEdicaoUsuarioBtn = document.getElementById('salvar-edicao-usuario-btn');
    const modalEditErrorPlaceholder = document.getElementById('modal-edit-error-placeholder');
    const modalEditUsuarioIdInput = document.getElementById('modal-edit-usuario-id');
    const modalEditUsuarioEmailSpan = document.getElementById('modal-edit-usuario-email');
    const modalEditUsuarioEntidadeSelect = document.getElementById('modal-edit-usuario-entidade');
    const spinnerSalvarEdicao = salvarEdicaoUsuarioBtn.querySelector('.spinner-border');

    // Elementos Modal Confirmar Status
     const statusActionText = document.getElementById('status-action-text');
     const statusUserEmail = document.getElementById('status-user-email');
     const statusWarningText = document.getElementById('status-warning-text');
     const btnConfirmarStatusModal = document.getElementById('btn-confirmar-status-modal');
     let userIdToToggle = null;

    // Elementos Modal Resetar Senha (NOVOS)
    const salvarResetPasswordBtn = document.getElementById('salvar-reset-password-btn');
    const modalResetErrorPlaceholder = document.getElementById('modal-reset-error-placeholder');
    const modalResetUserIdInput = document.getElementById('modal-reset-user-id');
    const modalResetUserEmailSpan = document.getElementById('modal-reset-user-email');
    const modalResetNewPasswordInput = document.getElementById('modal-reset-new-password');
    // const modalResetConfirmPasswordInput = document.getElementById('modal-reset-confirm-password'); // Se adicionar confirmação
    // const resetPasswordMismatchDiv = document.getElementById('reset-password-mismatch'); // Se adicionar confirmação
    const spinnerResetPassword = salvarResetPasswordBtn.querySelector('.spinner-border');
    let userIdToResetPassword = null; // Guarda o ID para o modal de reset


    let currentUser = null;
    let availableEntidades = [];

    // Função carregarUsuarios (Atualizada para incluir botão de reset)
    async function carregarUsuarios() {
        loadingPlaceholder.style.display = 'block';
        tableContainer.style.display = 'none';
        emptyStateContainer.style.display = 'none';
        tabelaBody.innerHTML = '';

        try {
             currentUser = window.appState.currentUser;
             if (!currentUser) {
                 currentUser = await apiFetch('/users/me');
                 window.appState.currentUser = currentUser;
             }
             if (!currentUser || currentUser.role !== 'admin') {
                 window.location.href = '/';
                 return;
             }

            const usuarios = await apiFetch('/api/users');
            const utilizadoresLoja = usuarios.filter(u => u.role === 'user');

            if (!usuarios || usuarios.length <= 1 || utilizadoresLoja.length === 0) {
                 emptyStateContainer.style.display = 'block';
                 emptyStateContainer.querySelector('h3').textContent = 'Nenhum Usuário de Loja Encontrado';
                 emptyStateContainer.querySelector('p').textContent = 'Adicione usuários para permitir o acesso às funcionalidades de loja.';
                 emptyStateContainer.querySelector('button').style.display = 'inline-block';

            } else {
                tabelaBody.innerHTML = usuarios.map(usuario => {

                     // --- Lógica do Botão de Status ---
                     let statusButtonHtml = '';
                     let statusBadgeHtml = '';
                      if (usuario.role !== 'admin') {
                         const isActive = usuario.is_active; // Pega o status do backend
                         const btnClass = isActive ? 'btn-outline-danger' : 'btn-outline-success';
                         const iconClass = isActive ? 'bi-person-x-fill' : 'bi-person-check-fill';
                         const title = isActive ? 'Desativar Usuário' : 'Ativar Usuário';
                         statusButtonHtml = `
                            <button class="btn btn-sm ${btnClass} btn-toggle-status ms-1"
                                    data-id="${usuario.id}"
                                    data-email="${usuario.username}"
                                    data-active="${isActive}"
                                    title="${title}">
                                <i class="bi ${iconClass}"></i>
                            </button>
                            `;
                         statusBadgeHtml = `<span class="badge ${isActive ? 'bg-success' : 'bg-danger'}">${isActive ? 'Ativo' : 'Inativo'}</span>`;
                     } else {
                         statusBadgeHtml = `<span class="badge bg-primary">Ativo</span>`; // Admin sempre ativo
                     }
                     // --- Fim da Lógica do Botão ---

                     // --- Lógica dos Botões de Ação (Inclui Reset) ---
                     let actionButtonsHtml = '';
                     if (usuario.role !== 'admin') {
                         actionButtonsHtml = `
                            <button class="btn btn-sm btn-outline-primary btn-editar me-1"
                                    data-id="${usuario.id}"
                                    data-email="${usuario.username}"
                                    data-entidade-id="${usuario.entidade ? usuario.entidade.id : ''}"
                                    title="Editar Loja Associada">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-warning btn-reset-password"
                                    data-id="${usuario.id}"
                                    data-email="${usuario.username}"
                                    title="Resetar Senha">
                                <i class="bi bi-key-fill"></i>
                            </button>
                            ${statusButtonHtml} `;
                     } else {
                        actionButtonsHtml = `<span class="text-muted fst-italic">N/A</span>`;
                     }
                     // --- Fim da Lógica dos Botões ---

                    const rowClass = !usuario.is_active ? 'table-secondary text-muted' : '';

                    return `
                    <tr data-user-id="${usuario.id}" class="${rowClass}">
                        <td>${usuario.username}</td>
                        <td><span class="badge ${usuario.role === 'admin' ? 'bg-primary' : 'bg-secondary'}">${usuario.role === 'admin' ? 'Administrador' : 'Usuário Loja'}</span></td>
                        <td class="entidade-nome">${usuario.entidade ? usuario.entidade.nome.toUpperCase() : (usuario.role === 'admin' ? 'Todas' : '-')}</td>
                        <td class="text-center">
                           ${actionButtonsHtml} </td>
                        <td class="text-center status-badge">${statusBadgeHtml}</td> </tr>
                `}).join('');
                tableContainer.style.display = 'block';
            }
        } catch (error) {
             loadingPlaceholder.style.display = 'none';
             tableContainer.style.display = 'none';
             emptyStateContainer.innerHTML = `<p class="text-danger text-center">Erro ao carregar usuários.</p>`;
             emptyStateContainer.style.display = 'block';
        } finally {
            loadingPlaceholder.style.display = 'none';
        }
    }

    // Função carregarEntidades (inalterada)
    async function carregarEntidades(selectElement, errorElement, currentEntidadeId = null) { /* ... código inalterado ... */
         selectElement.innerHTML = '<option value="" selected disabled>Carregando lojas...</option>';
         selectElement.disabled = true;
         if (errorElement) errorElement.classList.add('d-none');
         salvarUsuarioBtn.disabled = true;
         salvarEdicaoUsuarioBtn.disabled = true;
         try {
             if (availableEntidades.length === 0) { availableEntidades = await apiFetch('/entidades/'); }
             if (availableEntidades && availableEntidades.length > 0) {
                 selectElement.innerHTML = '<option value="" selected disabled>Selecione uma loja</option>';
                 selectElement.innerHTML += availableEntidades.map(e => `<option value="${e.id}" ${currentEntidadeId && e.id === parseInt(currentEntidadeId) ? 'selected' : ''}>${e.nome.toUpperCase()}</option>`).join('');
                 selectElement.disabled = false;
                 if(selectElement.id === 'modal-usuario-entidade') salvarUsuarioBtn.disabled = false;
                 if(selectElement.id === 'modal-edit-usuario-entidade') salvarEdicaoUsuarioBtn.disabled = false;
             } else {
                 selectElement.innerHTML = '<option value="" selected disabled>Nenhuma loja encontrada</option>';
                 if (errorElement) { errorElement.textContent = 'Não é possível adicionar/editar usuário sem lojas cadastradas.'; errorElement.classList.remove('d-none'); }
             }
         } catch (error) {
             selectElement.innerHTML = '<option value="" selected disabled>Erro ao carregar lojas</option>';
             if (errorElement) { errorElement.textContent = `Erro ao carregar lojas: ${error.message}`; errorElement.classList.remove('d-none'); }
         }
     }
    // Função prepararModalNovoUsuario (inalterada)
    async function prepararModalNovoUsuario() { /* ... código inalterado ... */
        formNovoUsuario.reset();
        await carregarEntidades(modalUsuarioEntidadeSelect, modalErrorPlaceholder);
     }

    // Função salvarNovoUsuario (Atualizada com validação de senha)
    async function salvarNovoUsuario() {
        const email = modalUsuarioEmailInput.value.trim();
        const senha = modalUsuarioSenhaInput.value;
        const entidadeId = modalUsuarioEntidadeSelect.value;
        modalErrorPlaceholder.classList.add('d-none');
        if (!email || !senha || !entidadeId) {
            modalErrorPlaceholder.textContent = 'Todos os campos são obrigatórios.';
            modalErrorPlaceholder.classList.remove('d-none'); return;
        }
        if (senha.length < 8) { // Validação tamanho da senha
             modalErrorPlaceholder.textContent = 'A senha inicial deve ter no mínimo 8 caracteres.';
             modalErrorPlaceholder.classList.remove('d-none');
             modalUsuarioSenhaInput.focus();
             return;
        }
        spinnerSalvar.classList.remove('d-none'); salvarUsuarioBtn.disabled = true;
        try {
            await apiFetch('/api/users', { method: 'POST', body: JSON.stringify({ username: email, password: senha, entidade_id: parseInt(entidadeId) }) });
            novoUsuarioModal.hide(); showToast('Usuário criado com sucesso!'); await carregarUsuarios();
        } catch (error) { modalErrorPlaceholder.textContent = `Erro: ${error.message}`; modalErrorPlaceholder.classList.remove('d-none'); }
        finally { spinnerSalvar.classList.add('d-none'); salvarUsuarioBtn.disabled = false; }
    }

    // Função abrirModalEdicaoUsuario (inalterada)
    async function abrirModalEdicaoUsuario(event) { /* ... código inalterado ... */
         const button = event.target.closest('.btn-editar');
         if (!button) return;
         const id = button.dataset.id;
         const email = button.dataset.email;
         const entidadeIdAtual = button.dataset.entidadeId;
         modalEditUsuarioIdInput.value = id;
         modalEditUsuarioEmailSpan.textContent = email;
         modalEditErrorPlaceholder.classList.add('d-none');
         await carregarEntidades(modalEditUsuarioEntidadeSelect, modalEditErrorPlaceholder, entidadeIdAtual);
         editarUsuarioModal.show();
      }
    // Função salvarEdicaoUsuario (inalterada)
    async function salvarEdicaoUsuario() { /* ... código inalterado ... */
         const id = modalEditUsuarioIdInput.value;
         const novaEntidadeId = modalEditUsuarioEntidadeSelect.value;
         modalEditErrorPlaceholder.classList.add('d-none');
         if (!novaEntidadeId) { modalEditErrorPlaceholder.textContent = 'Selecione a nova loja associada.'; modalEditErrorPlaceholder.classList.remove('d-none'); return; }
         spinnerSalvarEdicao.classList.remove('d-none'); salvarEdicaoUsuarioBtn.disabled = true;
         try {
             const usuarioAtualizado = await apiFetch(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify({ entidade_id: parseInt(novaEntidadeId) }) });
             editarUsuarioModal.hide(); showToast('Loja do usuário atualizada com sucesso!');
             const linhaAtualizada = tabelaBody.querySelector(`tr[data-user-id="${id}"]`);
             if(linhaAtualizada && usuarioAtualizado && usuarioAtualizado.entidade) {
                  linhaAtualizada.querySelector('.entidade-nome').textContent = usuarioAtualizado.entidade.nome.toUpperCase();
                  const btnEditar = linhaAtualizada.querySelector('.btn-editar');
                  if(btnEditar) btnEditar.dataset.entidadeId = usuarioAtualizado.entidade.id;
             } else { await carregarUsuarios(); }
         } catch (error) { modalEditErrorPlaceholder.textContent = `Erro ao salvar: ${error.message}`; modalEditErrorPlaceholder.classList.remove('d-none'); }
         finally { spinnerSalvarEdicao.classList.add('d-none'); salvarEdicaoUsuarioBtn.disabled = false; }
      }
    // Função abrirModalConfirmarStatus (inalterada)
    function abrirModalConfirmarStatus(event) { /* ... código inalterado ... */
        const button = event.target.closest('.btn-toggle-status');
        if (!button) return;
        userIdToToggle = button.dataset.id; const userEmail = button.dataset.email; const isActive = button.dataset.active === 'true';
        statusUserEmail.textContent = userEmail;
        if (isActive) { statusActionText.textContent = 'desativar'; statusWarningText.textContent = 'O usuário não poderá mais fazer login.'; btnConfirmarStatusModal.className = 'btn btn-danger'; btnConfirmarStatusModal.textContent = 'Confirmar Desativação'; }
        else { statusActionText.textContent = 'ativar'; statusWarningText.textContent = ''; btnConfirmarStatusModal.className = 'btn btn-success'; btnConfirmarStatusModal.textContent = 'Confirmar Ativação'; }
        confirmarStatusModal.show();
      }
    // Função executarToggleStatus (inalterada)
    async function executarToggleStatus() { /* ... código inalterado ... */
        if (!userIdToToggle) return;
        btnConfirmarStatusModal.disabled = true; const originalText = btnConfirmarStatusModal.textContent; btnConfirmarStatusModal.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Alterando...`;
        try {
            const usuarioAtualizado = await apiFetch(`/api/users/${userIdToToggle}/status`, { method: 'PUT' });
            confirmarStatusModal.hide(); showToast(`Status do usuário ${usuarioAtualizado.username} alterado com sucesso!`);
            const linha = tabelaBody.querySelector(`tr[data-user-id="${userIdToToggle}"]`);
            if (linha) {
                const isActive = usuarioAtualizado.is_active; const statusBadge = linha.querySelector('.status-badge'); const toggleButton = linha.querySelector('.btn-toggle-status');
                linha.className = isActive ? '' : 'table-secondary text-muted';
                if (statusBadge) { statusBadge.innerHTML = `<span class="badge ${isActive ? 'bg-success' : 'bg-danger'}">${isActive ? 'Ativo' : 'Inativo'}</span>`; }
                if (toggleButton) { toggleButton.dataset.active = isActive; toggleButton.className = `btn btn-sm ${isActive ? 'btn-outline-danger' : 'btn-outline-success'} btn-toggle-status ms-1`; toggleButton.title = isActive ? 'Desativar Usuário' : 'Ativar Usuário'; toggleButton.querySelector('i').className = `bi ${isActive ? 'bi-person-x-fill' : 'bi-person-check-fill'}`; }
            } else { await carregarUsuarios(); }
        } catch (error) { /* Erro tratado */ }
        finally { btnConfirmarStatusModal.disabled = false; btnConfirmarStatusModal.textContent = originalText; userIdToToggle = null; }
     }

    // --- Funções para Resetar Senha ---
    function abrirModalResetPassword(event) {
        const button = event.target.closest('.btn-reset-password');
        if (!button) return;

        userIdToResetPassword = button.dataset.id;
        const userEmail = button.dataset.email;

        // Preenche o modal
        modalResetUserIdInput.value = userIdToResetPassword;
        modalResetUserEmailSpan.textContent = userEmail;
        modalResetNewPasswordInput.value = ''; // Limpa campo de senha
        modalResetErrorPlaceholder.classList.add('d-none'); // Esconde erros

        resetPasswordModal.show();
    }

    async function executarResetPassword() {
        if (!userIdToResetPassword) return;

        const newPassword = modalResetNewPasswordInput.value;

        modalResetErrorPlaceholder.classList.add('d-none');

        // Validação tamanho da senha (ATUALIZADA)
        if (!newPassword || newPassword.length < 8) {
             modalResetErrorPlaceholder.textContent = 'A nova senha deve ter no mínimo 8 caracteres.';
             modalResetErrorPlaceholder.classList.remove('d-none');
             modalResetNewPasswordInput.focus();
             return;
        }

        spinnerResetPassword.classList.remove('d-none');
        salvarResetPasswordBtn.disabled = true;

        try {
            // Chama a API de reset
            await apiFetch(`/api/users/${userIdToResetPassword}/reset-password`, {
                method: 'PUT',
                body: JSON.stringify({ new_password: newPassword }) // Envia no formato esperado
            });

            resetPasswordModal.hide();
            showToast(`Senha do usuário ${modalResetUserEmailSpan.textContent} resetada com sucesso!`);

        } catch (error) {
            // Erro já tratado pelo toast, apenas exibe no modal
            modalResetErrorPlaceholder.textContent = `Erro ao resetar senha: ${error.message}`;
            modalResetErrorPlaceholder.classList.remove('d-none');
        } finally {
            spinnerResetPassword.classList.add('d-none');
            salvarResetPasswordBtn.disabled = false;
            userIdToResetPassword = null; // Limpa ID guardado
        }
    }


    // --- INICIALIZAÇÃO e EVENT LISTENERS ---
    // Novo Usuário
    document.getElementById('novoUsuarioModal').addEventListener('show.bs.modal', prepararModalNovoUsuario);
    document.getElementById('novoUsuarioModal').addEventListener('hidden.bs.modal', () => { formNovoUsuario.reset(); modalErrorPlaceholder.classList.add('d-none'); salvarUsuarioBtn.disabled = false; });
    salvarUsuarioBtn.addEventListener('click', salvarNovoUsuario);

    // Editar Usuário
    tabelaBody.addEventListener('click', abrirModalEdicaoUsuario);
    salvarEdicaoUsuarioBtn.addEventListener('click', salvarEdicaoUsuario);
    document.getElementById('editarUsuarioModal').addEventListener('hidden.bs.modal', () => {
         modalEditUsuarioEntidadeSelect.innerHTML = '<option value="" selected disabled>Carregando lojas...</option>';
         modalEditErrorPlaceholder.classList.add('d-none');
         salvarEdicaoUsuarioBtn.disabled = false;
     });

     // Ativar/Desativar Usuário
     tabelaBody.addEventListener('click', abrirModalConfirmarStatus);
     btnConfirmarStatusModal.addEventListener('click', executarToggleStatus);

     // Resetar Senha (NOVOS Listeners)
     tabelaBody.addEventListener('click', abrirModalResetPassword); // Listener na tabela para botão reset
     salvarResetPasswordBtn.addEventListener('click', executarResetPassword); // Listener no botão salvar do modal reset
      document.getElementById('resetPasswordModal').addEventListener('hidden.bs.modal', () => { // Limpa modal reset ao fechar
        modalResetNewPasswordInput.value = '';
        modalResetErrorPlaceholder.classList.add('d-none');
        userIdToResetPassword = null;
     });


    carregarUsuarios(); // Carrega os usuários ao iniciar a página
});
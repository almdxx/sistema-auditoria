// FILE: frontend/atualizar-estoque.js
// (Versão ATUALIZADA - Feedback abaixo do botão)

document.addEventListener('DOMContentLoaded', async () => {
    // apiFetch global de utils.js
    
    const form = document.getElementById('upload-form');
    const submitButton = document.getElementById('submit-button');
    const spinner = submitButton.querySelector('.spinner-border');
    const entidadeSelectContainer = document.getElementById('entidade-select-container');
    const entidadeSelect = document.getElementById('entidade-select');
    const uploadResultDiv = document.getElementById('upload-result'); // NOVO: Pega o div de resultado
    let currentUser = null; 

    async function setupForm() {
        try {
            currentUser = window.appState.currentUser;
            if (!currentUser) {
                currentUser = await apiFetch('/users/me'); 
                window.appState.currentUser = currentUser;
            }

            if (currentUser.role === 'admin') {
                const entidades = await apiFetch('/entidades/'); 
                
                entidadeSelect.innerHTML = entidades.map(e => `<option value="${e.id}">${e.nome.toUpperCase()}</option>`).join('');
                entidadeSelectContainer.style.display = 'block';
            }
        } catch (error) {
            if(currentUser && currentUser.role === 'admin') {
                submitButton.disabled = true;
                submitButton.textContent = 'Erro ao carregar lojas';
                // Mostra erro no novo div
                showUploadResult(`Erro ao carregar lojas: ${error.message}`, true); 
            }
        }
    }

    // NOVO: Função para exibir o resultado no div
    function showUploadResult(message, isError = false) {
        uploadResultDiv.textContent = message;
        uploadResultDiv.className = `mt-3 fs-5 alert ${isError ? 'alert-danger' : 'alert-success'}`;
        uploadResultDiv.style.display = 'block';
    }

    async function handleSubmit(event) {
        event.preventDefault();
        
        const fileInput = document.getElementById('file-input');
        const file = fileInput.files[0];

        if (!file) {
            showUploadResult('Por favor, selecione um arquivo.', true); // Usa a nova função
            return;
        }

        spinner.classList.remove('d-none');
        submitButton.disabled = true;
        uploadResultDiv.style.display = 'none'; // Esconde resultado anterior

        const formData = new FormData();
        formData.append('file', file);

        if (entidadeSelectContainer.style.display === 'block') {
            formData.append('entidade_id', entidadeSelect.value);
        }

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch('/produtos/importar_geral', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            if (response.status === 401) {
                localStorage.removeItem('accessToken');
                window.location.href = '/login';
                return;
            }

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.detail || 'Ocorreu um erro desconhecido.');
            }
            
            showUploadResult(result.mensagem, false); // Usa a nova função
            form.reset(); 

        } catch (error) {
            console.error("Erro durante o fetch:", error);
            showUploadResult(error.message, true); // Usa a nova função
        } finally {
            spinner.classList.add('d-none');
            submitButton.disabled = false;
        }
    }

    submitButton.addEventListener('click', handleSubmit);
    setupForm();
});
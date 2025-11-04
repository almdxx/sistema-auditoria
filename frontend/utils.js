// FILE: frontend/utils.js
// Este novo arquivo centraliza funções comuns.

/**
 * Exibe uma mensagem toast no canto da tela.
 * @param {string} message - A mensagem para exibir.
 * @param {boolean} [isError=false] - Define se o toast é de erro (vermelho) ou sucesso (verde).
 */
function showToast(message, isError = false) {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        console.warn("Elemento '.toast-container' não encontrado para exibir toast:", message);
        return; 
    }
    
    const toastId = `toast-${Date.now()}`;
    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center text-white ${isError ? 'bg-danger' : 'bg-success'} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
    toast.show();
    // Remove o elemento do DOM após o toast desaparecer
    toastElement.addEventListener('hidden.bs.toast', () => toastElement.remove());
}

/**
 * Wrapper centralizado para a API fetch.
 * Lida com autenticação, tratamento de erros e JSON parsing.
 * @param {string} url - O endpoint da API (ex: '/api/produtos')
 * @param {object} [options={}] - Opções do Fetch (method, body, etc.)
 * @param {boolean} [expectBlob=false] - Definir como true se a resposta esperada for um arquivo (blob).
 * @returns {Promise<any>} - A resposta JSON (ou blob) da API.
 */
async function apiFetch(url, options = {}, expectBlob = false) {
    const token = localStorage.getItem('accessToken');
    if (!token) {
        window.location.href = '/login';
        throw new Error('Sessão expirada (sem token).');
    }

    const headers = { 'Authorization': `Bearer ${token}`, ...options.headers };
    
    // Adiciona Content-Type automaticamente para JSON string
    if (options.body && typeof options.body === 'string') {
        headers['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(url, { ...options, headers });

        if (response.status === 401) {
            localStorage.removeItem('accessToken');
            window.location.href = '/login';
            throw new Error('Sessão expirada.');
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: response.statusText }));
            const errorMessage = errorData.detail || `Erro ${response.status}`;
            // Exibe o erro no toast automaticamente
            showToast(errorMessage, true); 
            throw new Error(errorMessage);
        }

        if (expectBlob) {
            return response.blob();
        }

        if (response.status === 204 || response.headers.get("content-length") === "0") {
            return null; // Retorna null para "No Content" ou corpo vazio
        }

        return response.json();

    } catch (error) {
        // Se o erro não for 'Sessão expirada' (já tratado), exibe-o.
        if (error.message !== 'Sessão expirada.') {
             console.error('Erro na API Fetch:', error);
        }
        throw error; // Re-lança para que a chamada original saiba que falhou
    }
}

/**
 * Formata um número para o padrão de moeda BRL (Reais).
 * @param {number | string} valor - O valor a ser formatado.
 * @returns {string} - O valor formatado (ex: "R$ 1.234,56").
 */
const formatarBRL = (valor) => {
    const numero = Number(valor) || 0;
    return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

/**
 * Armazena o usuário logado para evitar fetches repetidos.
 * Esta variável é preenchida pelo nav.js.
 */
window.appState = {
    currentUser: null
};
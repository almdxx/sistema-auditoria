// FILE: frontend/signup.js
// (Versão ATUALIZADA - Adicionada validação minlength=8)

document.addEventListener('DOMContentLoaded', () => {
    // Pega os elementos do formulário
    const signupForm = document.getElementById('signup-form');
    const companyNameInput = document.getElementById('company-name');
    const adminEmailInput = document.getElementById('admin-email');
    const adminPasswordInput = document.getElementById('admin-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const signupButton = document.getElementById('signup-button');
    const spinner = signupButton.querySelector('.spinner-border');
    const errorMessageDiv = document.getElementById('error-message');
    const passwordMismatchDiv = document.getElementById('password-mismatch');
    const passwordShortDiv = document.getElementById('password-short'); // Pega o novo div

    // Listener para o envio do formulário
    signupForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Impede o envio padrão

        // Limpa erros anteriores
        errorMessageDiv.classList.add('d-none');
        passwordMismatchDiv.classList.add('d-none');
        passwordShortDiv.classList.add('d-none'); // Esconde erro de senha curta

        // Pega os valores dos campos
        const companyName = companyNameInput.value.trim();
        const adminEmail = adminEmailInput.value.trim();
        const adminPassword = adminPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // Validação 1: Campos preenchidos
        if (!companyName || !adminEmail || !adminPassword || !confirmPassword) {
            errorMessageDiv.textContent = 'Por favor, preencha todos os campos.';
            errorMessageDiv.className = 'alert alert-danger'; // Garante que é vermelho
            errorMessageDiv.classList.remove('d-none');
            return;
        }

        // Validação 2: Senha curta (NOVA)
        if (adminPassword.length < 8) {
            passwordShortDiv.classList.remove('d-none'); // Mostra erro específico
            adminPasswordInput.focus(); // Foca no campo da senha
            return;
        }

        // Validação 3: Senhas coincidem
        if (adminPassword !== confirmPassword) {
            passwordMismatchDiv.classList.remove('d-none');
            confirmPasswordInput.focus();
            return;
        }

        // Mostra loading no botão
        signupButton.disabled = true;
        spinner.classList.remove('d-none');
        // Acessa o nó de texto para mudar o texto sem quebrar o spinner
        signupButton.childNodes[signupButton.childNodes.length-1].textContent = " Criando Conta...";

        // Prepara os dados para enviar à API
        const payload = {
            nome_empresa: companyName,
            admin_email: adminEmail,
            admin_password: adminPassword
        };

        try {
            // Chamada à API (sem usar apiFetch global, pois é público)
            const response = await fetch('/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.detail || `Erro ${response.status}`);
            }

            // Sucesso
            errorMessageDiv.textContent = 'Conta criada com sucesso! Redirecionando para o login...';
            errorMessageDiv.className = 'alert alert-success'; // Muda para verde
            errorMessageDiv.classList.remove('d-none');

            // Redireciona para login após 2 segundos
            setTimeout(() => { window.location.href = '/login'; }, 2000);

        } catch (error) {
            // Erro
            console.error('Erro no cadastro:', error);
            errorMessageDiv.textContent = error.message;
            errorMessageDiv.className = 'alert alert-danger'; // Garante que é vermelho
            errorMessageDiv.classList.remove('d-none');

            // Reseta o botão
            signupButton.disabled = false;
            spinner.classList.add('d-none');
            signupButton.childNodes[signupButton.childNodes.length-1].textContent = " Criar Conta";
        }
    });
});
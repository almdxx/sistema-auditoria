document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('accessToken')) {
        window.location.href = '/';
    }

    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    const loginButton = document.getElementById('login-button');

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMessage.classList.add('d-none');
        loginButton.disabled = true;
        loginButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Entrando...';

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        try {
            const response = await fetch('/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Usuário ou senha inválidos.');
            }

            const data = await response.json();
            localStorage.setItem('accessToken', data.access_token);
            window.location.href = '/';

        } catch (error) {
            errorMessage.textContent = error.message;
            errorMessage.classList.remove('d-none');
        } finally {
            loginButton.disabled = false;
            loginButton.innerHTML = 'Entrar';
        }
    });
});
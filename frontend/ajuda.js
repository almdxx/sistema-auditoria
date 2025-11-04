document.addEventListener('DOMContentLoaded', () => {
    
    // Funcionalidade 1: Abrir item do FAQ via URL
    // Permite criar links como /ajuda.html#faq-criar
    const hash = window.location.hash;
    if (hash) {
        const targetCollapse = document.querySelector(hash);
        if (targetCollapse) {
            const bsCollapse = new bootstrap.Collapse(targetCollapse, {
                toggle: true
            });
        }
    }

    // Funcionalidade 2: Botão de copiar email
    const copyButton = document.getElementById('btn-copy-email');
    const emailInput = document.getElementById('email-contato');
    
    if (copyButton && emailInput) {
        copyButton.addEventListener('click', () => {
            const email = emailInput.value;
            navigator.clipboard.writeText(email).then(() => {
                // Feedback visual para o usuário
                const originalText = copyButton.innerHTML;
                copyButton.innerHTML = '<i class="bi bi-check-lg"></i> Copiado!';
                copyButton.classList.add('btn-success');
                copyButton.classList.remove('btn-outline-secondary');
                
                setTimeout(() => {
                    copyButton.innerHTML = originalText;
                    copyButton.classList.remove('btn-success');
                    copyButton.classList.add('btn-outline-secondary');
                }, 2000); // Volta ao normal depois de 2 segundos
            }).catch(err => {
                console.error('Erro ao copiar email: ', err);
                alert('Não foi possível copiar o email.');
            });
        });
    }
});
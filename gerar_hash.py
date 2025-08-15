# FILE: gerar_hash.py

from security import get_password_hash

print("--- Gerador de Hash de Senha ---")
print("Este script cria a versão criptografada (hash) de uma senha para ser inserida no banco de dados.")

username_input = input("Digite o nome do usuário (ex: admin): ")
password_input = input("Digite a senha que deseja para este usuário: ")

if not username_input or not password_input:
    print("\nERRO: Nome de usuário e senha não podem ser vazios.")
else:
    hashed_password = get_password_hash(password_input)
    print("\n--- RESULTADO ---")
    print(f"Usuário: {username_input}")
    print(f"Senha Criptografada (Hash): {hashed_password}")
    print("\nCOPIE o valor da 'Senha Criptografada' e cole na coluna 'hashed_password' do seu banco de dados via pgAdmin.")
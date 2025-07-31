# FILE: services/varejonline_service.py (VERSÃO FINAL E ATUALIZADA)

import requests
import os
from dotenv import load_dotenv
from typing import List, Dict, Any, Tuple, Optional

load_dotenv()

class VarejonlineService:
    def __init__(self):
        self.base_url = os.getenv("VAREJONLINE_BASE_URL", "https://integrador.varejonline.com.br")
        self.access_token = os.getenv("VAREJONLINE_ACCESS_TOKEN")
        if not self.access_token:
            raise ValueError("Token de acesso do Varejonline não encontrado no arquivo .env")

    def obter_produtos(self, alterado_apos: Optional[str] = None) -> Tuple[List[Dict[str, Any]], str]:
        """
        Busca produtos da API, usando o filtro alteradoApos se fornecido.
        """
        todos_produtos_api = []
        inicio = 0
        quantidade_por_pagina = 300
        endpoint = f"{self.base_url}/apps/api/produtos"

        print(f">>> INICIANDO SINCRONIZAÇÃO DE PRODUTOS...")
        if alterado_apos:
            print(f">>> Buscando apenas produtos alterados após: {alterado_apos}")
        else:
            print(">>> Buscando TODOS os produtos (primeira sincronização).")

        while True:
            params = {
                "token": self.access_token,
                "inicio": inicio,
                "quantidade": quantidade_por_pagina
            }
            if alterado_apos:
                params["alteradoApos"] = alterado_apos
            
            try:
                print(f"...Buscando página com início em {inicio}...")
                response = requests.get(endpoint, params=params, timeout=120)
                response.raise_for_status()
                dados_pagina_atual = response.json()

                if not dados_pagina_atual:
                    print("...Página vazia recebida. Fim da sincronização.")
                    break
                
                todos_produtos_api.extend(dados_pagina_atual)
                inicio += quantidade_por_pagina

            except requests.exceptions.HTTPError as http_err:
                error_text = http_err.response.text if http_err.response else "Sem resposta do servidor"
                print(f"!!! ERRO HTTP: {http_err} - {error_text}")
                return [], f"Erro na API: {error_text}"
            except Exception as e:
                print(f"!!! ERRO Inesperado: {e}")
                return [], f"Erro inesperado: {e}"
        
        produtos_formatados = []
        for item in todos_produtos_api:
            grupo = item.get("nome_grupo", "Sem Grupo")
            if item.get("categorias"):
                for categoria in item.get("categorias", []):
                    if categoria.get("nivel") == "GRUPO":
                        grupo = categoria.get("nome")
                        break
            produtos_formatados.append({
                "nome_item": item.get('descricao', 'Nome Indisponível'),
                "grupo": grupo
            })
            
        return produtos_formatados, None
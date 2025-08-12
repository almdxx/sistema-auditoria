import requests
import os
from dotenv import load_dotenv
from typing import List, Dict, Any, Tuple, Optional

load_dotenv()

class VarejonlineService:
    """Serviço para interagir com a API do Varejonline."""
    def __init__(self):
        self.base_url = os.getenv("VAREJONLINE_BASE_URL")
        self.access_token = os.getenv("VAREJONLINE_ACCESS_TOKEN")
        if not self.base_url or not self.access_token:
            raise ValueError("Credenciais do Varejonline (URL e Token) não encontradas no arquivo .env")

    def obter_produtos(self, alterado_apos: Optional[str] = None) -> Tuple[List[Dict[str, Any]], str]:
        """Busca produtos da API Varejonline, usando paginação."""
        todos_produtos_api = []
        inicio = 0
        quantidade_por_pagina = 500
        endpoint = f"{self.base_url}/apps/api/produtos"

        print(">>> INICIANDO SINCRONIZAÇÃO DE PRODUTOS DO VAREJONLINE...")
        
        while True:
            params = {
                "token": self.access_token,
                "inicio": inicio,
                "quantidade": quantidade_por_pagina,
            }
            if alterado_apos:
                params["alteradoApos"] = alterado_apos
            
            try:
                response = requests.get(endpoint, params=params, timeout=120)
                response.raise_for_status()
                dados_pagina_atual = response.json()

                if not dados_pagina_atual:
                    break
                
                todos_produtos_api.extend(dados_pagina_atual)
                inicio += quantidade_por_pagina

            except requests.exceptions.HTTPError as http_err:
                msg = f"Erro HTTP na API Varejonline: {http_err}"
                print(f"!!! {msg}")
                return [], msg
            except Exception as e:
                msg = f"Erro inesperado ao buscar produtos: {e}"
                print(f"!!! {msg}")
                return [], msg
        
        print(">>> SINCRONIZAÇÃO CONCLUÍDA.")
        
        # Formata a saída para o padrão do nosso sistema
        produtos_formatados = []
        for item in todos_produtos_api:
            grupo = next(
                (cat.get("nome") for cat in item.get("categorias", []) if cat.get("nivel") == "GRUPO"), 
                item.get("nome_grupo", "Sem Grupo")
            )
            produtos_formatados.append({
                "nome_item": item.get('descricao', 'Nome Indisponível'),
                "grupo": grupo
            })
            
        return produtos_formatados, None
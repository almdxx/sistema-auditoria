#!/usr/bin/env sh
# FILE: run.sh

# Inicia o servidor Uvicorn, escutando em todas as interfaces de rede na porta 10000
uvicorn main:app --host 0.0.0.0 --port 10000 --workers 1
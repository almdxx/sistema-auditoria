#!/usr/-bin/env sh

# Adiciona a opção --workers 1 para melhor estabilidade
uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1
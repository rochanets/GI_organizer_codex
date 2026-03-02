# GI Organizer Manus

Sistema web (glass style) para gerenciar Farm, Teams, Sorteio e Parametrização do Genshin Impact.

## Como rodar no Windows (recomendado)

1. Execute `install_dependencies.bat` para preparar o ambiente.
2. Execute `run_app.bat` para subir a aplicação.

## Como rodar manualmente

```bash
python3 app.py
```

Aplicação sobe em `http://localhost:4321` (porta diferente da 3000).

## Banco de dados

- Windows: `C:\GI_codex\gi_organizer.db`
- Linux/macOS (modo compatível): `./C/GI_codex/gi_organizer.db`

A pasta é criada automaticamente caso não exista.

## Dependências

O projeto mantém o arquivo `requirements.txt` para padronizar setup/testes, mesmo sem bibliotecas externas obrigatórias no momento.

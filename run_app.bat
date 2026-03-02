@echo off
setlocal

if not exist .venv (
  echo Ambiente virtual nao encontrado. Execute install_dependencies.bat primeiro.
  exit /b 1
)

call .venv\Scripts\activate

echo Iniciando GI Organizer Manus em http://localhost:4321
python app.py

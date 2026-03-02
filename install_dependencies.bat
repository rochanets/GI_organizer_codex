@echo off
setlocal

echo [1/4] Verificando Python...
python --version >nul 2>&1
if errorlevel 1 (
  echo Python nao encontrado no PATH. Instale Python 3.10+ e tente novamente.
  exit /b 1
)

echo [2/4] Criando ambiente virtual (.venv)...
if not exist .venv (
  python -m venv .venv
)

echo [3/4] Atualizando pip...
call .venv\Scripts\activate
python -m pip install --upgrade pip

echo [4/4] Instalando requirements...
pip install -r requirements.txt

if errorlevel 1 (
  echo Falha na instalacao de dependencias.
  exit /b 1
)

echo.
echo Ambiente configurado com sucesso.
echo Para iniciar: run_app.bat
exit /b 0

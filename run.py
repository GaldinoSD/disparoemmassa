import subprocess
import sys
import os

def install_dependencies():
    print("================ ZAPFLOW BOOTSTRAP ================")
    print("Verificando dependencias do sistema...")
    try:
        import fastapi
        import uvicorn
        import sqlalchemy
        import requests
        print("[ OK ] Todas as dependencias ja estao instaladas.")
    except ImportError:
        print("Instalando dependencias ausentes do requirements.txt via pip...")
        try:
            # Forçar codificação UTF-8 ou usar subprocess
            import subprocess
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
            print("[ OK ] Dependencias instaladas com sucesso!")
        except Exception as e:
            print(f"[ ERRO ] Erro ao instalar dependencias: {e}")
            print("Por favor, instale manualmente rodando: pip install -r requirements.txt")
            sys.exit(1)

def start_server():
    print("\n================ INICIANDO SERVIDOR ================")
    print("Iniciando ZapFlow Full-Stack em http://localhost:8000")
    print("Acesse http://localhost:8000/docs para a documentacao da API Swagger.")
    print("Pressione CTRL+C para encerrar o servidor.")
    print("====================================================\n")
    
    try:
        import uvicorn
        # Executar uvicorn programaticamente
        uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
    except Exception as e:
        print(f"[ ERRO ] Erro ao iniciar servidor Uvicorn: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Garantir que o diretório de trabalho é o diretório deste script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    install_dependencies()
    start_server()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import requests

from backend.database import engine, Base
from backend.routes import auth, instance, campaign, logs, whatsapp, visual

# Inicializa as tabelas do banco SQLite se não existirem
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ZapFlow API",
    description="Backend profissional de disparo em massa para WhatsApp",
    version="1.0.0"
)

# Configuração de CORS (Cross-Origin Resource Sharing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar as rotas modulares do Backend
app.include_router(auth.router)
app.include_router(instance.router)
app.include_router(campaign.router)
app.include_router(logs.router)
app.include_router(whatsapp.router)
app.include_router(visual.router)

# Rota de Status simples
@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "ZapFlow Server"}

# Proxy para obter o clima de Seropédica
@app.get("/api/weather")
def get_weather():
    try:
        res = requests.get(
            "https://api.open-meteo.com/v1/forecast?latitude=-22.7486&longitude=-43.7081&current_weather=true",
            timeout=5
        )
        if res.status_code == 200:
            data = res.json()
            if "current_weather" in data:
                return data
        
        # Fallback realista de Seropédica se a API externa responder sem o clima
        return {
            "current_weather": {
                "temperature": 23.0,
                "weathercode": 2,
                "is_fallback": True
            }
        }
    except Exception as e:
        # Fallback realista de Seropédica se houver erro de conexão (DNS, SSL, timeout)
        return {
            "current_weather": {
                "temperature": 23.0,
                "weathercode": 2,
                "is_fallback": True
            }
        }

frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")

# Rotas de SPA para servir index.html nas abas corretas (evita 404 em F5/recarga)
@app.get("/dashboard")
@app.get("/api")
@app.get("/disparos")
@app.get("/historico")
@app.get("/conversas")
@app.get("/config")
def serve_spa():
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": "Frontend shell index.html not found"}

# Servir os arquivos estáticos do Frontend na raiz
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
else:
    print(f"Alerta: Pasta do Frontend não encontrada em '{frontend_dir}'")

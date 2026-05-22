from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import requests
from backend.database import get_db
from backend.models.db_models import APIConfigModel
from backend.models.schemas import APIConfigSchema

router = APIRouter(prefix="/api/instance", tags=["Evolution API"])

# Obter configurações salvas
@router.get("")
def get_config(db: Session = Depends(get_db)):
    config = db.query(APIConfigModel).first()
    if not config:
        return {"url": "", "key": "", "instance": "", "token": ""}
    return {
        "url": config.url,
        "key": config.key,
        "instance": config.instance,
        "token": config.token
    }

# Salvar configurações
@router.post("")
def save_config(payload: APIConfigSchema, db: Session = Depends(get_db)):
    config = db.query(APIConfigModel).first()
    if not config:
        config = APIConfigModel(
            url=payload.url,
            key=payload.key,
            instance=payload.instance,
            token=payload.token
        )
        db.add(config)
    else:
        config.url = payload.url
        config.key = payload.key
        config.instance = payload.instance
        config.token = payload.token
    
    db.commit()
    db.refresh(config)
    return {"status": "success", "message": "Configurações salvas no banco de dados."}

# PROXY: Checar conexão da Evolution API
@router.get("/connection-state")
def connection_state(db: Session = Depends(get_db)):
    config = db.query(APIConfigModel).first()
    if not config or not config.url or not config.instance:
        return {"connected": False, "state": "disconnected", "message": "Sem configurações salvas."}
    
    # Se for mock ou demo, simular
    if "demo" in config.url.lower() or config.key == "admin":
        return {"connected": True, "state": "open"}

    try:
        url = f"{config.url.rstrip('/')}/instance/connectionState/{config.instance}"
        headers = {"apikey": config.key}
        res = requests.get(url, headers=headers, timeout=6)
        if res.status_code == 200:
            data = res.json()
            is_open = data.get("instance", {}).get("state") == "open"
            return {"connected": is_open, "state": data.get("instance", {}).get("state", "disconnected")}
        else:
            return {"connected": False, "state": "disconnected", "error": f"Evolution API HTTP {res.status_code}"}
    except Exception as e:
        print(f"Erro ao conectar na Evolution API real: {e}.")
        return {"connected": False, "state": "disconnected", "error": str(e)}

# PROXY: Criar Instância
@router.post("/create")
def create_instance(db: Session = Depends(get_db)):
    config = db.query(APIConfigModel).first()
    if not config or not config.url:
        raise HTTPException(status_code=400, detail="Configurações ausentes.")
    
    if "demo" in config.url.lower() or config.key == "admin":
        return {"hash": {"apikey": "simulated-instance-token-123456"}}

    try:
        url = f"{config.url.rstrip('/')}/instance/create"
        headers = {"apikey": config.key, "Content-Type": "application/json"}
        payload = {
            "instanceName": config.instance,
            "qrcode": True
        }
        if config.token:
            payload["token"] = config.token

        res = requests.post(url, headers=headers, json=payload, timeout=10)
        if res.status_code in [200, 201]:
            data = res.json()
            apikey = data.get("hash", {}).get("apikey", "")
            if apikey:
                config.token = apikey
                db.commit()
            return data
        else:
            raise HTTPException(status_code=res.status_code, detail=f"Evolution API Error on create: {res.text}")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=502, detail=f"Erro de rede ao criar instância: {str(e)}")

# PROXY: Buscar QR Code
@router.get("/connect")
def connect_qrcode(db: Session = Depends(get_db)):
    config = db.query(APIConfigModel).first()
    if not config or not config.url:
        raise HTTPException(status_code=400, detail="Configurações ausentes.")
    
    if "demo" in config.url.lower() or config.key == "admin":
        return {"code": "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=ZapFlowSimulated", "simulated": True}

    try:
        url = f"{config.url.rstrip('/')}/instance/connect/{config.instance}"
        headers = {"apikey": config.key}
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code == 200:
            return res.json()
        else:
            raise HTTPException(status_code=res.status_code, detail=f"Evolution API Error on connect: {res.text}")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=502, detail=f"Erro de rede ao buscar QR code: {str(e)}")

# PROXY: Enviar mensagem
@router.post("/send-message")
def send_message(payload: dict, db: Session = Depends(get_db)):
    config = db.query(APIConfigModel).first()
    if not config or not config.url:
        raise HTTPException(status_code=400, detail="Configurações ausentes.")
    
    phone = payload.get("number")
    text = payload.get("text")

    if "demo" in config.url.lower() or config.key == "admin":
        return {"status": "success", "simulated": True}

    try:
        url = f"{config.url.rstrip('/')}/message/sendText/{config.instance}"
        headers = {"apikey": config.key, "Content-Type": "application/json"}
        body = {
            "number": phone,
            "text": text,
            "delay": 1200
        }
        res = requests.post(url, headers=headers, json=body, timeout=12)
        if res.status_code in [200, 201]:
            return {"status": "success"}
        else:
            raise HTTPException(status_code=res.status_code, detail=f"Evolution API error: {res.text}")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=502, detail=f"Erro de conexão com Evolution API: {str(e)}")

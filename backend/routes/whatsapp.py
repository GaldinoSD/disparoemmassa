from fastapi import APIRouter, Depends, HTTPException, Form, File, UploadFile
from sqlalchemy.orm import Session
import requests
import time
from typing import Optional
from backend.database import get_db
from backend.models.db_models import APIConfigModel

router = APIRouter(prefix="/api/whatsapp", tags=["WhatsApp Chats"])

# MOCK DATA fallback for demo mode or connection errors
SIMULATED_CHATS = []

SIMULATED_MESSAGES = {}


@router.get("/chats")
def get_chats(db: Session = Depends(get_db)):
    config = db.query(APIConfigModel).first()
    
    # Se estiver em modo demonstração ou configurações ausentes
    if not config or not config.url or "demo" in config.url.lower() or config.key == "admin":
        return {"success": True, "chats": SIMULATED_CHATS}
        
    try:
        url = f"{config.url.rstrip('/')}/chat/findChats/{config.instance}"
        headers = {
            "apikey": config.key,
            "Content-Type": "application/json"
        }
        res = requests.post(url, headers=headers, json={}, timeout=8)
        if res.status_code in [200, 201]:
            chats = res.json()
            normalized_chats = []
            for c in chats:
                # O remoteJid é o identificador real do WhatsApp (ex: number@s.whatsapp.net ou group@g.us)
                jid = c.get("remoteJid") or c.get("id") or ""
                if jid:
                    c["id"] = jid
                    normalized_chats.append(c)
            return {"success": True, "chats": normalized_chats}
        else:
            raise HTTPException(status_code=res.status_code, detail=f"Erro ao buscar chats: {res.text}")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=502, detail=f"Erro de conexão com Evolution API: {str(e)}")


@router.get("/messages")
def get_messages(number: str, db: Session = Depends(get_db)):
    config = db.query(APIConfigModel).first()
    
    # Normalização de número para simular chaves corretas
    normalized_number = number
    if "@" not in normalized_number:
        normalized_number = f"{normalized_number}@s.whatsapp.net"
        
    # Se estiver em modo demonstração ou configurações ausentes
    if not config or not config.url or "demo" in config.url.lower() or config.key == "admin":
        return {"success": True, "messages": SIMULATED_MESSAGES.get(normalized_number, [])}
        
    try:
        url = f"{config.url.rstrip('/')}/chat/findMessages/{config.instance}"
        headers = {"apikey": config.key, "Content-Type": "application/json"}
        payload = {
            "where": {
                "key": {
                    "remoteJid": normalized_number
                }
            },
            "limit": 50
        }
        res = requests.post(url, headers=headers, json=payload, timeout=8)
        if res.status_code in [200, 201]:
            data = res.json()
            messages_list = []
            if isinstance(data, list):
                messages_list = data
            elif isinstance(data, dict):
                inner = data.get("messages") or data
                if isinstance(inner, dict):
                    messages_list = inner.get("records") or []
                elif isinstance(inner, list):
                    messages_list = inner
            return {"success": True, "messages": messages_list}
        else:
            raise HTTPException(status_code=res.status_code, detail=f"Erro ao buscar mensagens: {res.text}")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=502, detail=f"Erro de conexão com Evolution API: {str(e)}")


@router.post("/chat/send")
def send_chat_message(
    number: str = Form(...),
    message: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    config = db.query(APIConfigModel).first()
    
    normalized_number = number
    if "@" not in normalized_number:
        normalized_number = f"{normalized_number}@s.whatsapp.net"
        
    # Se estiver em modo demonstração ou configurações ausentes
    if not config or not config.url or "demo" in config.url.lower() or config.key == "admin":
        # Salva localmente na simulação temporária para atualizar a tela do usuário em tempo real
        if normalized_number not in SIMULATED_MESSAGES:
            SIMULATED_MESSAGES[normalized_number] = []
            
        new_msg = {
            "key": {"fromMe": True, "remoteJid": normalized_number},
            "pushName": "Admin",
            "message": {},
            "messageTimestamp": int(time.time())
        }
        
        if file:
            new_msg["message"] = {
                "documentMessage": {
                    "fileName": file.filename,
                    "caption": message or "",
                    "mimetype": file.content_type
                }
            }
        else:
            new_msg["message"] = {"conversation": message or ""}
            
        SIMULATED_MESSAGES[normalized_number].append(new_msg)
        return {"success": True, "simulated": True}
        
    try:
        headers = {"apikey": config.key}
        
        # Envio de mídia
        if file:
            url = f"{config.url.rstrip('/')}/message/sendMedia/{config.instance}"
            
            # Determina o mediaType
            mimetype = file.content_type or ""
            media_type = "document"
            if mimetype.startswith("image/"):
                media_type = "image"
            elif mimetype.startswith("video/"):
                media_type = "video"
            elif mimetype.startswith("audio/"):
                media_type = "audio"
                
            # Ler bytes do arquivo
            file_bytes = file.file.read()
            
            files = {
                "file": (file.filename, file_bytes, mimetype)
            }
            data = {
                "number": normalized_number,
                "caption": message or "",
                "mediaType": media_type
            }
            
            res = requests.post(url, headers=headers, data=data, files=files, timeout=15)
            if res.status_code in [200, 201]:
                return {"success": True}
            else:
                raise HTTPException(status_code=res.status_code, detail=f"Erro Evolution API sendMedia: {res.text}")
                
        # Envio de mensagem simples (texto)
        else:
            url = f"{config.url.rstrip('/')}/message/sendText/{config.instance}"
            headers["Content-Type"] = "application/json"
            body = {
                "number": normalized_number,
                "text": message or "",
                "delay": 1200
            }
            res = requests.post(url, headers=headers, json=body, timeout=10)
            if res.status_code in [200, 201]:
                return {"success": True}
            else:
                raise HTTPException(status_code=res.status_code, detail=f"Erro Evolution API sendText: {res.text}")
                
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=502, detail=f"Erro de rede ao enviar mensagem: {str(e)}")


@router.get("/groups")
def get_groups(db: Session = Depends(get_db)):
    """Lista todos os grupos do WhatsApp pareado via Evolution API de forma extremamente rápida."""
    config = db.query(APIConfigModel).first()

    # Se estiver em modo demonstração ou configurações ausentes
    if not config or not config.url or "demo" in config.url.lower() or config.key == "admin":
        return {"success": True, "groups": []}

    try:
        url = f"{config.url.rstrip('/')}/chat/findChats/{config.instance}"
        headers = {
            "apikey": config.key,
            "Content-Type": "application/json"
        }
        # findChats é leve, instantâneo e não sofre de timeouts ou erros de validação de query
        res = requests.post(url, headers=headers, json={}, timeout=10)
        if res.status_code in [200, 201]:
            raw_chats = res.json()
            groups = []
            for c in raw_chats:
                jid = c.get("remoteJid") or c.get("id") or ""
                if jid.endswith("@g.us"):
                    groups.append({
                        "id": jid,
                        "subject": c.get("name") or c.get("pushName") or "Grupo sem nome",
                        "size": c.get("size", 0),
                        "creation": c.get("creation", 0),
                    })
            return {"success": True, "groups": groups}
        else:
            raise HTTPException(status_code=res.status_code, detail=f"Erro Evolution API findChats: {res.text}")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=502, detail=f"Erro de conexão ao buscar grupos: {str(e)}")


@router.get("/groups/{group_id}/participants")
def get_group_participants(group_id: str, db: Session = Depends(get_db)):
    """Lista os participantes de um grupo específico do WhatsApp com fallback robusto."""
    config = db.query(APIConfigModel).first()

    # Se estiver em modo demonstração ou configurações ausentes
    if not config or not config.url or "demo" in config.url.lower() or config.key == "admin":
        return {"success": True, "participants": []}

    # 0. Buscar contatos salvos para mapeamento inteligente de nomes
    push_names_map = {}
    local_names_map = {}
    try:
        url_contacts = f"{config.url.rstrip('/')}/chat/findContacts/{config.instance}"
        headers_contacts = {"apikey": config.key, "Content-Type": "application/json"}
        # findContacts é instantâneo e retorna o cache completo de contatos pareados
        res_contacts = requests.post(url_contacts, headers=headers_contacts, json={}, timeout=10)
        if res_contacts.status_code == 200:
            contacts_list = res_contacts.json()
            for c in contacts_list:
                jid = c.get("remoteJid") or c.get("id") or ""
                phone = jid.split("@")[0]
                if phone:
                    push = c.get("pushName")
                    local = c.get("name")
                    if push:
                        push_names_map[phone] = push
                    if local:
                        local_names_map[phone] = local
    except Exception as e:
        print(f"Erro ao buscar contatos para mapeamento de nomes: {e}")

    errors = []

    # Método 1: Tentar o endpoint direto de participantes
    try:
        url = f"{config.url.rstrip('/')}/group/participants/{config.instance}"
        headers = {"apikey": config.key, "Content-Type": "application/json"}
        params = {"groupJid": group_id}
        res = requests.get(url, headers=headers, params=params, timeout=18)
        if res.status_code == 200:
            data = res.json()
            participants_raw = data if isinstance(data, list) else data.get("participants", [])
            participants = []
            for p in participants_raw:
                # Preferir phoneNumber para evitar puxar o ID temporário do @lid se possível
                jid = p.get("phoneNumber") or p.get("id") or ""
                if not jid:
                    continue
                phone = jid.split("@")[0]
                if phone:
                    resolved_name = p.get("pushName") or push_names_map.get(phone) or p.get("name") or local_names_map.get(phone) or ""
                    participants.append({
                        "id": jid,
                        "phone": phone,
                        "name": resolved_name,
                        "admin": p.get("admin", None)
                    })
            return {"success": True, "participants": participants}
        else:
            errors.append(f"Método 1 (/group/participants) retornou {res.status_code}: {res.text}")
    except Exception as e:
        errors.append(f"Método 1 (/group/participants) falhou com erro: {str(e)}")
        print(f"Erro no endpoint de participantes direto, tentando findGroupInfos: {e}")

    # Método 2 (Fallback Rápido e Seguro): Buscar informações específicas do grupo via findGroupInfos
    try:
        url = f"{config.url.rstrip('/')}/group/findGroupInfos/{config.instance}"
        headers = {"apikey": config.key}
        params = {"groupJid": group_id}
        res = requests.get(url, headers=headers, params=params, timeout=18)
        if res.status_code == 200:
            data = res.json()
            participants_raw = data.get("participants", [])
            participants = []
            for p in participants_raw:
                jid = p.get("phoneNumber") or p.get("id") or ""
                if not jid:
                    continue
                phone = jid.split("@")[0]
                if phone:
                    resolved_name = p.get("pushName") or push_names_map.get(phone) or p.get("name") or local_names_map.get(phone) or ""
                    participants.append({
                        "id": jid,
                        "phone": phone,
                        "name": resolved_name,
                        "admin": p.get("admin", None)
                    })
            return {"success": True, "participants": participants}
        else:
            errors.append(f"Método 2 (/group/findGroupInfos) retornou {res.status_code}: {res.text}")
    except Exception as e:
        errors.append(f"Método 2 (/group/findGroupInfos) falhou com erro: {str(e)}")
        print(f"Erro no endpoint findGroupInfos: {e}")

    # Se ambos falharem, reporta o erro limpo detalhado
    error_details = "; ".join(errors)
    raise HTTPException(
        status_code=502,
        detail=f"Não foi possível obter participantes do grupo. Detalhes: {error_details}"
    )




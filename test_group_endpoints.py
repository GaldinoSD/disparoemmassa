import sqlite3
import requests
import json

def test():
    conn = sqlite3.connect("zapflow.db")
    cursor = conn.cursor()
    cursor.execute("SELECT url, key, instance, token FROM api_configs LIMIT 1")
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        print("Nenhuma configuracao encontrada no banco.")
        return
        
    url, key, instance, token = row
    print(f"Configuracao encontrada:")
    print(f"URL: {url}")
    print(f"Key: {key[:5]}...")
    print(f"Instance: {instance}")
    
    headers = {"apikey": key, "Content-Type": "application/json"}
    
    # 1. Buscar um grupo ativo
    print("\n--- Buscando um grupo de WhatsApp ativo ---")
    u_chats = f"{url.rstrip('/')}/chat/findChats/{instance}"
    try:
        res = requests.post(u_chats, headers=headers, json={}, timeout=10)
        if res.status_code not in [200, 201]:
            print(f"Erro ao buscar chats: {res.status_code} - {res.text}")
            return
        chats = res.json()
        group_id = None
        for c in chats:
            jid = c.get("remoteJid") or c.get("id") or ""
            if jid.endswith("@g.us"):
                group_id = jid
                subject = c.get("name") or c.get("pushName") or "Grupo"
                print(f"Grupo encontrado para teste: {subject} ({group_id})")
                break
        
        if not group_id:
            print("Nenhum grupo ativo encontrado nos chats recentes.")
            return
            
    except Exception as e:
        print(f"Erro ao buscar chats: {e}")
        return

    # 2. Testar GET /group/participants/{instance}?groupJid={group_id}
    print(f"\n--- Testando GET /group/participants/{instance}?groupJid={group_id} ---")
    u_part = f"{url.rstrip('/')}/group/participants/{instance}"
    try:
        res = requests.get(u_part, headers=headers, params={"groupJid": group_id}, timeout=10)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text[:1000]}")
    except Exception as e:
        print(f"Erro: {e}")

    # 3. Testar GET /group/findGroupInfos/{instance}?groupJid={group_id}
    print(f"\n--- Testando GET /group/findGroupInfos/{instance}?groupJid={group_id} ---")
    u_info = f"{url.rstrip('/')}/group/findGroupInfos/{instance}"
    try:
        res = requests.get(u_info, headers=headers, params={"groupJid": group_id}, timeout=10)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text[:1000]}")
    except Exception as e:
        print(f"Erro: {e}")

if __name__ == "__main__":
    test()

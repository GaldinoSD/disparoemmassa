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
        print("Nenhuma configuracao encontrada.")
        return
        
    url, key, instance, token = row
    headers = {"apikey": key}
    u = f"{url.rstrip('/')}/group/fetchAllGroups/{instance}"
    
    print("--- Testando fetchAllGroups com timeout de 35s ---")
    
    # 1. Com getParticipants como boolean em params (requests passa getParticipants=True)
    print("\n1. Testando params={'getParticipants': True}")
    try:
        res = requests.get(u, headers=headers, params={"getParticipants": True}, timeout=35)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text[:300]}")
    except Exception as e:
        print(f"Erro: {e}")
        
    # 2. Com getParticipants como string 'true' em params
    print("\n2. Testando params={'getParticipants': 'true'}")
    try:
        res = requests.get(u, headers=headers, params={"getParticipants": "true"}, timeout=35)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text[:300]}")
    except Exception as e:
        print(f"Erro: {e}")

    # 3. Com getParticipants hardcoded na URL ?getParticipants=true
    print("\n3. Testando URL manual com ?getParticipants=true")
    try:
        res = requests.get(f"{u}?getParticipants=true", headers=headers, timeout=35)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text[:300]}")
    except Exception as e:
        print(f"Erro: {e}")

    # 4. Com getParticipants hardcoded na URL ?getParticipants=false
    print("\n4. Testando URL manual com ?getParticipants=false")
    try:
        res = requests.get(f"{u}?getParticipants=false", headers=headers, timeout=35)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text[:300]}")
    except Exception as e:
        print(f"Erro: {e}")

if __name__ == "__main__":
    test()

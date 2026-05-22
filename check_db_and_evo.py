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
    
    headers = {"apikey": key}
    
    # Testar fetchAllGroups com params getParticipants=false
    print("\n--- Testando fetchAllGroups com params={'getParticipants': 'false'} ---")
    u1 = f"{url.rstrip('/')}/group/fetchAllGroups/{instance}"
    try:
        res = requests.get(u1, headers=headers, params={"getParticipants": "false"}, timeout=10)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text[:500]}")
    except Exception as e:
        print(f"Erro: {e}")

    # Testar fetchAllGroups com params getParticipants=true
    print("\n--- Testando fetchAllGroups com params={'getParticipants': 'true'} ---")
    try:
        res = requests.get(u1, headers=headers, params={"getParticipants": "true"}, timeout=10)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text[:500]}")
    except Exception as e:
        print(f"Erro: {e}")

    # Testar fetchAllGroups com query manual no URL ?getParticipants=true
    print("\n--- Testando fetchAllGroups com URL manual ?getParticipants=true ---")
    try:
        res = requests.get(f"{u1}?getParticipants=true", headers=headers, timeout=10)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text[:500]}")
    except Exception as e:
        print(f"Erro: {e}")

    # Testar fetchAllGroups com query manual no URL ?getParticipants=false
    print("\n--- Testando fetchAllGroups com URL manual ?getParticipants=false ---")
    try:
        res = requests.get(f"{u1}?getParticipants=false", headers=headers, timeout=10)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text[:500]}")
    except Exception as e:
        print(f"Erro: {e}")

if __name__ == "__main__":
    test()

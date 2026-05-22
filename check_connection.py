import sqlite3
import requests

def check():
    conn = sqlite3.connect("zapflow.db")
    cursor = conn.cursor()
    cursor.execute("SELECT url, key, instance FROM api_configs LIMIT 1")
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        print("Nenhuma configuracao encontrada.")
        return
        
    url, key, instance = row
    print(f"Configuração no DB:")
    print(f"URL: {url}")
    print(f"Key: {key}")
    print(f"Instance: {instance}")
    
    headers = {"apikey": key}
    u = f"{url.rstrip('/')}/instance/connectionState/{instance}"
    print(f"\nChamando: {u}")
    try:
        res = requests.get(u, headers=headers, timeout=10)
        print(f"Status Code: {res.status_code}")
        print(f"Headers: {res.headers}")
        print(f"Response: {res.text}")
    except Exception as e:
        print(f"Erro de rede: {e}")

if __name__ == "__main__":
    check()

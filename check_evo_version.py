import requests

def check_evolution():
    url = "http://72.60.5.20:8081"
    
    # 1. Test root / status / version
    print("--- Testando GET / ---")
    try:
        res = requests.get(url, timeout=5)
        print(f"Status: {res.status_code}")
        print(f"Headers: {res.headers}")
        print(f"Response: {res.text[:300]}")
    except Exception as e:
        print(f"Erro root: {e}")
        
    # 2. Test /docs
    print("\n--- Testando GET /docs ---")
    try:
        res = requests.get(f"{url}/docs", timeout=5)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text[:300]}")
    except Exception as e:
        print(f"Erro docs: {e}")

if __name__ == "__main__":
    check_evolution()

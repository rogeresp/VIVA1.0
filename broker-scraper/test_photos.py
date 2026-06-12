"""Testa o endpoint de fotos para varios imoveis."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import BASE_URL, LOGIN_URL, CREDENTIALS
import requests

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
})
resp = session.post(LOGIN_URL, data=CREDENTIALS, timeout=30)
assert resp.json().get("msg") == "login", "Login falhou"

# Test for imoveis with known photos
for pid in ["9950", "6866", "1221", "10543"]:
    resp = session.post(
        f"{BASE_URL}/index.php/imovel/imoveis/fotos",
        data={"imovel": pid},
        timeout=30
    )
    try:
        data = json.loads(resp.text)
        print(f"Imovel {pid}: {len(data)} fotos")
        for item in data[:3]:
            print(f"  {item['src']}")
        if len(data) > 3:
            print(f"  ... e mais {len(data)-3} fotos")
    except Exception as e:
        print(f"Imovel {pid}: ERRO ({e}) texto={resp.text[:200]}")

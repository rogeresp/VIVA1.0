"""Investiga como as fotos sao carregadas."""
import os, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import BASE_URL, LOGIN_URL, CREDENTIALS
import requests

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
})
resp = session.post(LOGIN_URL, data=CREDENTIALS, timeout=30)
assert resp.json().get("msg") == "login", "Login falhou"

# 1. Check listing page for photo URLs
print("=== FOTOS NA LISTAGEM ===")
url = f"{BASE_URL}/index.php/imovel/imoveis/read/venda/0/?imo_venda=venda&imo_registro=0&page=1"
resp = session.get(url, timeout=30)
# Find all background-image urls
bg_urls = re.findall(r'background-image:\s*url\(([^)]+)\)', resp.text)
print(f"Background image URLs: {len(bg_urls)}")
for u in bg_urls[:5]:
    print(f"  {u}")

# 2. Check the imovel/fotos page
print("\n=== PAGINA DE FOTOS ===")
resp = session.get(f"{BASE_URL}/index.php/imovel/imoveis/fotos", timeout=30)
print(f"Status: {resp.status_code}, Size: {len(resp.text)}")
print(f"Content-Type: {resp.headers.get('Content-Type','')}")
print(f"Preview: {resp.text[:500]}")

# 3. Try with imovel=10543 as multipart form data
print("\n=== FOTOS POST multipart ===")
for pid in ["10543", "9950", "6866"]:
    resp = session.post(
        f"{BASE_URL}/index.php/imovel/imoveis/fotos",
        data={"imovel": pid},
        timeout=30
    )
    print(f"  Imovel {pid}: status={resp.status_code}, type={resp.headers.get('Content-Type','')}, body={resp.text[:200]}")

# 4. Try to find a page that shows photos
print("\n=== BUSCANDO PAGINA DE FOTOS ===")
resp = session.get(f"{BASE_URL}/index.php/imovel/imoveis/fotos/{10543}", timeout=30)
print(f"  /fotos/10543: status={resp.status_code}, len={len(resp.text)}")

resp = session.get(f"{BASE_URL}/index.php/imovel/imoveis/fotos?imo_id=10543", timeout=30)
print(f"  /fotos?imo_id=10543: status={resp.status_code}, len={len(resp.text)}")

# 5. Look at the detail page for any photo-related URLs or containers
print("\n=== DETALHE - Buscando elementos de foto ===")
resp = session.get(f"{BASE_URL}/index.php/imovel/imoveis/update/10543", timeout=30)
# Find img tags
img_urls = re.findall(r'<img[^>]+src="([^"]+)"', resp.text)
print(f"Imagens na pagina de detalhe: {len(img_urls)}")
for u in img_urls[:10]:
    print(f"  {u}")

# Find any references to fotos or images
photo_refs = re.findall(r'(foto|image|img|galeria)[^=]*=[^"\']*["\']([^"\']+)["\']', resp.text, re.IGNORECASE)
print(f"\nReferencias a fotos: {len(photo_refs)}")
for ref in photo_refs[:10]:
    print(f"  {ref[0]} -> {ref[1]}")

# Find dropzone or file upload elements
dz = re.findall(r'<div[^>]*class="[^"]*(?:dropzone|fotos|galeria|upload)[^"]*"[^>]*>', resp.text, re.IGNORECASE)
print(f"\nDropzone/fotos containers: {len(dz)}")
for d in dz[:5]:
    print(f"  {d[:200]}")

# 6. Try the imoveis_images directory listing
print("\n=== IMOVEIS IMAGES CHECK ===")
resp = session.get(f"https://centromar.novobroker.com.br/imoveis_images/", timeout=30)
print(f"  Status: {resp.status_code}, len={len(resp.text)}")
print(f"  Preview: {resp.text[:300]}")

"""Teste rapido: login + page 1 da listagem + detalhe de 1 imovel + foto."""
import os, sys, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import BASE_URL, LOGIN_URL, CREDENTIALS, EXPORT_DIR, PHOTOS_DIR
import requests
from bs4 import BeautifulSoup
import re

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
})

print("1. Login...")
resp = session.post(LOGIN_URL, data=CREDENTIALS, timeout=30)
data = resp.json()
assert data.get("msg") == "login", f"Falha login: {data}"
print("   OK")

print("2. Pagina 1 da listagem (venda)...")
url = f"{BASE_URL}/index.php/imovel/imoveis/read/venda/0/?imo_venda=venda&imo_registro=0&page=1"
resp = session.get(url, timeout=30)
blocks = re.split(r'<div class="item id_', resp.text)
print(f"   Imoveis na pagina: {len(blocks) - 1}")

id_blocks = []
for block in blocks[1:]:
    m = re.search(r'^(\d+)', block)
    if m:
        id_blocks.append((m.group(1), block[:300]))

print(f"   IDs encontrados: {[x[0] for x in id_blocks]}")

# Test detail page for first property
if id_blocks:
    pid = id_blocks[0][0]
    print(f"\n3. Detalhe do imovel {pid}...")
    detail_url = f"{BASE_URL}/index.php/imovel/imoveis/update/{pid}"
    resp = session.get(detail_url, timeout=30)
    soup = BeautifulSoup(resp.text, "lxml")
    inputs = [(i.get("name",""), i.get("value","")) for i in soup.find_all("input") if i.get("name")]
    selects = [(s.get("name",""), s.find("option", selected=True)) for s in soup.find_all("select")]
    
    print(f"   Campos encontrados: {len(inputs)} inputs, {len(selects)} selects")
    
    # Find imo_prop_id
    prop_id_input = soup.find("input", {"name": "imo_prop_id"})
    if prop_id_input:
        owner_id = prop_id_input.get("value", "")
        print(f"   Proprietario ID: {owner_id}")
    
    # Try photos endpoint
    print(f"\n4. Testando endpoint de fotos para {pid}...")
    try:
        resp = session.post(f"{BASE_URL}/index.php/imovel/imoveis/fotos", data={"imovel": pid}, timeout=30)
        print(f"   Resposta fotos: {resp.text[:300]}")
    except Exception as e:
        print(f"   Erro fotos: {e}")
    
    # Try from page source
    print("   Buscando URLs de fotos no HTML...")
    photo_urls = re.findall(r'https://centromar\.novobroker\.com\.br/imoveis_images/' + re.escape(pid) + r'/[^"\'\)\s]+', resp.text)
    print(f"   URLs de fotos no HTML: {len(photo_urls)}")
    for url in photo_urls[:3]:
        print(f"     {url}")

print("\nTeste concluido!")

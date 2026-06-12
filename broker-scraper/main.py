"""
Extrator completo de imoveis do NovoBroker (Centromar Imoveis)
Exporta para CSV, JSON e baixa todas as fotos.
"""

import os, re, json, time, logging
from datetime import datetime
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
import pandas as pd
from tqdm import tqdm

from config import BASE_URL, LOGIN_URL, CREDENTIALS, EXPORT_DIR, PHOTOS_DIR, REQUEST_DELAY, DETAIL_DELAY, MAX_RETRIES

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("extrator")


class BrokerExtractor:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        })
        self.properties = []
        self.owners_cache = {}
        self.char_names = {}
        self.infra_names = {}
        self.cat_names = {}

    # ------------------------------------------------------------------
    # LOGIN
    # ------------------------------------------------------------------
    def login(self):
        log.info("Fazendo login...")
        resp = self.session.post(LOGIN_URL, data=CREDENTIALS, timeout=30)
        try:
            data = resp.json()
            if data.get("msg") == "login":
                log.info("Login OK")
                return True
            log.error(f"Falha no login: {data}")
            return False
        except Exception as e:
            log.error(f"Erro no login: {e}")
            return False

    # ------------------------------------------------------------------
    # API DISCOVERY
    # ------------------------------------------------------------------
    def discover_api(self):
        log.info("Verificando se existe API JSON...")
        candidates = [
            f"{BASE_URL}/index.php/imovel/imoveis/getByJson",
            f"{BASE_URL}/index.php/imovel/imoveis/list/json",
            f"{BASE_URL}/index.php/imovel/imoveis/read/venda/0/?imo_venda=venda&imo_registro=0&format=json",
        ]
        for url in candidates:
            try:
                resp = self.session.get(url, timeout=10)
                ct = resp.headers.get("Content-Type", "")
                if resp.status_code == 200 and ("json" in ct or resp.text.strip().startswith("{")):
                    log.info(f"API JSON encontrada: {url}")
                    return url
            except Exception:
                pass
        log.info("API JSON nao encontrada. Usando scraping via requests.")
        return None

    # ------------------------------------------------------------------
    # LOOKUP TABLES
    # ------------------------------------------------------------------
    def load_lookups(self):
        for name, url_key, cache in [
            ("caracteristicas", "caracteristicas", self.char_names),
            ("infraestrutura", "infra", self.infra_names),
            ("categorias", "categorias", self.cat_names),
        ]:
            try:
                resp = self.session.get(f"{BASE_URL}/index.php/imovel/{url_key}", timeout=30)
                soup = BeautifulSoup(resp.text, "lxml")
                for row in soup.select("table tbody tr"):
                    cells = row.find_all("td")
                    if len(cells) >= 2:
                        cid = cells[0].get_text(strip=True)
                        cname = cells[1].get_text(strip=True)
                        if cid.isdigit():
                            cache[cid] = cname
                log.info(f"  {len(cache)} {name} carregados")
            except Exception as e:
                log.warning(f"  Erro ao carregar {name}: {e}")

    # ------------------------------------------------------------------
    # LISTING SCRAPING
    # ------------------------------------------------------------------
    def get_total(self, tipo="venda"):
        url = f"{BASE_URL}/index.php/imovel/imoveis/read/{tipo}/0/?imo_{tipo}={tipo}&imo_registro=0"
        resp = self.session.get(url, timeout=30)
        m = re.search(r'de\s+(\d+)', resp.text)
        return int(m.group(1)) if m else 0

    def parse_listing_item(self, html_block, tipo):
        m_id = re.search(r'^(\d+)', html_block)
        if not m_id:
            return None
        pid = m_id.group(1)

        def g(patt, grp=1):
            m = re.search(patt, html_block)
            return m.group(grp).strip() if m else ""

        title = g(r'<p class="item-title">(.*?)</p>')
        dorm = g(r'<i class="fa fa-bed"></i><span>(.*?)</span>')
        vagas = g(r'<i class="fa fa-car"></i><span>(.*?)</span>')
        area = g(r'<i class="fa fa-compass"></i><span>(.*?)</span>')
        val_anun = g(r'data-value="hide">(.*?)\s*\|\s*</span>')
        val_real = g(r'data-value="show">(.*?)</span>')
        owner_name = g(r'<span title="[^"]*">(.*?)</span>')
        owner_phone = g(r'phone"[^>]*>([\s\d\(\)\-\/]+)</a>')

        chaves = g(r'<i class="fa fa-key"></i>[\s\S]*?<p[^>]*>(.*?)</p>')
        if chaves:
            chaves = BeautifulSoup(chaves, "html.parser").get_text().strip()

        condominio = g(r'imo_condo_id=\d+[^>]*>([^<]+)</a>')
        if condominio:
            condominio = BeautifulSoup(condominio, "html.parser").get_text().strip()

        bairro_cidade = ""
        endereco = ""
        addr = re.search(r'item-info-addr[\s\S]*?(?=<div class="ultimo-atual)', html_block)
        if addr:
            soup = BeautifulSoup(addr.group(), "html.parser")
            ps = [p.get_text(strip=True) for p in soup.find_all("p") if p.get_text(strip=True)]
            if len(ps) >= 1 and not condominio:
                condominio = ps[0]
            if len(ps) >= 2:
                bairro_cidade = ps[1]
            if len(ps) >= 3:
                endereco = ps[2]

        etiquetas = ", ".join(
            m.group(1).strip() for m in re.finditer(r'<span class="label[^>]*">([^<]+)</span>', html_block)
        )

        ref = g(r'<strong class="imo_ref">(\d+)</strong>')

        # Cover photo from listing background-image
        cover = g(r'background-image:\s*url\(([^)]+)\)')

        return {
            "imo_id": pid,
            "imo_ref": ref or pid,
            "imo_cover_photo": cover,
            "negociacao": tipo,
            "tipo": title,
            "dormitorios": dorm,
            "vagas": vagas,
            "area": area,
            "valor_anuncio": val_anun,
            "valor_real": val_real,
            "proprietario_nome": owner_name,
            "proprietario_telefone": owner_phone,
            "chaves": chaves,
            "condominio": condominio,
            "bairro_cidade": bairro_cidade,
            "endereco": endereco,
            "etiquetas": etiquetas,
        }

    def scrape_listing(self, tipo="venda"):
        total = self.get_total(tipo)
        if total == 0:
            return []
        paginas = (total + 9) // 10
        log.info(f"Total: {total} imoveis ({paginas} paginas)")
        
        base_url = f"{BASE_URL}/index.php/imovel/imoveis/read/{tipo}/0/?imo_{tipo}={tipo}&imo_registro=0"
        items = []
        
        for page in tqdm(range(1, paginas + 1), desc=f"Paginas ({tipo})"):
            url = f"{base_url}&page={page}"
            for attempt in range(MAX_RETRIES):
                try:
                    resp = self.session.get(url, timeout=30)
                    break
                except Exception:
                    if attempt == MAX_RETRIES - 1:
                        log.error(f"Erro pagina {page}")
                        time.sleep(5)
                    else:
                        time.sleep(2)
            
            blocks = re.split(r'<div class="item id_', resp.text)
            for block in blocks[1:]:
                item = self.parse_listing_item(block, tipo)
                if item:
                    items.append(item)
            
            time.sleep(REQUEST_DELAY)
        
        return items

    # ------------------------------------------------------------------
    # DETAIL SCRAPING
    # ------------------------------------------------------------------
    def scrape_detail(self, prop_id):
        url = f"{BASE_URL}/index.php/imovel/imoveis/update/{prop_id}"
        for attempt in range(MAX_RETRIES):
            try:
                resp = self.session.get(url, timeout=30)
                break
            except Exception:
                if attempt == MAX_RETRIES - 1:
                    return {}
                time.sleep(2)

        soup = BeautifulSoup(resp.text, "lxml")
        detail = {"imo_id": prop_id}

        # Inputs
        for inp in soup.find_all("input"):
            name = inp.get("name")
            if not name:
                continue
            if name in ("submit", "time", "labels", "imo_atualizacao_login", "imo_modo_correcao",
                        "imo_carac_filter", "imo_dt_atual", "imo_dt_cad"):
                continue
            if name.startswith("eportal"):
                continue
            if name.endswith("[]"):
                continue
            value = inp.get("value", "")
            if name not in detail:
                detail[name] = value
            elif detail[name] != value:
                if isinstance(detail[name], list):
                    detail[name].append(value)
                else:
                    detail[name] = [detail[name], value]

        # Textareas
        for ta in soup.find_all("textarea"):
            name = ta.get("name")
            if name:
                detail[name] = ta.get_text(strip=True)

        # Checkbox groups
        for group_name in ("imo_carac", "imo_infra", "imo_tipo_piso"):
            items = []
            for el in soup.find_all("input", {"name": f"{group_name}[]"}):
                if el.get("checked"):
                    items.append(el.get("value", ""))
            if items:
                detail[group_name] = ",".join(items)

        # Selects
        for sel in soup.find_all("select"):
            name = sel.get("name")
            if not name:
                continue
            selected = sel.find("option", selected=True)
            if selected:
                detail[name] = selected.get("value", "")

        return detail

    def scrape_all_details(self, props):
        log.info(f"Obtendo detalhes de {len(props)} imoveis...")
        detail_map = {}
        for i, prop in enumerate(tqdm(props, desc="Detalhes")):
            pid = prop["imo_id"]
            detail = self.scrape_detail(pid)
            if detail:
                detail_map[pid] = detail
            if (i + 1) % 100 == 0:
                log.info(f"  {i+1}/{len(props)} detalhes obtidos")
            time.sleep(DETAIL_DELAY)
        
        enriched = []
        for prop in props:
            pid = prop["imo_id"]
            det = detail_map.get(pid, {})
            enriched.append({**prop, **det})
        
        return enriched

    # ------------------------------------------------------------------
    # OWNER SCRAPING
    # ------------------------------------------------------------------
    def scrape_owner(self, owner_id):
        if owner_id in self.owners_cache:
            return self.owners_cache[owner_id]
        
        try:
            resp = self.session.get(f"{BASE_URL}/index.php/contato/proprietarios/update/{owner_id}", timeout=30)
        except Exception:
            self.owners_cache[owner_id] = {}
            return {}
        
        soup = BeautifulSoup(resp.text, "lxml")
        data = {"proprietario_id": owner_id}
        
        for inp in soup.find_all("input"):
            name = inp.get("name")
            if not name or "contato" in name:
                continue
            val = inp.get("value", "")
            if name and val:
                data[name] = val
        
        for sel in soup.find_all("select"):
            name = sel.get("name")
            if name and "contato" not in name:
                selected = sel.find("option", selected=True)
                if selected:
                    data[name] = selected.get("value", "")
        
        # Extract contacts (phone/email)
        phones = []
        emails = []
        for field in soup.find_all(["input", "select"]):
            fname = field.get("name", "")
            if "contato_dado" in fname:
                val = field.get("value", "") if field.name == "input" else ""
                if val:
                    # Check nearby type/category
                    parent = field.find_parent()
                    if parent:
                        parent_text = parent.get_text()
                        if "@" in val or "email" in parent_text.lower():
                            emails.append(val)
                        elif re.search(r'[\d\(\)\-\s]{8,}', val):
                            phones.append(val)
        
        data["telefones"] = "; ".join(phones)
        data["emails"] = "; ".join(emails)
        
        self.owners_cache[owner_id] = data
        return data

    def scrape_owners(self, props):
        owner_ids = set()
        for p in props:
            oid = p.get("imo_prop_id", "")
            if oid:
                owner_ids.add(oid)
        
        log.info(f"Carregando {len(owner_ids)} proprietarios...")
        owners = {}
        for oid in tqdm(owner_ids, desc="Proprietarios"):
            owners[oid] = self.scrape_owner(oid)
            time.sleep(0.03)
        
        return owners

    # ------------------------------------------------------------------
    # PHOTOS
    # ------------------------------------------------------------------
    def scrape_photos(self, props):
        log.info("Buscando fotos dos imoveis...")
        
        photo_count = 0
        photos_data = []
        skipped = 0
        
        for prop in tqdm(props, desc="Fotos"):
            pid = prop["imo_id"]
            prop_dir = os.path.join(PHOTOS_DIR, pid)
            
            # Resume: skip if dir has files
            if os.path.isdir(prop_dir) and len(os.listdir(prop_dir)) > 0:
                skipped += 1
                existing = sorted(os.listdir(prop_dir))
                photos_data.append({
                    "codigo_imovel": pid,
                    "fotos": "; ".join(existing),
                    "quantidade": len(existing),
                })
                photo_count += len(existing)
                continue
            
            os.makedirs(prop_dir, exist_ok=True)
            
            # Get photo URLs from the fotos endpoint
            photo_urls = []
            try:
                resp = self.session.post(
                    f"{BASE_URL}/index.php/imovel/imoveis/fotos",
                    data={"imovel": pid},
                    timeout=30,
                )
                if resp.text.strip().startswith("["):
                    items = resp.json()
                    photo_urls = [item["src"] for item in items if "src" in item]
            except Exception:
                pass
            
            # Fallback: use cover photo from listing
            if not photo_urls and prop.get("imo_cover_photo"):
                photo_urls = [prop["imo_cover_photo"]]
            
            downloaded = []
            for idx, url in enumerate(photo_urls, 1):
                try:
                    img_resp = self.session.get(url, timeout=30)
                    if img_resp.status_code == 200:
                        ext = url.split(".")[-1].split("?")[0] or "jpg"
                        fname = f"foto{idx:02d}.{ext}"
                        fpath = os.path.join(prop_dir, fname)
                        with open(fpath, "wb") as f:
                            f.write(img_resp.content)
                        downloaded.append(fname)
                        photo_count += 1
                except Exception:
                    pass
            
            if downloaded:
                photos_data.append({
                    "codigo_imovel": pid,
                    "fotos": "; ".join(downloaded),
                    "quantidade": len(downloaded),
                })
        
        log.info(f"Total de fotos baixadas: {photo_count} (puladas: {skipped})")
        return photos_data

    # ------------------------------------------------------------------
    # MERGE & EXPORT
    # ------------------------------------------------------------------
    def export(self, props, owners, photos_data):
        os.makedirs(EXPORT_DIR, exist_ok=True)
        log.info("Exportando dados...")

        # Resolve lookups
        for p in props:
            if p.get("imo_carac"):
                ids = p["imo_carac"].split(",")
                names = [self.char_names.get(i, i) for i in ids if i]
                p["caracteristicas_nomes"] = ", ".join(names)
            if p.get("imo_infra"):
                ids = p["imo_infra"].split(",")
                names = [self.infra_names.get(i, i) for i in ids if i]
                p["infraestrutura_nomes"] = ", ".join(names)
            if p.get("imo_cat"):
                p["categoria_nome"] = self.cat_names.get(p["imo_cat"], p["imo_cat"])

        # Merge owner data
        for p in props:
            oid = p.get("imo_prop_id", "")
            if oid and oid in owners:
                od = owners[oid]
                if od.get("telefones"):
                    p["proprietario_telefones_completo"] = od["telefones"]
                if od.get("emails"):
                    p["proprietario_emails"] = od["emails"]
                for k, v in od.items():
                    if k not in ("proprietario_id", "telefones", "emails"):
                        p[f"owner_{k}"] = v

        # Normalize
        flat = []
        for p in props:
            row = {}
            for k, v in p.items():
                if isinstance(v, (list, tuple)):
                    row[k] = "; ".join(str(x) for x in v)
                elif v is None:
                    row[k] = ""
                else:
                    row[k] = str(v)
            flat.append(row)

        df = pd.DataFrame(flat)

        # 1. imoveis.csv
        csv_path = os.path.join(EXPORT_DIR, "imoveis.csv")
        df.to_csv(csv_path, index=False, encoding="utf-8-sig")
        log.info(f"  imoveis.csv: {len(df)} registros")

        # 2. imoveis.json
        json_path = os.path.join(EXPORT_DIR, "imoveis.json")
        df.to_json(json_path, orient="records", force_ascii=False, indent=2)
        log.info(f"  imoveis.json: {len(df)} registros")

        # 3. proprietarios.csv
        owners_flat = []
        for oid, od in owners.items():
            row = {"proprietario_id": oid}
            row.update(od)
            owners_flat.append(row)
        df_owners = pd.DataFrame(owners_flat)
        owners_csv = os.path.join(EXPORT_DIR, "proprietarios.csv")
        df_owners.to_csv(owners_csv, index=False, encoding="utf-8-sig")
        log.info(f"  proprietarios.csv: {len(df_owners)} registros")

        # 4. fotos.csv
        if photos_data:
            df_photos = pd.DataFrame(photos_data)
            photos_csv = os.path.join(EXPORT_DIR, "fotos.csv")
            df_photos.to_csv(photos_csv, index=False, encoding="utf-8-sig")
            log.info(f"  fotos.csv: {len(df_photos)} registros")

        return df, df_owners

    # ------------------------------------------------------------------
    # RUN
    # ------------------------------------------------------------------
    def run(self):
        log.info("=" * 50)
        log.info("EXTRATOR DE IMOVEIS - Centromar / NovoBroker")
        log.info("=" * 50)

        if not self.login():
            return

        api_url = self.discover_api()
        if api_url:
            log.info("Usando API para extracao...")
            # If we had a real JSON API, we'd use it here
            # Since we don't, fall through to scraping

        self.load_lookups()

        # Scrape listing
        props = self.scrape_listing("venda")
        if not props:
            log.warning("Nenhum imovel encontrado.")
            return

        # Scrape details
        props = self.scrape_all_details(props)

        # Scrape owners
        owners = self.scrape_owners(props)

        # Export BEFORE photos (so data is never lost)
        log.info("Exportando dados...")
        df, df_owners = self.export(props, owners, [])

        # Scrape photos (respect --data-only)
        import sys
        photos = []
        data_only = "--data-only" in sys.argv
        if not data_only:
            photos = self.scrape_photos(props)

        # Re-export with photo info appended
        if photos:
            existing_csv = os.path.join(EXPORT_DIR, "fotos.csv")
            pd.DataFrame(photos).to_csv(existing_csv, index=False, encoding="utf-8-sig")
            log.info(f"  fotos.csv atualizado: {len(photos)} registros")

        # Summary
        log.info("=" * 50)
        log.info("RESUMO DA EXTRACAO")
        log.info(f"  Imoveis: {len(props)}")
        log.info(f"  Proprietarios: {len(owners)}")
        log.info(f"  Fotos baixadas: {sum(p.get('quantidade', 0) if isinstance(p, dict) else 0 for p in photos)}")
        log.info(f"  Diretorio: {os.path.abspath(EXPORT_DIR)}")
        log.info(f"  Arquivos: imoveis.csv, imoveis.json, proprietarios.csv, fotos.csv")
        log.info("=" * 50)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Extrator NovoBroker")
    parser.add_argument("--data-only", action="store_true", help="So dados (sem fotos)")
    parser.add_argument("--photos-only", action="store_true", help="So fotos (retoma onde parou)")
    parser.add_argument("--resume", action="store_true", help="Pula fotos ja baixadas")
    args = parser.parse_args()
    
    ext = BrokerExtractor()
    
    if args.photos_only:
        # Reload properties from CSV
        csv_path = os.path.join(EXPORT_DIR, "imoveis.csv")
        if not os.path.exists(csv_path):
            log.error("Execute primeiro sem --photos-only para gerar os dados.")
            exit(1)
        df = pd.read_csv(csv_path, encoding="utf-8-sig")
        props = df.to_dict("records")
        log.info(f"Carregados {len(props)} imoveis do CSV")
        ext.properties = props
        photos = ext.scrape_photos(props)
        if photos:
            pd.DataFrame(photos).to_csv(os.path.join(EXPORT_DIR, "fotos.csv"), index=False, encoding="utf-8-sig")
            log.info(f"fotos.csv salvo: {len(photos)} registros")
        exit(0)
    
    ext.run()
    
    if args.data_only:
        log.info("Modo --data-only: download de fotos ignorado.")

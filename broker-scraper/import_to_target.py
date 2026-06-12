"""
Script de importacao para o banco de dados KENIXXXXX (Prisma/SQLite).

Mapeia os campos do sistema origem (NovoBroker) para o schema destino.

Uso:
    python import_to_target.py
"""

import os, re, json, sqlite3, logging
from datetime import datetime

import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("import")

# Caminhos
EXPORT_DIR = os.path.abspath("exportacao")
TARGET_DB = r"D:\USER\Downloads\project-bolt-github-rzwmpwpp\KENIXXXXX\project\server\prisma\dev.db"

# User ID padrao para associar registros (deve existir no Profile)
DEFAULT_USER_ID = None  # Será detectado automaticamente


FIELD_MAPPING = {
    # (campo_origem, campo_destino, tipo)
    "imo_id": ("code", "string"),
    "tipo": ("propertyType", "string"),
    "categoria_nome": ("category", "string"),
    "imo_situacao_label": ("status", "string"),
    "imo_estado": ("state", "string"),
    "bairro_cidade": ("city_state_raw", "string"),
    "imo_bairro": ("neighborhood", "string"),
    "imo_cidade": ("city", "string"),
    "imo_logr": ("street", "string"),
    "imo_logr_num": ("number", "string"),
    "imo_logr_compl": ("complement", "string"),
    "imo_area_privativa": ("privateArea", "float"),
    "imo_area_total": ("totalArea", "float"),
    "imo_dorm": ("bedrooms", "int"),
    "imo_suite": ("suites", "int"),
    "imo_banho": ("bathrooms", "int"),
    "imo_vaga": ("garages", "int"),
    "imo_vl_venda": ("salePrice", "float"),
    "imo_vl_mes": ("rentPrice", "float"),
    "imo_vl_condo": ("condoFee", "float"),
    "imo_vl_iptu": ("iptu", "float"),
    "imo_desc_net": ("description", "string"),
    "imo_obs": ("internal_notes", "string"),
    "imo_permuta": ("acceptsExchange", "bool"),
}


def parse_br_float(val):
    """Converte valor brasileiro (1.234,56) para float."""
    if not val:
        return None
    try:
        return float(val.replace(".", "").replace(",", "."))
    except (ValueError, AttributeError):
        return None


def parse_br_int(val):
    """Converte string para int."""
    if not val:
        return None
    try:
        return int(re.sub(r'[^\d]', '', val))
    except (ValueError, AttributeError):
        return None


def extract_city_state(raw):
    """Extrai cidade e estado de string como 'Navegantes - Capao da Canoa/RS'."""
    city = ""
    state = ""
    if raw:
        parts = raw.split("/")
        if len(parts) >= 2:
            state = parts[-1].strip()
            city_part = parts[0].strip()
            # Pega a ultima parte antes do estado (cidade)
            city_parts = city_part.split(" - ")
            if len(city_parts) >= 1:
                city = city_parts[-1].strip()
    return city, state


def get_default_user_id(conn):
    """Obtem o ID do primeiro profile disponivel."""
    try:
        cursor = conn.execute("SELECT id FROM Profile LIMIT 1")
        row = cursor.fetchone()
        return row[0] if row else None
    except Exception:
        return None


def import_properties():
    """Importa imoveis do CSV para o banco SQLite."""
    global DEFAULT_USER_ID

    csv_path = os.path.join(EXPORT_DIR, "imoveis.csv")
    if not os.path.exists(csv_path):
        log.error(f"Arquivo nao encontrado: {csv_path}")
        log.error("Execute primeiro: python main.py")
        return

    if not os.path.exists(TARGET_DB):
        log.error(f"Banco de destino nao encontrado: {TARGET_DB}")
        log.error("Execute 'npx prisma db push' no projeto KENIXXXXX primeiro.")
        return

    log.info("=" * 50)
    log.info("IMPORTACAO PARA KENIXXXXX")
    log.info(f"  Origem: {csv_path}")
    log.info(f"  Destino: {TARGET_DB}")
    log.info("=" * 50)

    # Load data
    df = pd.read_csv(csv_path, encoding="utf-8-sig")
    log.info(f"Total de registros: {len(df)}")

    # Connect to target DB
    conn = sqlite3.connect(TARGET_DB)
    
    # Get default user
    DEFAULT_USER_ID = get_default_user_id(conn)
    if not DEFAULT_USER_ID:
        log.error("Nenhum profile encontrado no banco de destino.")
        log.error("Crie um usuario primeiro no sistema KENIXXXXX.")
        conn.close()
        return
    
    log.info(f"Usuario padrao: {DEFAULT_USER_ID}")

    # Get existing codes for duplicate check
    existing_codes = set()
    try:
        cursor = conn.execute("SELECT code FROM Property")
        existing_codes = {row[0] for row in cursor.fetchall()}
    except Exception:
        pass

    # Prepare building cache
    building_cache = {}
    try:
        cursor = conn.execute("SELECT id, name FROM Building")
        building_cache = {row[1].lower(): row[0] for row in cursor.fetchall()}
    except Exception:
        pass

    # Prepare owner cache
    owner_cache = {}
    try:
        cursor = conn.execute("SELECT id, name FROM Owner")
        owner_cache = {row[1].lower(): row[0] for row in cursor.fetchall()}
    except Exception:
        pass

    imported = 0
    skipped_dup = 0
    skipped_no_code = 0

    for _, row in df.iterrows():
        code = str(row.get("imo_id", "")).strip()
        if not code or code == "nan":
            skipped_no_code += 1
            continue

        if code in existing_codes:
            skipped_dup += 1
            continue

        # Build property data
        prop_data = {
            "code": code,
            "propertyType": str(row.get("tipo", "Indefinido")).split("»")[0].strip() or "Indefinido",
            "category": str(row.get("categoria_nome", row.get("imo_cat", "venda"))),
            "status": "disponivel",
            "visibility": "privado",
            "userId": DEFAULT_USER_ID,
            "createdAt": datetime.now().isoformat(),
        }

        # City / State
        bairro_cidade = str(row.get("bairro_cidade", "")).strip()
        cidade_raw = str(row.get("imo_cidade", "")).strip()
        estado_raw = str(row.get("imo_estado", "")).strip()
        
        if cidade_raw:
            prop_data["city"] = cidade_raw
        elif bairro_cidade:
            city, state = extract_city_state(bairro_cidade)
            if city:
                prop_data["city"] = city
        
        if estado_raw:
            prop_data["state"] = estado_raw
        elif bairro_cidade:
            _, state = extract_city_state(bairro_cidade)
            if state:
                prop_data["state"] = state
        
        prop_data["neighborhood"] = str(row.get("imo_bairro", "")).strip() or ""
        prop_data["street"] = str(row.get("imo_logr", "")).strip() or ""
        prop_data["number"] = str(row.get("imo_logr_num", "")).strip() or ""
        prop_data["complement"] = str(row.get("imo_logr_compl", "")).strip() or ""
        prop_data["zip"] = str(row.get("imo_logr_cep", "")).strip() or ""
        
        # Areas
        area_priv = str(row.get("imo_area_privativa", "")).strip()
        if area_priv:
            prop_data["privateArea"] = parse_br_float(area_priv)
        
        area_total = str(row.get("imo_area_total", "")).strip()
        if area_total:
            prop_data["totalArea"] = parse_br_float(area_total)
        
        # Rooms
        prop_data["bedrooms"] = parse_br_int(row.get("imo_dorm", ""))
        prop_data["suites"] = parse_br_int(row.get("imo_suite", ""))
        prop_data["bathrooms"] = parse_br_int(row.get("imo_banho", ""))
        prop_data["garages"] = parse_br_int(row.get("imo_vaga", ""))
        
        # Prices
        vl_venda = str(row.get("imo_vl_venda", "")).strip()
        if vl_venda:
            prop_data["salePrice"] = parse_br_float(vl_venda)
        
        vl_aluguel = str(row.get("imo_vl_mes", "")).strip()
        if vl_aluguel and vl_aluguel != "0,00":
            prop_data["rentPrice"] = parse_br_float(vl_aluguel)
        
        vl_condo = str(row.get("imo_vl_condo", "")).strip()
        if vl_condo and vl_condo != "0,00":
            prop_data["condoFee"] = parse_br_float(vl_condo)
        
        vl_iptu = str(row.get("imo_vl_iptu", "")).strip()
        if vl_iptu and vl_iptu != "0,00":
            prop_data["iptu"] = parse_br_float(vl_iptu)
        
        # Description / Notes
        desc = str(row.get("imo_desc_net", "")).strip()
        obs = str(row.get("imo_obs", "")).strip()
        chaves = str(row.get("chaves", "")).strip()
        
        notes_parts = []
        if desc and desc != "nan":
            prop_data["description"] = desc
        if obs and obs != "nan":
            notes_parts.append(f"Obs: {obs}")
        if chaves and chaves != "nan":
            notes_parts.append(f"Chaves: {chaves}")
        if notes_parts:
            prop_data["internal_notes"] = " | ".join(notes_parts)
        
        # Amenities
        amenities = []
        carac = str(row.get("caracteristicas_nomes", "")).strip()
        if carac and carac != "nan":
            amenities.append(carac)
        infra = str(row.get("infraestrutura_nomes", "")).strip()
        if infra and infra != "nan":
            amenities.append(infra)
        if amenities:
            prop_data["amenities"] = json.dumps(amenities, ensure_ascii=False)
        
        # Exchange
        permuta = str(row.get("imo_permuta", "")).strip()
        if permuta == "1":
            prop_data["acceptsExchange"] = 1
        
        # Photos
        photos = []
        foto_dir = os.path.join(EXPORT_DIR, "fotos", code)
        if os.path.isdir(foto_dir):
            for fname in sorted(os.listdir(foto_dir)):
                if fname.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                    photos.append(f"fotos/{code}/{fname}")
        if photos:
            prop_data["photos"] = json.dumps(photos, ensure_ascii=False)
        
        # Building (condominio)
        condominio = str(row.get("condominio", "")).strip()
        if condominio and condominio != "nan":
            condo_key = condominio.lower()
            if condo_key in building_cache:
                prop_data["buildingId"] = building_cache[condo_key]
            else:
                # Create building
                cursor = conn.execute(
                    "INSERT INTO Building (id, name, city, state, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
                    (os.urandom(16).hex(), condominio, prop_data.get("city", ""), 
                     prop_data.get("state", ""), DEFAULT_USER_ID, datetime.now().isoformat())
                )
                conn.commit()
                building_cache[condo_key] = cursor.lastrowid
                prop_data["buildingId"] = cursor.lastrowid
        
        # Owner
        owner_name = str(row.get("proprietario_nome", "")).strip()
        if owner_name and owner_name != "nan":
            owner_key = owner_name.lower()
            if owner_key in owner_cache:
                prop_data["ownerId"] = owner_cache[owner_key]
            else:
                # Create owner
                owner_phone = str(row.get("proprietario_telefone", "")).strip()
                owner_phones_full = str(row.get("proprietario_telefones_completo", "")).strip()
                owner_emails = str(row.get("proprietario_emails", "")).strip()
                
                all_phones = owner_phone
                if owner_phones_full and owner_phones_full != "nan":
                    all_phones = owner_phones_full
                
                oid = os.urandom(16).hex()
                conn.execute(
                    """INSERT INTO Owner (id, name, phone, email, userId, createdAt)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (oid, owner_name, all_phones if all_phones != "nan" else "",
                     owner_emails if owner_emails and owner_emails != "nan" else "",
                     DEFAULT_USER_ID, datetime.now().isoformat())
                )
                conn.commit()
                owner_cache[owner_key] = oid
                prop_data["ownerId"] = oid

        # Insert property
        columns = ", ".join(prop_data.keys())
        placeholders = ", ".join(["?"] * len(prop_data))
        values = list(prop_data.values())
        
        try:
            conn.execute(f"INSERT INTO Property ({columns}) VALUES ({placeholders})", values)
            conn.commit()
            imported += 1
            existing_codes.add(code)
        except Exception as e:
            log.error(f"  Erro ao inserir imovel {code}: {e}")

    conn.close()
    
    log.info("=" * 50)
    log.info("RESUMO DA IMPORTACAO")
    log.info(f"  Importados: {imported}")
    log.info(f"  Duplicatas ignoradas: {skipped_dup}")
    log.info(f"  Sem codigo: {skipped_no_code}")
    log.info(f"  Total no CSV: {len(df)}")
    log.info("=" * 50)


def generate_mapping_report():
    """Gera relatorio de mapeamento entre origem e destino."""
    log.info("Gerando relatorio de mapeamento...")
    
    mapping_lines = [
        "# MAPEAMENTO ORIGEM -> DESTINO",
        "# NovoBroker (Centromar) -> KENIXXXXX (Prisma/SQLite)",
        "",
        "## Campos de Imovel",
        "",
        "| Campo Origem | Campo Destino | Tipo | Observacao |",
        "|---|---|---|---|",
        "| imo_id | code | string | Identificador unico |",
        "| tipo (title) | propertyType | string | Ex: 'Casa', 'Apartamento' |",
        "| imo_cat / categoria_nome | category | string | Ex: 'Residencial', 'Comercial' |",
        "| imo_situacao | status | string | Mapeado para 'disponivel' |",
        "| imo_estado | state | string | Sigla do estado |",
        "| imo_cidade | city | string | Nome da cidade |",
        "| imo_bairro | neighborhood | string | Nome do bairro |",
        "| imo_logr | street | string | Logradouro |",
        "| imo_logr_num | number | string | Numero |",
        "| imo_logr_compl | complement | string | Complemento/Apto |",
        "| imo_logr_cep | zip | string | CEP |",
        "| imo_area_privativa | privateArea | float | m2 |",
        "| imo_area_total | totalArea | float | m2 |",
        "| imo_dorm | bedrooms | int | |",
        "| imo_suite | suites | int | |",
        "| imo_banho | bathrooms | int | |",
        "| imo_vaga | garages | int | |",
        "| imo_vl_venda | salePrice | float | R$ |",
        "| imo_vl_mes | rentPrice | float | R$ |",
        "| imo_vl_condo | condoFee | float | R$ |",
        "| imo_vl_iptu | iptu | float | R$ |",
        "| imo_desc_net | description | text | Descricao para internet |",
        "| imo_obs | internal_notes | text | Observacoes internas |",
        "| imo_permuta | acceptsExchange | bool | Aceita permuta? |",
        "| imo_chaves | internal_notes | text | Apensado as observacoes |",
        "| imo_carac[] | amenities | json | Caracteristicas do imovel |",
        "| imo_infra[] | amenities | json | Infraestrutura do condominio |",
        "| Fotos (imoveis_images/) | photos | json | Array de caminhos relativos |",
        "",
        "## Campos de Proprietario (Owner)",
        "",
        "| Campo Origem | Campo Destino | Tipo |",
        "|---|---|---|",
        "| imo_prop_nome | name | string |",
        "| imo_prop_tel | phone | string |",
        "| proprietario_telefones_completo | phone | string | (merge de todos os telefones) |",
        "| proprietario_emails | email | string | (merge de todos os emails) |",
        "| cli_cidade | city | string |",
        "| cli_cpf / cli_cnpj | cpf_cnpj | string |",
        "| cli_obs | notes | text |",
        "",
        "## Campos de Edificio/Condominio (Building)",
        "",
        "| Campo Origem | Campo Destino | Tipo |",
        "|---|---|---|",
        "| condominio (imo_condominio) | name | string | Nome do condominio |",
        "| bairro_cidade | city/state | string | Extraido do endereco |",
        "",
        "---",
        f"Relatorio gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M')}",
    ]
    
    report_path = os.path.join(EXPORT_DIR, "MAPEAMENTO.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(mapping_lines))
    
    log.info(f"Relatorio salvo em: {report_path}")
    return report_path


if __name__ == "__main__":
    import_properties()
    generate_mapping_report()

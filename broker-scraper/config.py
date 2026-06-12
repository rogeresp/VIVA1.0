import os

BASE_URL = "https://centromar.novobroker.com.br/broker"
LOGIN_URL = f"{BASE_URL}/index.php/login/dologin"

CREDENTIALS = {
    "userlogin": "agenciador@centromar.com.br",
    "userpass": "centromarimob",
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXPORT_DIR = os.path.join(BASE_DIR, "exportacao")
PHOTOS_DIR = os.path.join(EXPORT_DIR, "fotos")

REQUEST_DELAY = 0.1
DETAIL_DELAY = 0.05
MAX_RETRIES = 3

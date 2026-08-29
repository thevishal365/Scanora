from pathlib import Path

from dotenv import load_dotenv

# backend/env_loader.py -> project root C:\Project\Scanora
ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"


def load_scanora_env() -> None:
    load_dotenv(ENV_PATH, override=True)

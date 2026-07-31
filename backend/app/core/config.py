from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Maximo Visual Inspection Backend"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    database_url: str = "sqlite:///./inspection.db"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    upload_dir: str = "backend/uploads"

    # ── Google Gemini Vision AI ──────────────────────────────────────────────
    gemini_api_key: str = ""

    # ── IBM Maximo Manage ────────────────────────────────────────────────────
    maximo_base_url: str = "https://masdev.manage.metadev.apps.mngai-1086.cp.fyre.ibm.com/maximo"
    maximo_api_key: str = "84538hoqqtngniqmorbpd10sll50grkmtouehl38"
    maximo_username: str = "maxadmin"
    maximo_password: str = "maxadmin1234567"
    maximo_lean: str = "1"
    mas_mcp_url: str = "https://masdev-mcp.manage.metadev.apps.mngai-1086.cp.fyre.ibm.com/mcp"

    model_config = SettingsConfigDict(
        # Load both locations — works whether uvicorn is run from repo root or backend/
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

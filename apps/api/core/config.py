from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    SECRET_KEY: str = "default-insecure-secret-key-change-in-prod"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    DATABASE_URL: str = "postgresql://jobos:jobos_password@localhost:5432/jobos"
    CORS_ORIGINS: str = "http://localhost:3000"

    SERPAPI_API_KEY: str = ""
    SERPAPI_FALLBACK_API_KEY: str = ""
    DEMO_MODE: bool = True
    GEMINI_API_KEY: str = ""
    LLM_MODEL: str = "gemini-2.5-flash"
    GITHUB_TOKEN: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()

import os
from typing import Optional
from dotenv import load_dotenv

# Ensure environment variables from .env are loaded
load_dotenv()


class Settings:
    """Application configuration settings."""

    def __init__(self):
        self.nvidia_api_key: Optional[str] = os.getenv("NVIDIA_API_KEY")
        self.nvidia_base_url: str = os.getenv(
            "NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1"
        )
        self.nvidia_model: str = os.getenv("NVIDIA_MODEL", "z-ai/glm-5.3")
        self.request_timeout: float = float(os.getenv("NVIDIA_REQUEST_TIMEOUT", "180.0"))

        self.host: str = os.getenv("HOST", "0.0.0.0")
        self.port: int = int(os.getenv("PORT", "8000"))
        self.environment: str = os.getenv("ENVIRONMENT", "development")
        self.log_level: str = os.getenv("LOG_LEVEL", "INFO")

    @property
    def is_nvidia_configured(self) -> bool:
        """Check if NVIDIA API key is present."""
        return bool(self.nvidia_api_key and self.nvidia_api_key.strip())

    @property
    def masked_api_key(self) -> str:
        """Return a securely masked version of the API key for diagnostics."""
        if not self.is_nvidia_configured:
            return "NOT_CONFIGURED"
        key = self.nvidia_api_key.strip()
        if len(key) <= 10:
            return "***"
        return f"{key[:6]}...{key[-4:]}"


settings = Settings()

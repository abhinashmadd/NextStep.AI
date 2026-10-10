import logging
import re
import sys
from app.core.config import settings

# Regex matching standard NVIDIA API keys
NVIDIA_KEY_PATTERN = re.compile(r"nvapi-[A-Za-z0-9_\-]+", re.IGNORECASE)


class SensitiveDataFilter(logging.Filter):
    """
    Log filter that intercepts and redacts any occurrence of NVIDIA API keys
    or secrets from log messages.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = self._redact(record.msg)
        if record.args:
            if isinstance(record.args, dict):
                record.args = {k: self._redact(v) if isinstance(v, str) else v for k, v in record.args.items()}
            elif isinstance(record.args, tuple):
                record.args = tuple(self._redact(arg) if isinstance(arg, str) else arg for arg in record.args)
        return True

    def _redact(self, text: str) -> str:
        # Redact regex matches
        sanitized = NVIDIA_KEY_PATTERN.sub("[REDACTED_NVIDIA_API_KEY]", text)
        # Also redact the configured API key directly if present
        if settings.nvidia_api_key and settings.nvidia_api_key in sanitized:
            sanitized = sanitized.replace(settings.nvidia_api_key, "[REDACTED_NVIDIA_API_KEY]")
        return sanitized


def setup_logger(name: str = "nextstep") -> logging.Logger:
    """Configure and return application logger with redaction filter."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        handler.addFilter(SensitiveDataFilter())
        logger.addHandler(handler)
        logger.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))
    return logger


logger = setup_logger()

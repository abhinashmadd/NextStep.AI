class NextStepException(Exception):
    """Base exception class for NextStep application."""

    def __init__(self, message: str, status_code: int = 500, error_code: str = "INTERNAL_ERROR"):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code


class MissingAPIKeyError(NextStepException):
    """Raised when NVIDIA_API_KEY is not configured."""

    def __init__(self, message: str = "NVIDIA_API_KEY is not configured on the server."):
        super().__init__(message=message, status_code=500, error_code="MISSING_NVIDIA_API_KEY")


class InvalidAPIKeyError(NextStepException):
    """Raised when NVIDIA rejects authentication."""

    def __init__(self, message: str = "Invalid or expired NVIDIA API Key."):
        super().__init__(message=message, status_code=401, error_code="INVALID_NVIDIA_API_KEY")


class NVIDIAAPITimeoutError(NextStepException):
    """Raised when request to NVIDIA NIM times out."""

    def __init__(self, message: str = "NVIDIA NIM GLM-5.3 service timed out."):
        super().__init__(message=message, status_code=504, error_code="NVIDIA_API_TIMEOUT")


class NVIDIAAPIError(NextStepException):
    """Raised when NVIDIA NIM API returns an error or fails."""

    def __init__(self, message: str = "NVIDIA NIM API encountered an error.", status_code: int = 502):
        super().__init__(message=message, status_code=status_code, error_code="NVIDIA_API_ERROR")


class InvalidAIResponseError(NextStepException):
    """Raised when the AI model returns unparseable or schema-violating JSON."""

    def __init__(self, message: str = "Failed to parse structured JSON from NVIDIA GLM-5.3 response."):
        super().__init__(message=message, status_code=502, error_code="INVALID_AI_RESPONSE")


class EmptyEvidenceError(NextStepException):
    """Raised when student evidence is missing or empty."""

    def __init__(self, message: str = "Student evidence cannot be empty. Please provide projects, code, or work experience."):
        super().__init__(message=message, status_code=400, error_code="EMPTY_STUDENT_EVIDENCE")

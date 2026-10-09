"""One error type for the whole API, rendered as {error: {code, message_for_user, retryable}}."""


class AppError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.retryable = retryable

    def to_dict(self) -> dict:
        return {"error": {"code": self.code, "message_for_user": self.message, "retryable": self.retryable}}

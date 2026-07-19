from fastapi import status


class ApiError(Exception):
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class NotFound(ApiError):
    def __init__(self, entity: str, id: str):
        super().__init__(status.HTTP_404_NOT_FOUND, f"{entity} '{id}' not found")


class Conflict(ApiError):
    def __init__(self, message: str):
        super().__init__(status.HTTP_409_CONFLICT, message)


class ValidationError(ApiError):
    def __init__(self, message: str):
        super().__init__(status.HTTP_422_UNPROCESSABLE_ENTITY, message)

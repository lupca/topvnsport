class DomainException(Exception):
    """Base exception class for domain/service layer errors."""

    def __init__(self, message: str = "Domain error", status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code

    @property
    def detail(self) -> str:
        """Alias for message for backward compatibility."""
        return self.message


class ProductNotFoundException(DomainException):
    """Raised when a requested product does not exist."""

    def __init__(self, message: str = "Product not found", status_code: int = 404):
        super().__init__(message=message, status_code=status_code)


class ChannelNotFoundException(DomainException):
    """Raised when a referenced channel is not found."""

    def __init__(self, message: str = "Channel not found", status_code: int = 400):
        super().__init__(message=message, status_code=status_code)


class VariantSkuNotFoundException(DomainException):
    """Raised when a referenced variant SKU is not found."""

    def __init__(self, message: str = "Variant SKU not found", status_code: int = 400):
        super().__init__(message=message, status_code=status_code)

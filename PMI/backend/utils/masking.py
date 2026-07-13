import logging
from collections.abc import Mapping, Sequence

logger = logging.getLogger(__name__)

def mask_sensitive_data(payload) -> dict:
    """
    Recursively scans a dictionary, replacing sensitive keys' values with '***MASKED***'.
    Target keys: password, access_token, refresh_token, app_secret (case-insensitive).
    Returns a new copy of the payload to avoid side-effects (mutating original input).
    """
    if payload is None:
        return None

    sensitive_keys = {"password", "access_token", "refresh_token", "app_secret"}
    visited = set()

    def recurse(val, depth=0):
        if depth > 100:
            raise ValueError("Payload nesting depth limit exceeded")

        val_id = id(val)
        if val_id in visited:
            return "***CYCLE DETECTED***"

        visited.add(val_id)
        try:
            if isinstance(val, Mapping):
                new_dict = {}
                for k, v in val.items():
                    if isinstance(k, str) and k.lower() in sensitive_keys:
                        new_dict[k] = "***MASKED***"
                    else:
                        new_dict[k] = recurse(v, depth + 1)
                return new_dict
            elif isinstance(val, (Sequence, set, frozenset)) and not isinstance(val, (str, bytes)):
                evaluated = [recurse(item, depth + 1) for item in val]
                type_constructor = type(val)
                try:
                    return type_constructor(evaluated)
                except TypeError:
                    logger.warning("Failed to reconstruct set/frozenset because items are unhashable after masking. Falling back to list.")
                    return evaluated
            else:
                return val
        finally:
            visited.remove(val_id)

    return recurse(payload)


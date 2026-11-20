"""
Sri Mathurshree Agro Kendra - Authentication & RBAC Module
Zero external dependencies: uses only Python stdlib.
- PBKDF2-SHA256 password hashing with 200k iterations + per-user random 16-byte salt
- HS256 JWT signing/verification using hmac, hashlib, base64, json, time
"""

import os
import hmac
import hashlib
import base64
import json
import time
import secrets

from fastapi import Request, Depends
from fastapi.responses import JSONResponse
from fastapi import HTTPException

JWT_SECRET = os.environ.get("JWT_SECRET", "agro-erp-dev-secret-2026")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_SECONDS = 12 * 3600  # 12 hours


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    """
    Hash a plaintext password using PBKDF2-SHA256 with 200,000 iterations
    and a random 16-byte salt.
    Returns 'salt_hex:hash_hex' string.
    """
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
    return salt.hex() + ":" + dk.hex()


def verify_password(password: str, stored_hash: str) -> bool:
    """
    Verify a plaintext password against a 'salt_hex:hash_hex' stored hash.
    Uses constant-time comparison to prevent timing attacks.
    """
    try:
        salt_hex, hash_hex = stored_hash.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
        return hmac.compare_digest(dk, expected)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    # Re-add padding
    s += "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)


def _sign(message: str) -> str:
    sig = hmac.new(JWT_SECRET.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).digest()
    return _b64url_encode(sig)


def create_token(payload: dict) -> str:
    """
    Create an HS256 JWT token from the given payload dict.
    Adds 'iat' and 'exp' claims automatically.
    Returns the token string.
    """
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    full_payload = dict(payload)
    full_payload["iat"] = now
    full_payload["exp"] = now + JWT_EXPIRY_SECONDS

    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(full_payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}"
    signature = _sign(signing_input)
    return f"{signing_input}.{signature}"


def verify_token(token: str) -> dict:
    """
    Verify an HS256 JWT token.
    Returns the payload dict on success.
    Raises ValueError if the token is invalid, tampered, or expired.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid token structure")

        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}"
        expected_sig = _sign(signing_input)

        if not hmac.compare_digest(expected_sig, sig_b64):
            raise ValueError("Invalid token signature")

        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))

        exp = payload.get("exp")
        if exp is None or int(time.time()) > exp:
            raise ValueError("Token has expired")

        return payload
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Token verification failed: {e}")


# ---------------------------------------------------------------------------
# FastAPI dependency functions
# ---------------------------------------------------------------------------

def get_current_user(request: Request) -> dict:
    """
    FastAPI dependency that extracts and verifies the Bearer token from the
    Authorization header.
    Returns the payload dict (user info) on success.
    Raises HTTP 401 if missing, invalid, or expired.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = auth_header[len("Bearer "):]
    try:
        payload = verify_token(token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    return payload


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """
    FastAPI dependency that requires the current user to have role 'Admin'.
    Raises HTTP 403 if the role is not Admin.
    """
    if user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

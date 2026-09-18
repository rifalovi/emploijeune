"""Vérification du JWT Supabase (HS256), sans dépendance native.

Supabase émet des jetons d'accès signés en HS256 avec le secret JWT du projet.
On les vérifie ici avec la bibliothèque standard (`hmac`/`hashlib`) uniquement —
ni PyJWT ni `cryptography` — pour éviter toute extension native fragile et
minimiser le bundle de la fonction Vercel.

Variable d'environnement requise : SUPABASE_JWT_SECRET (secret JWT du projet
Supabase). L'audience attendue est « authenticated ».
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, Header, HTTPException, status

AUDIENCE = "authenticated"


@dataclass
class AuthUser:
    """Utilisateur authentifié extrait du JWT."""

    user_id: str          # claim `sub`
    role: Optional[str]   # claim `role` (ex. 'authenticated')
    email: Optional[str]
    claims: dict


def _b64url_decode(segment: str) -> bytes:
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


class JwtError(Exception):
    """Erreur de vérification du jeton."""


def verify_supabase_jwt(token: str, secret: str, *, leeway: int = 0) -> dict:
    """Vérifie la signature HS256 et les claims d'un JWT Supabase.

    Returns:
        Les claims (payload) si le jeton est valide.

    Raises:
        JwtError: jeton malformé, mauvaise signature, expiré ou audience invalide.
    """
    parts = token.split(".")
    if len(parts) != 3:
        raise JwtError("Jeton malformé (3 segments attendus).")
    header_b64, payload_b64, signature_b64 = parts

    try:
        header = json.loads(_b64url_decode(header_b64))
    except (ValueError, json.JSONDecodeError) as exc:
        raise JwtError("En-tête illisible.") from exc
    if header.get("alg") != "HS256":
        raise JwtError(f"Algorithme non supporté : {header.get('alg')}.")

    expected = hmac.new(
        secret.encode("utf-8"),
        f"{header_b64}.{payload_b64}".encode("ascii"),
        hashlib.sha256,
    ).digest()
    try:
        provided = _b64url_decode(signature_b64)
    except (ValueError, base64.binascii.Error) as exc:
        raise JwtError("Signature illisible.") from exc
    if not hmac.compare_digest(expected, provided):
        raise JwtError("Signature invalide.")

    try:
        claims = json.loads(_b64url_decode(payload_b64))
    except (ValueError, json.JSONDecodeError) as exc:
        raise JwtError("Charge utile illisible.") from exc

    now = int(time.time())
    exp = claims.get("exp")
    if exp is not None and now > int(exp) + leeway:
        raise JwtError("Jeton expiré.")
    nbf = claims.get("nbf")
    if nbf is not None and now + leeway < int(nbf):
        raise JwtError("Jeton pas encore valide.")
    aud = claims.get("aud")
    # `aud` peut être une chaîne ou une liste.
    if aud is not None:
        auds = aud if isinstance(aud, list) else [aud]
        if AUDIENCE not in auds:
            raise JwtError("Audience invalide.")
    return claims


def require_user(authorization: str = Header(default="")) -> AuthUser:
    """Dépendance FastAPI : exige un JWT Supabase valide (Authorization: Bearer)."""
    secret = os.environ.get("SUPABASE_JWT_SECRET")
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_JWT_SECRET non configuré côté serveur.",
        )
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="En-tête Authorization manquant ou invalide (Bearer attendu).",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization[7:].strip()
    try:
        claims = verify_supabase_jwt(token, secret)
    except JwtError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Jeton sans identifiant utilisateur (sub).",
        )
    return AuthUser(
        user_id=str(sub),
        role=claims.get("role"),
        email=claims.get("email"),
        claims=claims,
    )


CurrentUser = Depends(require_user)

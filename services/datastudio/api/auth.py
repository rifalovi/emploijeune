"""Vérification du JWT Supabase (HS256 ou ES256), sans dépendance native lourde.

Supabase peut signer ses jetons d'accès de deux façons :
  • HS256 (secret partagé historique, variable SUPABASE_JWT_SECRET) ;
  • ES256 (clés de signature asymétriques récentes), à vérifier avec la clé
    publique publiée sur le JWKS du projet.

On gère les deux. La vérification n'utilise que la bibliothèque standard
(`hmac`/`hashlib`) et `ecdsa` (ECDSA pur Python) — ni PyJWT ni `cryptography`,
pour éviter toute extension native fragile et minimiser le bundle Vercel.

L'audience attendue est « authenticated ».
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
import urllib.error
import urllib.request
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


class JwtError(Exception):
    """Erreur de vérification du jeton."""


def _b64url_decode(segment: str) -> bytes:
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


# ------------------------------------------------------------------ JWKS (ES256)
_jwks_cache: dict = {}  # kid -> jwk


def _supabase_url() -> Optional[str]:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    return url.rstrip("/") if url else None


def _fetch_jwks() -> dict:
    """Récupère le JWKS du projet Supabase et met à jour le cache par `kid`."""
    url = _supabase_url()
    if not url:
        raise JwtError("SUPABASE_URL non configuré (nécessaire pour les clés ES256).")
    apikey = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.environ.get(
        "SUPABASE_SERVICE_ROLE_KEY"
    )
    headers = {"apikey": apikey} if apikey else {}
    request = urllib.request.Request(f"{url}/auth/v1/.well-known/jwks.json", headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=10) as response:  # noqa: S310
            data = json.loads(response.read())
    except (urllib.error.URLError, ValueError) as exc:
        raise JwtError("Clés de signature (JWKS) indisponibles.") from exc
    keys = {k["kid"]: k for k in data.get("keys", []) if k.get("kid")}
    _jwks_cache.update(keys)
    return keys


def _get_jwk(kid: Optional[str]) -> dict:
    if kid and kid in _jwks_cache:
        return _jwks_cache[kid]
    keys = _fetch_jwks()  # (re)charge, p. ex. après rotation de clé
    if kid and kid in keys:
        return keys[kid]
    # Sans kid : s'il n'y a qu'une clé, on l'utilise.
    if not kid and len(keys) == 1:
        return next(iter(keys.values()))
    raise JwtError("Clé de signature introuvable pour ce jeton.")


def _verify_es256(signing_input: bytes, signature: bytes, jwk: dict) -> None:
    """Vérifie une signature ES256 (ECDSA P-256) via la clé publique du JWK."""
    if jwk.get("kty") != "EC" or jwk.get("crv") != "P-256":
        raise JwtError("Clé de signature incompatible (EC P-256 attendue).")
    try:
        from ecdsa import BadSignatureError, NIST256p, VerifyingKey
        from ecdsa.ellipticcurve import Point
        from ecdsa.util import sigdecode_string
    except ImportError as exc:  # pragma: no cover
        raise JwtError("Le module ecdsa est requis pour les jetons ES256.") from exc
    x = int.from_bytes(_b64url_decode(jwk["x"]), "big")
    y = int.from_bytes(_b64url_decode(jwk["y"]), "big")
    point = Point(NIST256p.curve, x, y)
    vk = VerifyingKey.from_public_point(point, curve=NIST256p, hashfunc=hashlib.sha256)
    try:
        vk.verify(signature, signing_input, hashfunc=hashlib.sha256, sigdecode=sigdecode_string)
    except BadSignatureError as exc:
        raise JwtError("Signature ES256 invalide.") from exc


def _verify_hs256(signing_input: bytes, signature: bytes, secret: Optional[str]) -> None:
    if not secret:
        raise JwtError("Jeton HS256 mais SUPABASE_JWT_SECRET non configuré.")
    expected = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    if not hmac.compare_digest(expected, signature):
        raise JwtError("Signature invalide.")


def verify_supabase_jwt(token: str, *, hs_secret: Optional[str] = None, leeway: int = 0) -> dict:
    """Vérifie la signature (HS256 ou ES256) et les claims d'un JWT Supabase.

    Returns:
        Les claims (payload) si le jeton est valide.

    Raises:
        JwtError: jeton malformé, algorithme non géré, mauvaise signature,
            expiré ou audience invalide.
    """
    parts = token.split(".")
    if len(parts) != 3:
        raise JwtError("Jeton malformé (3 segments attendus).")
    header_b64, payload_b64, signature_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")

    try:
        header = json.loads(_b64url_decode(header_b64))
    except (ValueError, json.JSONDecodeError) as exc:
        raise JwtError("En-tête illisible.") from exc
    try:
        signature = _b64url_decode(signature_b64)
    except (ValueError, base64.binascii.Error) as exc:
        raise JwtError("Signature illisible.") from exc

    alg = header.get("alg")
    if alg == "HS256":
        _verify_hs256(signing_input, signature, hs_secret)
    elif alg == "ES256":
        _verify_es256(signing_input, signature, _get_jwk(header.get("kid")))
    else:
        raise JwtError(f"Algorithme non supporté : {alg}.")

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
    if aud is not None:
        auds = aud if isinstance(aud, list) else [aud]
        if AUDIENCE not in auds:
            raise JwtError("Audience invalide.")
    return claims


def require_user(authorization: str = Header(default="")) -> AuthUser:
    """Dépendance FastAPI : exige un JWT Supabase valide (Authorization: Bearer)."""
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="En-tête Authorization manquant ou invalide (Bearer attendu).",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization[7:].strip()
    try:
        claims = verify_supabase_jwt(token, hs_secret=os.environ.get("SUPABASE_JWT_SECRET"))
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

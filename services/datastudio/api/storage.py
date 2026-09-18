"""Accès en lecture à Supabase Storage pour l'ingestion de fichiers.

La fonction Python télécharge un objet du bucket privé « datastudio » à l'aide
de la clé de service (qui contourne la RLS) ; la vérification que le chemin
appartient bien à l'utilisateur authentifié est faite en amont, dans app.py.

Aucune dépendance externe : `urllib` de la bibliothèque standard suffit.
"""

from __future__ import annotations

import os
import re
import tempfile
import urllib.error
import urllib.request
from pathlib import PurePosixPath

BUCKET = "datastudio"

# Chemin d'objet Storage : segments simples séparés par « / », sans « .. ».
_SAFE_PATH = re.compile(r"^[A-Za-z0-9_./-]+$")


class StorageError(Exception):
    """Erreur d'accès à Storage."""


def _supabase_url() -> str:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    if not url:
        raise StorageError("SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) non configuré.")
    return url.rstrip("/")


def _service_key() -> str:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise StorageError("SUPABASE_SERVICE_ROLE_KEY non configuré côté serveur.")
    return key


def validate_object_path(path: str) -> str:
    """Valide un chemin d'objet (pas de « .. », pas de « / » initial)."""
    p = (path or "").strip()
    if not p or p.startswith("/") or ".." in p or not _SAFE_PATH.match(p):
        raise StorageError(f"Chemin d'objet invalide : {path!r}.")
    return p


def download_to_temp(path: str) -> str:
    """Télécharge l'objet `path` du bucket datastudio vers un fichier temporaire.

    Returns:
        Le chemin local du fichier temporaire (suffixe conservé pour la lecture
        par extension). L'appelant est responsable de sa suppression.
    """
    path = validate_object_path(path)
    url = f"{_supabase_url()}/storage/v1/object/{BUCKET}/{path}"
    key = _service_key()
    request = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {key}", "apikey": key},
    )
    suffix = PurePosixPath(path).suffix or ".bin"
    try:
        with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310 (URL de confiance)
            data = response.read()
    except urllib.error.HTTPError as exc:
        raise StorageError(f"Téléchargement impossible ({exc.code}).") from exc
    except urllib.error.URLError as exc:
        raise StorageError(f"Storage injoignable : {exc.reason}.") from exc

    fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    with os.fdopen(fd, "wb") as out:
        out.write(data)
    return tmp_path

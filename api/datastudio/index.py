"""Point d'entrée de la fonction Python Vercel pour l'API SCS DataStudio.

Vercel détecte automatiquement l'application ASGI exportée sous le nom `app`.
Le moteur et la couche API vivent dans `services/datastudio/` (partagés avec le
mode autonome / les tests) ; on les rend importables en ajoutant ce dossier au
chemin de recherche Python. Les fichiers de `services/datastudio/` sont inclus
dans le bundle de la fonction via `includeFiles` dans vercel.json.
"""

import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_SERVICE = os.path.join(_ROOT, "services", "datastudio")
if _SERVICE not in sys.path:
    sys.path.insert(0, _SERVICE)

from api.app import app  # noqa: E402,F401  (application ASGI servie par Vercel)

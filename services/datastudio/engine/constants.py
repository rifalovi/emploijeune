"""Constantes partagées par le moteur SCS DataStudio.

Extrait de l'application desktop SCS DataStudio V4.8 (module de calcul, sans
dépendance à l'interface Tkinter) pour intégration en ligne dans la plateforme
Emploi Jeune.
"""

# Codes texte considérés comme des valeurs manquantes lors de l'épuration.
# Repris à l'identique de l'application desktop pour garantir des résultats
# strictement identiques entre le bureau et la version en ligne.
MISSING_CODES = {
    "",
    "missing",
    "##n/a##",
    "n/a",
    "na",
    "nd",
    "null",
    "none",
    "tbd",
    "-",
}

# Libellé affiché pour une valeur manquante dans les tris à plat et croisements.
MISSING_LABEL = "[Manquant]"

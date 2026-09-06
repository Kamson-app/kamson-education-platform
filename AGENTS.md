# Instructions pour l'Assistant de Codage AI

## Règles de formatage mathématique

1. **Format des exposants et puissances** :
   - Pour TOUTE expression mathématique contenant un exposant ou une puissance, utilise obligatoirement le format Markdown avec LaTeX.
   - Par exemple, écris toujours `$x^2$` au lieu de `x^2` ou `x²`.
   - N'utilise jamais l'accent circonflexe seul (ex: `^`) pour désigner les puissances dans le texte final en dehors des blocs mathématiques LaTeX. Évite également l'usage de caractères spéciaux de puissances comme `²`, `³`, etc., préfère toujours le format LaTeX standard (`$x^2$`, `$x^3$`).

2. **Génération par les modèles d'IA (Gemini)** :
   - Assure-toi que tous les prompts système ou les consignes de génération envoyés à l'API Gemini contiennent explicitement cette règle mathématique critique pour que les contenus générés (exercices, fiches de préparation APC, épreuves, corrigés) respectent également ce format.

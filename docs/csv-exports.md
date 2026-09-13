# Exports CSV destinés à la lecture dans un tableur

Le lot 105 regroupe les quatre exports CSV existants (registre salariés, récurrences compagnie, suivi administratif et dossier technicien) dans `shared/csvExport.ts`.

Chaque champ est entouré de guillemets ; les guillemets internes sont doublés. Les lignes utilisent CRLF et le fichier commence par un BOM UTF-8 pour les libellés multilingues. Les séparateurs et retours à la ligne appartenant à une valeur ne créent donc pas de nouvelle colonne ou ligne logique. Les valeurs nulles restent des cellules vides.

Une apostrophe marque comme texte les valeurs commençant par un préfixe de formule, y compris les variantes pleine largeur et les espaces/caractères invisibles avant ce préfixe. Les débuts tabulation/CR/LF sont également marqués. Ce choix modifie la représentation exportée de ces valeurs ; le CSV est destiné à la lecture humaine et ne remplace pas un export structuré sans transformation.

La protection n’est pas universelle pour tous les tableurs ou les cycles de réenregistrement. OWASP décrit notamment la suppression possible des marqueurs lors d’un enregistrement et d’une réouverture dans Excel : [CSV Injection](https://community.owasp.org/attacks/CSV_Injection). Aucun tableur réel n’a été piloté pour ce lot.

Les tests couvrent les séparateurs, guillemets, retours à la ligne, accents, arabe, valeurs vides, préfixes de formule simples/cachés et tentatives de création d’une nouvelle cellule. Les droits et les champs métier exportés restent ceux des quatre parcours existants.

Validation finale : 284 tests réussis (208 PostgreSQL), TypeScript et build réussis. Pas de recette navigateur ou tableur. Avertissement de bundle inchangé.

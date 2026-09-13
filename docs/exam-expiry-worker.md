# Finalisation des examens expirés

Le traitement sélectionne jusqu’à 100 sessions actives expirées, dans l’ordre de leur échéance puis de leur identifiant. Il utilise exclusivement le correcteur serveur et les réponses sauvegardées avant échéance.

L’échec d’une session n’interrompt plus le lot. Une observation est enregistrée dans `exam_finalization_failures` avec identifiant de session, code d’erreur normalisé et date de nouvelle tentative, cinq minutes plus tard. Les sessions temporairement différées sont exclues de la sélection ; elles ne monopolisent donc pas les cent premières positions à chaque passage. Le journal interdit UPDATE/DELETE/TRUNCATE et ne contient ni réponses ni erreur technique brute.

L’onglet conformité ADMIN affiche les 100 plus anciennes sessions encore actives ayant échoué, avec inscription concernée, nombre d’échecs et reprise prévue. Une finalisation réussie les retire de cette liste par son changement d’état ; leur journal demeure. Le démarrage d’un examen indique que le résultat précédent est en traitement si une session expirée reste bloquée, sans permettre de contourner le nombre de tentatives.

Le serveur lance le traitement au démarrage puis toutes les 30 secondes, sans chevauchement dans un même processus. Le correcteur verrouille les sessions et reste idempotent en cas de soumission simultanée. Une panne de base de données est signalée séparément ; elle ne peut être traitée comme une simple incohérence de session.

Validation PostgreSQL : une session avec banque incohérente, suivie d’un examen valide, ne bloque pas la clôture du second. L’erreur est conservée une fois, la nouvelle tentative immédiate est différée et aucune note artificielle n’est attribuée à la session incohérente. Test de protection du journal contre suppression.

Restent supervision externe du worker, métriques/alertes durables, diagnostic guidé et correction contrôlée des anciennes banques, pagination ADMIN au-delà de 100 sessions et stratégie de conservation du journal. Les administrateurs ne disposent pas d’un bouton forçant une note ou reconstituant arbitrairement une banque historique.

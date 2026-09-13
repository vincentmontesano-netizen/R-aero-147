# Confidentialité de l’assistance

Les conversations sont personnelles : seul le demandeur ou un administrateur peut lire le fil et répondre. Les rôles instructeur et company_manager ne donnent plus un accès global aux tickets d’autres personnes. La liste du back-office et les changements de statut sont réservés à ADMIN. Un instructeur ou manager conserve naturellement l’accès à ses propres demandes.

Les sujets, messages et priorités sont bornés/validés côté API. Les lectures de noms d’auteurs ne chargent plus les données d’authentification des comptes. Les notifications existantes restent dans le parcours autorisé, après la vérification d’accès.

Tests PostgreSQL via le routeur réel : lecture/réponse/liste/statut étrangers refusés pour instructeur et manager, propriétaire autorisé, ADMIN autorisé, aucune réponse ajoutée lors d’un refus et accès de l’instructeur à son propre ticket. Aucun email ni message externe n’a été envoyé pendant ces tests.

Restent délégation explicite à un agent de support, tickets réellement partagés avec une compagnie sur consentement, journal des changements de statut, notifications durables, pagination et archivage. L’appartenance à une compagnie seule n’autorise pas la lecture des demandes personnelles de ses membres.

# Narration audio : langues et validation

Le service de narration utilise désormais `fr-FR`, `en-US` ou `ar-XA` pour Google Cloud TTS selon la langue de la formation. Auparavant, l’arabe retombait sur `en-US`. Le code `ar-XA` correspond à l’arabe standard moderne dans la [documentation officielle Google](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types), consultée le 13 septembre 2026.

La requête demande toujours du MP3. Le transport Mistral conserve `stream: false` et lit `audio_data` en base64, conformément à la [référence officielle Speech](https://docs.mistral.ai/api/endpoint/audio/speech). Google fournit `audioContent` ; OpenAI conserve son transport binaire existant. Les modèles et voix configurés ne sont pas remplacés ; la voix Mistral peut influer sur l’accent, même lorsque le texte est dans une autre langue. Aucun clonage de voix ajouté.

Avant tout appel, le texte est nettoyé aux extrémités, doit être non vide et rester dans la limite existante de 20000 caractères. La langue est FR/EN/AR. Le schéma de route refuse aussi les textes ne contenant que des espaces avant réservation du quota. Les limites fournisseur, qui peuvent être inférieures ou exprimées en octets/tokens, restent distinctes : pas de découpage automatique ajouté.

Les réponses JSON audio doivent contenir une chaîne base64 canonique non vide, de taille bornée. Une réponse JSON malformée, un champ non textuel ou un encodage invalide est refusé avec une erreur générique. Avant persistance, le service refuse les octets vides, de plus de 50 Mio ou dépourvus de signature MP3 reconnue par le stockage existant. Cela n’est pas un décodage complet du fichier ni une garantie de lecture ou de prononciation. La lecture HTTP précède ce contrôle de taille ; le service n’implémente pas encore un arrêt du flux au seuil d’octets.

Les erreurs HTTP de synthèse conservent fournisseur et statut, sans recopier le corps fournisseur. Les droits de cours, stockage privé et quota persistent via les contrôles existants. Les autres services IA conservent leur traitement d’erreurs propre.

## Vérification

229 tests réussis, dont 173 PostgreSQL ; TypeScript/build réussis. Trois nouveaux tests HTTP simulés couvrent les trois langues Google, texte nettoyé, conservation du propriétaire, transports binaire/JSON, base64 invalide, JSON malformé, contenu non audio/vide, absence de persistance et erreurs fournisseur sans corps brut. Aucun appel fournisseur réel : écoute, qualité pédagogique, accents et activation des services/clés restent à vérifier. Aucune migration ni nouvelle recette Docker nécessaire pour cette modification applicative.

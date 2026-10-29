# NELVIS SOCIAL RSS

Automatisation de publications sur Pages Facebook à partir de flux RSS, avec GitHub Actions et Meta Graph API.

## Configuration
1. Modifier `config/feeds.json` pour renseigner les flux RSS autorisés et l'identifiant de la Page Facebook.
2. Ajouter dans GitHub > Settings > Secrets and variables > Actions :
   - `FACEBOOK_PAGE_ACCESS_TOKEN` : jeton de Page Meta avec `pages_manage_posts`.
3. Activer GitHub Actions et exécuter le workflow `RSS to Facebook` manuellement pour tester.
4. Activer chaque flux avec `enabled: true` après validation.

## Fonctionnement
Le script lit les flux, sélectionne au maximum une nouvelle entrée par exécution et par source, puis publie le titre, un résumé court et le lien de l'article. Le mode par défaut est DRY_RUN : aucune publication tant que `PUBLISH_ENABLED` n'est pas défini à `true` dans les variables du dépôt.

Le registre des liens publiés est conservé dans un cache GitHub Actions. Pour une exploitation intensive, prévoir une base de données persistante et un mécanisme de verrouillage.

Attention : respecter les droits d'auteur, les conditions des sources RSS et les autorisations Meta. Les profils Facebook personnels ne sont pas pris en charge.

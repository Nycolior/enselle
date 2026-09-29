# EnSelle

Application web installable (PWA) : carnet d'entretien + rappels pour ta moto.
Gratuite, sans compte, sans serveur : les données restent sur ton téléphone.

## Mettre l'appli en ligne gratuitement (GitHub Pages, ~10 min)

1. Crée un compte gratuit sur https://github.com
2. Clique sur « New repository », nomme-le `enselle`, laisse-le **Public**, crée-le.
3. Clique sur « uploading an existing file » et glisse **le contenu** du dossier
   (index.html, app.js, logic.js, plans.js, sw.js, manifest.webmanifest et les dossiers icons et fonts).
   Valide avec « Commit changes ».
4. Va dans Settings → Pages → « Deploy from a branch », branche `main`, dossier `/ (root)`, Save.
5. Après une minute, l'adresse s'affiche : `https://TON-PSEUDO.github.io/enselle/`

Alternative sans Git : https://app.netlify.com/drop (glisser le dossier, créer un compte gratuit pour garder le site).

## Installer sur le téléphone

- **Android (Chrome)** : ouvre l'adresse → menu ⋮ → « Installer l'application ».
- **iPhone (Safari)** : ouvre l'adresse → bouton Partager → « Sur l'écran d'accueil ».
  Ouvre ensuite l'appli depuis l'icône (les notifications ne marchent que comme ça sur iPhone).

Puis, dans l'appli : Réglages → Rappels → Activer.

## Comment marchent les rappels

- À chaque ouverture, l'appli vérifie les échéances et envoie une notification pour ce qui est « bientôt » ou « en retard ».
- Sur Android + Chrome, l'appli installée peut aussi vérifier une fois par jour en arrière-plan
  (c'est Chrome qui décide du moment exact ; ça dépend de l'usage de l'appli).
- Pour un rappel garanti même sans ouvrir l'appli : bouton « Agenda » sur une opération (Google Agenda)
  ou Réglages → « Agenda du téléphone » → Exporter (.ics, idéal sur iPhone). Refais l'export après une grosse révision.
- Les échéances en km sont converties en date grâce à tes relevés de compteur : relève-le de temps en temps (à chaque plein par exemple).

## Sauvegarde

Les données sont stockées dans le navigateur du téléphone. Réglages → Sauvegarder produit un fichier .json à garder
dans ton Drive/iCloud ; « Restaurer » le recharge (changement de téléphone, par exemple).

## Bibliothèque de modèles

Quand tu crées une moto, EnSelle reconnaît le modèle tapé et charge son plan constructeur
(fichier `plans.js`, 12 modèles courants). Pour un modèle absent, le plan type générique est proposé.
Les intervalles viennent des manuels constructeurs : vérifie-les toujours avec le carnet de ta moto.

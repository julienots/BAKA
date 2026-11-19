# LE MANTEAU ROUGE

Un jeu d'aventure 2.5D sombre et émouvant, pour Android et navigateur.
C'est une **vraie scène 3D filmée de côté** : on avance vers la droite, mais Mio peut aussi aller vers le fond ou vers l'avant de l'écran.

> Mio, un tout petit enfant au long manteau, se réveille seul dans une forêt morte.
> Au loin, une silhouette emporte un petit manteau rouge : celui de sa sœur.
> Il la suit à travers une usine, une maison déformée et un marais noyé, jusqu'au sommet d'une colline à l'aube.

**APK prêt à installer : [`apk/LeManteauRouge.apk`](apk/LeManteauRouge.apk)**

---

## Installer l'APK
1. Copiez `apk/LeManteauRouge.apk` sur votre téléphone Android (Android 6 ou plus récent, avec OpenGL ES 3).
2. Ouvrez le fichier et autorisez « Installer des applications inconnues » si Android le demande.
3. Le jeu se lance en plein écran, en paysage.

L'APK est signé avec une clé de débogage : il s'installe à la main, mais il ne peut pas être publié tel quel sur le Play Store.

## Commandes
| Action | Tactile | Clavier | Manette |
|---|---|---|---|
| Marcher / profondeur | joystick à gauche (n'importe où dans la moitié gauche) | flèches / ZQSD / WASD | stick gauche |
| Courir | pousser le joystick à fond | Maj | stick à fond |
| Sauter / grimper | bouton ↑ | Espace | A |
| Agir (levier, loquet, ramasser) | bouton ✋ (maintenir pour un loquet) | E | X |
| Utiliser le pouvoir | bouton rond coloré (maintenir pour Lueur / Écho) | F | B / RT |
| Changer de pouvoir | bouton ⇄ | Tab ou 1-4 | Y / LB / RB |
| Pause | II | Échap | Start |

Il n'y a aucun texte d'aide dans le jeu : le décor guide le joueur.

**Grimper** :
- **Rebords bas** (jusqu'à environ 1,6 m) : sautez contre le rebord, Mio s'y hisse.
- **Rebords hauts** attrapés en plein saut : Mio s'y **suspend**. Poussez vers le rebord (ou sautez) pour vous rétablir, ou tirez dans l'autre sens pour lâcher.
- **Échelles** : placez-vous devant et poussez le joystick vers le haut. Saut pour lâcher.

Le saut est à hauteur variable : un appui bref donne un petit saut.
Grimper : sautez contre un rebord (jusqu'à environ 1,6 m). Pousser : marchez contre une caisse.
Se cacher : entrez dans l'ombre (sous un lit, derrière une machine). Mio s'accroupit tout seul.

## Les pouvoirs
Ils naissent des souvenirs de sa sœur, noués à des rubans rouges.

| Pouvoir | Chapitre | Effet |
|---|---|---|
| **Lueur** | I | Maintenir pour charger, relâcher : une onde de chaleur (distorsion, braises, lumière dynamique) qui fait fuir les loups, brûle les ronces d'ombre et dissout les Ombres. |
| **Souffle** | II | Rafale avec distorsion de l'air et poussière : projette les caisses, même en fonte, et repousse les ennemis. |
| **Écho** | III | Maintenir : vision du passé, monde bleuté et ondulant, le temps ralentit pour les ennemis, et les meubles-souvenirs deviennent solides. |
| **Pas d'ombre** | IV | Glissement instantané dans n'importe quelle direction (profondeur comprise). Mio laisse des silhouettes fantômes derrière lui et traverse les grillages. |

## Les chapitres (environ 20 minutes)
1. **La Forêt morte (le déni).** Réveil, premiers pas dans la profondeur, escalade, caisse. Les loups surgissent du fond de l'écran pendant que Mio ouvre un loquet. Le ruban rouge donne la Lueur.
2. **L'Usine (la colère).** Une caisse, un levier et un rideau de fer. La Présence fouille le hall au projecteur derrière la verrière, et il faut se cacher derrière les machines. Après le Souffle et la caisse de fonte sur la plaque, Mio fuit sur une passerelle qui s'effondre derrière lui.
3. **La Maison (le marchandage).** La maison d'enfance, immense. Une main interminable fouille la chambre et il faut se cacher sous le lit. L'Écho fait réapparaître les meubles du passé pour grimper au grenier. Dans la cuisine, une deuxième main.
4. **Le Marais (la tristesse).** Pluie, eau noire, pontons brisés, grillages et Ombres. Au bout du pont, une petite silhouette en manteau rouge s'efface.
5. **La Colline (l'acceptation).** L'aube se lève à mesure que Mio monte. Les loups ne chassent plus : ils attendent, et la Lueur les apaise. Au sommet, Mio laisse le manteau s'envoler. Il se réveille dans une vraie chambre, à côté d'un lit vide.

### Secrets : les 5 souvenirs
- **Le dessin** : chapitre I, sur une souche derrière un grand pin, tout au fond (après la falaise).
- **La boîte à musique** : chapitre II, hall de la caisse de fonte, au premier plan, au pied d'une machine.
- **Le lapin « Pompon »** : chapitre III, au grenier (accessible seulement par l'Écho).
- **La moufle rouge** : chapitre IV, au fond du grand ponton, près des Ombres.
- **La photo** : chapitre V, sur un rocher qu'on n'atteint qu'avec l'Écho.

Les cinq souvenirs ajoutent un détail à la dernière scène.

## Technique
- **Moteur** : Three.js (WebGL 2) avec un rendu maison, empaqueté pour Android avec Capacitor.
- **Rendu** :
  - textures en relief (normal maps calculées) ;
  - brouillard volumétrique global, plus dense près du sol et animé par un bruit 3D ;
  - occlusion ambiante en espace écran ;
  - profondeur de champ calculée à partir de la distance réelle ;
  - bloom sur deux niveaux avec halo chaud de pellicule ;
  - rayons volumétriques tramés (sans effet d'escalier) ;
  - eau à reflets avec gouttes de pluie ;
  - netteté, grain organique, vignettage, aberration chromatique ;
  - étalonnage par chapitre : seul le rouge garde sa couleur.
- **Modèle de Mio** : créé avec **Tripo AI** (`public/models/mio.glb`).
  - Génération texte → 3D, retopologie à 9 617 quads, squelette Mixamo de 65 os.
  - Les poses du squelette procédural (ressorts, foulée, escalade…) sont retransmises chaque image sur ses os (`src/game/mioSkin.js`).
  - Si le fichier manque, le jeu reprend automatiquement le Mio procédural.
- **Personnage procédural (secours)** :
  - tête sculptée (joues, orbites, nez, menton) avec paupières qui clignent ;
  - mèches de cheveux, bonnet côtelé, manteau à plis avec brandebourgs, bottes à semelle, mains avec doigts et pouce ;
  - matériaux réalistes : laine et feutre avec reflet satiné, peau légèrement translucide, yeux vernis.
- **Animation** :
  - chaque articulation suit un ressort physique, ce qui donne de l'inertie sans aucun à-coup ;
  - la foulée est synchronisée sur la distance parcourue (les pieds ne glissent pas) et la marche se mêle à la course selon la vitesse ;
  - le bassin rebondit, roule et pivote, les épaules contre-tournent, le corps s'incline dans les virages et à l'accélération, et l'atterrissage est amorti ;
  - Mio a une vie au repos : il transfère son poids, regarde autour de lui et se frotte les bras de froid ;
  - escalade en 4 temps (accroche, traction, genou, redressement), suspension aux rebords, échelles ;
  - mouvements secondaires : pans du manteau, pompon, sac à dos et écharpe en tissu simulé.
- **Créatures** : loups quadrupèdes à démarche procédurale, géant au projecteur avec détection en ligne de vue, main à cinématique inverse, Ombres.
- **Musique et son** : 100 % Web Audio, aucun fichier audio.
  - Orchestre synthétique : cordes, chœur, boîte à musique avec usure de bande, violoncelle, taïkos, cuivres et frappes métalliques.
  - Musique adaptative :
    - exploration : nappes de cordes et de chœur, avec des fragments de comptine à la boîte à musique ;
    - danger : pulsation de violoncelle et trémolo dissonant ;
    - poursuite : taïkos, ostinato et cuivres à 136 bpm.
  - Battements de cœur, souffle de Mio (effort, peur).
  - Pas en deux temps (talon puis pointe) selon le sol, froissement du manteau.
  - Loups (hurlements à formants, grognements, halètements, pattes), géant, main, ambiances propres à chaque lieu.
  - Réverbérations de salle et de cathédrale ; sons spatialisés à gauche et à droite.
- **Qualité** réglable (basse / moyenne / élevée) : résolution, ombres, échantillons de flou, rayons, densité des décors.
- Sauvegarde automatique (stockage local), mort douce avec retour au dernier point de passage.

### Organisation du code
```
src/core/    rendu (post.js), entrées, audio procédural, particules, textures, matériaux
src/game/    game.js (boucle, chapitres, sauvegarde), world.js (physique + entités),
             player.js, mio.js (modèle + animation), powers.js, enemies.js, props.js, fx.js, camera.js
src/levels/  ch1.js … ch5.js : chaque niveau est décrit par des données (blocs, caisses, leviers, déclencheurs, cadrages)
src/ui/      menus, options, commandes tactiles
tests/       bot.cjs : robot qui joue chaque chapitre jusqu'au bout pour vérifier qu'on peut le terminer
```

## Réglages simples à modifier
- **Vitesse, saut, escalade** : `src/game/player.js`, objet `TUNING` (`walk`, `run`, `jumpV`, `climbMax`…).
- **Difficulté** :
  - vitesse des loups : `speed` dans `src/game/enemies.js`, classe `Wolf` (3,4 par défaut) ;
  - vigilance du projecteur : `dt * 1.0` dans la classe `Presence`. Une valeur plus petite rend le projecteur plus indulgent ;
  - rayon de la Lueur : `R = 3.5 + k * 5` dans `src/game/powers.js` ;
  - durée de l'Écho : `dt / 7` (7 secondes) dans `powers.js`.
- **Couleurs et ambiance par chapitre** : en haut de chaque `src/levels/chN.js`, `grade` (saturation, teinte, contraste, exposition), `rays`, `bloom`, `aperture` (flou) et `setupLights` (brouillard, lumières).
- **Volume, qualité, vibrations, taille des commandes** : dans le menu Options du jeu.

## Compiler soi-même
```bash
npm install
npm run dev            # version navigateur sur http://localhost:5173
npm run build          # version web dans dist/
npm run android:apk    # nécessite le SDK Android (ANDROID_HOME) → android/app/build/outputs/apk/debug/app-debug.apk
npm run test:bot -- 0  # le robot joue le chapitre I (0 à 4)
```

VOYAGE NOMADE v22 — prototype iPhone
========================================

Ce qui a été récupéré de l'ancien travail :
- identité « Voyage Nomade » et style carnet de voyage ;
- image héros Corse ;
- participants et prénoms modifiables ;
- Pot commun avec versements ;
- enregistrement des achats faits avec la carte du pot ;
- calcul individuel : versé moins dépensé = avance / montant à remettre ;
- itinéraire avec étapes, dates et notes ;
- galerie avec ajout de photos et diaporama.

Ce qui a été volontairement retiré :
- « Budget prévu » ;
- budget général ;
- tickets/scans ;
- comptabilité et remboursements complexes ;
- hébergements, restaurants, transport, activités, documents et check-list de l'ancienne version : ils pourront être réintroduits plus tard si vraiment utiles.

IMPORTANT — VERSION LOCALE SANS la solution en ligne précédente
---------------------------------------
Cette version fonctionne localement sur l'ordinateur. Les voyages, dépenses, participants, étapes et photos sont enregistrés dans le navigateur via localStorage.
Aucun compte la solution en ligne précédente, aucune base la solution en ligne précédente, aucune fonction la solution en ligne précédente et aucun serveur la solution en ligne précédente ne sont nécessaires.
Le champ « J’ai déjà un carnet » conserve l’identifiant dans ce navigateur : il ne permet pas de partager automatiquement les données avec un autre appareil.
La carte utilise OpenStreetMap en ligne lorsque l’ordinateur est connecté à Internet.

L'interface est conçue en priorité pour l'iPhone, en portrait.


V23 — MULTI-VOYAGES
Chaque voyage possède ses propres participants, versements, dépenses, étapes et photos. Créer un nouveau voyage démarre avec un pot à 0 €. La synchronisation entre plusieurs iPhone devra être branchée avec une base de données en ligne.


V24 — EXPORT PDF DU POT COMMUN
Un bouton PDF permet d'imprimer/enregistrer un état du pot avec total versé, total dépensé, reste, détail par participant, calcul « qui doit à qui » et liste des dépenses.


V25 — CARNET SOUVENIR / KDP
---------------------------
Ajout d'un bouton « Carnet souvenir ».
Il génère un aperçu imprimable à partir du voyage : couverture avec l'image de Corse, présentation du voyage, étapes datées, photos partagées et page de fin.
Le document s'ouvre dans une nouvelle fenêtre puis peut être imprimé/enregistré en PDF depuis l'iPhone.
Ce prototype prépare le contenu ; les dimensions et la couverture KDP définitives seront à ajuster au format de livre choisi.


V26 — COUVERTURE ÎLE-ROUSSE
---------------------------
Ajout de la belle photo de L'Île-Rousse (rochers et mer) en couverture visuelle de l'accueil.
Source : Pexels, photo « Rocky Shoreline in L'Île-Rousse, Corsica », indiquée « Free to use ».
URL image utilisée par l'accueil : https://images.pexels.com/photos/35577368/pexels-photo-35577368.jpeg?auto=compress&cs=tinysrgb&w=1600


V27 — PHOTO ÎLE-ROUSSE CORRIGÉE
-------------------------------
Correction importante : la photo de couverture est maintenant un fichier local inclus dans le ZIP (images/ile-rousse.jpg) et remplace directement l'ancienne image corse dans la grande carte de l'accueil.
La page d'accueil est aussi définie comme écran initial, et « Mes voyages » n'est plus affiché simultanément.
La photo utilisée est une illustration photoréaliste créée pour le prototype, représentant L'Île-Rousse et ses rochers roux.


V28 — BILAN POT COMMUN COMPACT
------------------------------
Le PDF du pot commun a été refait sous forme de liste compacte :
- résumé de chaque participant sur une ligne ;
- « qui doit à qui » sur une ligne par remboursement ;
- dépenses sur une ligne chacune ;
- marges et tailles réduites pour éviter les tableaux très longs et limiter fortement le nombre de pages.


V29 — PDF STYLE FEUILLE EXCEL
Le bilan du pot commun est maintenant présenté comme une feuille de calcul imprimable : grille, colonnes, en-têtes gris, montants alignés et format A4 portrait compact.


V30 — PHOTO DE COUVERTURE FOURNIE PAR L'UTILISATEUR
----------------------------------------------------
La photo fournie par l'utilisateur est désormais utilisée comme image locale de couverture :
images/ile-rousse.jpg
Elle remplace l'image précédente et sert à l'accueil ainsi qu'au futur carnet souvenir.


V31 — PHOTO PAR VOYAGE + CARTE ROUTIÈRE
----------------------------------------
Chaque voyage peut maintenant avoir sa propre photo de couverture.
- Depuis l'accueil : bouton « Changer la photo ».
- Lors de la création d'un voyage : choix de la photo.
- La photo est enregistrée avec le voyage et apparaît dans « Mes voyages ».

Ajout d'une page « Carte » avec une carte OpenStreetMap.
Les étapes sont géolocalisées automatiquement quand leur nom est reconnu.
Un bouton permet aussi d'ouvrir l'itinéraire complet dans Google Maps.
La carte nécessite Internet, ce qui est normal pour la version mise en ligne.


V32 — MODIFIER / SUPPRIMER UNE ÉTAPE
Chaque étape de l'itinéraire dispose maintenant de boutons Modifier et Supprimer. Modifier permet de changer le lieu, la date et la note sans recréer l'étape.


V33 — PHOTO DE VOYAGE CORRIGÉE
--------------------------------
Les photos de couverture choisies sur ordinateur/iPhone sont maintenant redimensionnées et converties en JPG avant stockage local. Cela évite les images cassées causées par les photos iPhone trop lourdes. La photo choisie lors de « Créer un nouveau voyage » est également réellement enregistrée comme couverture.

V34 — CORRECTION CARNET SOUVENIR PAR VOYAGE
--------------------------------------------
Le carnet souvenir utilise maintenant la photo de couverture du voyage actuellement sélectionné.
Ainsi, si le voyage « Pyrénées » a sa propre photo, le PDF « Carnet souvenir » des Pyrénées reprend cette photo et ne réutilise plus automatiquement la photo de Corse.
Un secours vers la photo de L’Île-Rousse est prévu uniquement si la photo du voyage est introuvable.

V35 — CALCUL DU REMBOURSEMENT DES DÉPENSES DU POT
--------------------------------------------------
Une dépense du pot indique clairement la personne qui a payé avec la carte.
Le bilan répartit les dépenses du pot à parts égales entre les participants et calcule automatiquement les remboursements.
Exemple : 637,01 € payés par Polo à deux participants => Jojo doit environ 318,50 € à Polo (arrondi au centime).
Le remboursement n'ajoute pas une nouvelle dépense au pot.

V36 — POT COMMUN SIMPLIFIÉ
--------------------------
- Les versements alimentent le pot et ne sont plus présentés comme des « avances ».
- Chaque dépense de la carte est répartie à parts égales entre les participants.
- La personne qui a payé avec la carte reçoit le remboursement correspondant des autres participants.
- Exemple à 2 : 637,01 € payés par Polo => Jojo doit 318,50 € à Polo.
- Le remboursement est séparé du pot et peut être marqué « Remboursé ».
- Le PDF reprend la même logique de calcul.

V37 — DÉPENSE PARTAGÉE
----------------------
Une dépense peut maintenant être marquée « Répartir cette dépense à parts égales entre les participants ».
Exemple à deux : billet de traversée 637,01 € => 318,50 € pour chacun (avec correction d'arrondi pour conserver exactement 637,01 €).
Les deux parts apparaissent dans les dépenses, afin que le carnet reflète la part de chacun, tout en conservant le total réel payé par la carte.

V38 — AFFICHAGE DES DÉPENSES PARTAGÉES
---------------------------------------
Les dépenses marquées comme partagées sont maintenant affichées comme des parts individuelles dans « Dépenses avec la carte ».
Exemple : billet de traversée 637,01 € à deux => deux lignes de 318,50/318,51 €, avec le participant indiqué.
Le total dépensé en haut reste 637,01 €.

V39 — CORRECTION DES PARTICIPANTS ET DES PARTS
----------------------------------------------
Les anciens achats dont le payeur n'était pas encore enregistré comme participant sont réparés automatiquement.
Une dépense par carte est affichée avec une ligne par participant.
Exemple : 637,01 € de traversée à deux => 318,50 € pour Jojo et 318,50 € pour Polo.
Le total bancaire reste 637,01 € ; le centime restant est traité comme un écart d'arrondi.

V40 — SIMPLIFICATION DU POT
---------------------------
Suppression du compteur principal « Total versé » : il additionnait tous les versements historiques et créait un montant inutile comme 955,51 €.
Le pot met désormais en avant les dépenses réelles effectuées avec la carte.
Le remboursement de 318,50 € de Jojo est un règlement entre participants, pas un nouveau versement à additionner au pot.

V41 — PDF SIMPLIFIÉ
------------------
Suppression du « Total versé » dans le résumé PDF.
Le résumé PDF affiche désormais uniquement le total réellement dépensé avec la carte et le reste du pot.
La colonne « Versé » du tableau des participants est également supprimée : le document se concentre sur les dépenses et les soldes.

V43 — POT RÉALIMENTABLE
----------------------
Le pot distingue maintenant :
- le solde disponible actuellement ;
- l'historique des dépenses déjà enregistrées.
Après remise à zéro, l'historique (par exemple la traversée à 637,01 €) reste visible, mais le solde disponible est 0,00 €.
« Réalimenter le pot » ajoute de l'argent au solde disponible.
Une nouvelle dépense diminue ce solde et reste enregistrée dans l'historique.
Le PDF indique le total des dépenses enregistrées et le solde disponible actuel.

V45 — PAIEMENTS RÉELS DE LA CARTE
---------------------------------
Une dépense n'est plus divisée automatiquement entre les participants.
Chaque ligne correspond à une opération réelle de la carte.
Exemple : Polo paie 317 € pour la réservation et Jojo paie 317 € pour la même réservation => deux lignes de 317 €, total carte 634 €.
Aucun remboursement n'est créé lorsque chacun a payé directement sa part.

V46 — CARTOUCHE « CRÉER UN NOUVEAU VOYAGE »
--------------------------------------------
Cartouche élargie.
Champ du nom/description prévu sur deux lignes et redimensionnable.
Le texte peut contenir une description plus longue du voyage, par exemple :
« Corse 2026 — tour de l’île en camping-car, arrivée par l’Île-Rousse… »
Les dates et le choix de photo restent inchangés.


Version v47 : correction du suivi du pot commun. Les versements alimentent le pot indépendamment des remboursements. Les dépenses partagées sont réparties entre les participants. Une dépense peut maintenant être modifiée ou supprimée pour corriger une erreur de personne ou de montant.


V_LOCAL — VERSION LOCALE
----------------------------
Le prototype a été converti pour un fonctionnement local :
- suppression des dépendances @la solution en ligne précédente/* ;
- suppression de la base Drizzle/la solution en ligne précédente et des fonctions serveur ;
- sauvegarde des voyages et photos dans le navigateur ;
- démarrage local possible avec `python3 -m http.server 8889`.

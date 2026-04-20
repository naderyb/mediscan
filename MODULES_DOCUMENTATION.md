# MediScan - Documentation des Nouveaux Modules

## 📋 Modules Ajoutés

### 1. Module de Modification du Dossier Patient (EditDossierModal)

**Description:** Permet de modifier tous les champs du dossier patient après sa création.

**Localisation:** `src/App.jsx` (Fonction: `EditDossierModal`)

**Accès:**

- Ouvrez le dossier d'un patient
- Cliquez sur le bouton **"✎ Modifier"** à côté du bouton "Imprimer bracelet"

**Champs modifiables:**

- **Identité:** Prénom, Nom, Date de naissance, Sexe, Téléphone, Adresse
- **Informations médicales:**
  - Groupe sanguin
  - Date d'admission
  - Médecin traitant
  - Service / Unité
  - Maladies chroniques
  - Allergies
  - Traitements en cours
  - Notes & Observations

**Fonctionnement:**

1. Le formulaire se remplit automatiquement avec les données actuelles du patient
2. Modifiez les champs souhaités
3. Cliquez sur "Enregistrer les modifications"
4. Les changements sont sauvegardés immédiatement dans la base de données
5. Le dossier affiché se met à jour automatiquement

---

### 2. Module de Recherche par Date et Nom/Prénom (SearchPatients)

**Description:** Permet de rechercher des patients selon plusieurs critères (nom/prénom et/ou période d'admission).

**Localisation:** `src/App.jsx` (Fonction: `SearchPatients`)

**Accès:**

- Accédez à la section **"Recherche"** entre la section Scanner et la liste des patients
- Cliquez sur **"Afficher la recherche"** pour dérouler les filtres

**Critères de recherche:**

1. **Nom ou Prénom** - Tapez le nom ou le prénom du patient (recherche partielle)
2. **Date d'admission (De)** - Sélectionnez la date de début (optionnel)
3. **Date d'admission (À)** - Sélectionnez la date de fin (optionnel)

**Comportement:**

- Les résultats s'affichent en temps réel au fur et à mesure de la saisie
- Les filtres peuvent être combinés (ex: chercher un nom ET une plage de dates)
- Le nombre de résultats trouvés s'affiche
- Cliquez sur un résultat pour ouvrir le dossier complet du patient
- Bouton **"Réinitialiser"** pour effacer tous les filtres

**Affichage des résultats:**
Chaque carte de résultat affiche:

- Avatar avec les initiales du patient
- Nom complet
- Numéro de dossier (ID)
- Date d'admission et service

---

## 🔧 Modifications Techniques

### Fichier: `src/App.jsx`

**Imports ajoutés:**

```javascript
import { ..., updatePatient } from "./api.js"
```

**Nouveaux composants:**

- `EditDossierModal` - Formulaire de modification du dossier
- `SearchPatients` - Section de recherche avec filtres

**Nouveaux états (hooks):**

```javascript
const [editPatient, setEditPatient] = useState(null);
const [editOpen, setEditOpen] = useState(false);
```

**Nouveaux handlers:**

- `handleEditDossier()` - Traite la soumission du formulaire d'édition

**CSS ajoutés:**

- Styles pour `.search-filters`, `.search-result-card`, `.src-*`
- Styles pour `.modal-footer`
- Responsive design pour écrans ≤ 900px

### Fichier: `src/api.js`

**Aucune modification** - La fonction `updatePatient()` existe déjà et est maintenant utilisée par le module d'édition.

---

## 📱 Utilisation Pratique

### Scénario 1: Modifier les allergies d'un patient

1. Trouvez le patient (via liste ou recherche)
2. Cliquez sur sa carte pour ouvrir le dossier
3. Cliquez sur le bouton **"✎ Modifier"**
4. Modifiez le champ "Allergies"
5. Cliquez sur **"Enregistrer les modifications"**
6. Le dossier se met à jour automatiquement

### Scénario 2: Trouver tous les patients admis en mars 2025

1. Allez à la section **"Recherche"**
2. Cliquez sur **"Afficher la recherche"**
3. Laissez "Nom ou Prénom" vide
4. Sélectionnez "Date d'admission (De)" = 01/03/2025
5. Sélectionnez "Date d'admission (À)" = 31/03/2025
6. Consultez les résultats affichés

### Scénario 3: Rechercher un patient spécifique par nom

1. Allez à la section **"Recherche"**
2. Cliquez sur **"Afficher la recherche"**
3. Tapez le nom ou prénom dans le champ "Nom ou Prénom"
4. Les résultats se mettent à jour en temps réel
5. Cliquez sur le résultat pour ouvrir le dossier complet

---

## ⚙️ Gestion des Erreurs

- Si la sauvegarde échoue, une alerte affichera l'erreur
- Les données sont revalidées côté formulaire (nom et prénom obligatoires)
- La connexion API est nécessaire pour sauvegarder les modifications

---

## 🎨 Design et UX

- **Cohérence:** Les nouveaux modules utilisent le même design que les modules existants
- **Accessibilité:** Tous les champs ont des labels clairs et des espaces suffisants
- **Responsive:** Les modules s'adaptent aux petits écrans
- **Performance:** Les recherches se font instantanément en local (sans rechargement API)

---

## 📝 Notes de Développement

- Les modifications du dossier sont envoyées à l'endpoint `PUT /api/patients/{id}`
- La recherche client-side filtre la liste des patients déjà chargée
- L'état local du patient utilisé pour le dossier est mis à jour après chaque modification
- Les couleurs d'avatar sont conservées lors des modifications

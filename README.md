# Clef — Plateforme de location entre particuliers (MVP)

## 1. Stack technique retenue

| Couche | Choix | Pourquoi |
|---|---|---|
| Frontend | **Next.js 14 (App Router) + TypeScript + Tailwind** | Rendu serveur + client dans un seul projet, SEO correct pour les annonces, écosystème mature, déploiement simple (Vercel). |
| Auth | **NextAuth.js (Credentials provider)** | Sessions JWT, middleware de protection par rôle, extensible facilement à Google/Email plus tard. |
| Backend | **API Routes Next.js** (Route Handlers) | Pas de serveur séparé à gérer pour le MVP ; migrable vers un service dédié (NestJS) en V2 si besoin de scinder. |
| Base de données | **PostgreSQL + Prisma ORM** | Relationnel adapté aux règles métier (dossiers, candidatures, abonnements), migrations versionnées, typage généré automatiquement. |
| Paiement | **Stripe Checkout + Webhooks** | Standard du marché, gère le PCI-DSS à notre place, webhooks fiables pour activer l'abonnement. |
| Stockage documents | Local (`/uploads`) en dev, **S3 / Cloudflare R2** recommandé en prod | Les justificatifs (fiches de paie, avis d'imposition) doivent être stockés hors du repo, avec URLs signées. |
| Hébergement | Vercel (front + API) + Neon/Supabase (Postgres managé) | Coût maîtrisé pour un MVP, scalable. |

## 2. Architecture du projet

```
rental-platform/
├── prisma/
│   ├── schema.prisma        # schéma complet de la base
│   └── seed.ts              # jeu de données de démo
├── src/
│   ├── app/
│   │   ├── page.tsx                     # landing
│   │   ├── login/ register/             # auth
│   │   ├── listings/ [id]/              # marketplace public
│   │   ├── tenant/dashboard/            # espace locataire
│   │   ├── tenant/subscription/         # paiement Stripe
│   │   ├── owner/dashboard/             # espace propriétaire
│   │   ├── owner/listings/new/          # dépôt d'annonce
│   │   ├── admin/dashboard/             # vérification des dossiers
│   │   └── api/
│   │       ├── register/                # inscription
│   │       ├── listings/                # CRUD annonces + filtrage éligibilité
│   │       ├── applications/            # candidatures
│   │       ├── stripe/checkout|webhook  # paiement
│   │       ├── messages/                # messagerie
│   │       └── admin/tenants/[id]/review
│   ├── components/          # UI réutilisable (cartes, jauge, navbar...)
│   ├── lib/
│   │   ├── prisma.ts        # client DB
│   │   ├── auth.ts          # config NextAuth
│   │   ├── stripe.ts        # client Stripe
│   │   └── eligibility.ts   # ⭐ moteur de score de solvabilité
│   └── middleware.ts        # protection des routes par rôle
├── tailwind.config.js
└── .env.example
```

### Le cœur métier : `src/lib/eligibility.ts`

C'est le fichier le plus important du projet. Il calcule :
- un **score de solvabilité (0-100)** à partir du revenu, du type de contrat et d'un éventuel garant ;
- un **loyer maximum recommandé**, basé sur la règle des 33% mais pondéré (un CDI a un multiplicateur de 1.0, un freelance 0.8, un garant ajoute une capacité supplémentaire plafonnée).

Ce calcul est utilisé à trois endroits :
1. À l'inscription, pour initialiser le profil locataire.
2. Dans `GET /api/listings`, pour filtrer les annonces visibles par un locataire donné (avec 10% de flexibilité).
3. Dans `POST /api/applications`, pour bloquer une candidature hors budget côté serveur (pas seulement côté UI).

## 3. Schéma de base de données

Voir `prisma/schema.prisma`. Modèles clés :
- `User` (rôle TENANT / OWNER / ADMIN, statut de compte)
- `TenantProfile` (revenus, score, loyer max, statut de vérification) + `Document` (justificatifs) + `Subscription` (abonnement 17€/3 mois)
- `OwnerProfile` + `Listing` + `ListingPhoto`
- `Application` (candidature, unique par couple annonce/locataire, avec snapshot du score au moment de la candidature — traçabilité utile en cas de litige)
- `Message` (messagerie propriétaire ↔ locataire)
- `ModerationLog` (traçabilité des actions admin, anti-fraude)

## 4. Ce qui est livré dans ce MVP

**Fonctionnel :**
- Inscription locataire (avec calcul immédiat du score) et propriétaire
- Connexion sécurisée (mots de passe hashés bcrypt, sessions JWT)
- Dépôt d'annonce gratuit (propriétaire)
- Filtrage des annonces par capacité financière (avec marge de flexibilité)
- Candidature (bloquée si dossier non vérifié ou hors budget, y compris côté API)
- Paiement Stripe Checkout + activation automatique via webhook
- Dashboard admin : validation/refus des dossiers, statistiques globales
- Gestion des candidatures côté propriétaire (présélectionner / accepter / refuser)
- Messagerie basique (API prête, UI à brancher)

**Simplifié pour aller vite (voir roadmap V2) :**
- Upload de documents : le modèle `Document` existe, mais l'UI d'upload et le stockage S3 ne sont pas branchés dans ce MVP (à faire en V2, cf section 7).
- Vérification "semi-automatique" : seule la vérification manuelle admin est implémentée. L'OCR/vérification automatique est une piste V2.
- Photos d'annonces : le modèle est prêt, l'upload est à connecter à un service de stockage.
- Messagerie : API fonctionnelle, il manque l'interface de chat temps réel (V2 : websockets/polling).

## 5. Lancer le projet en local

### Prérequis
- Node.js 18+
- PostgreSQL (local ou via Docker)
- Un compte Stripe en mode test

### Étapes

```bash
# 1. Installer les dépendances
npm install

# 2. Copier et remplir les variables d'environnement
cp .env.example .env
# → renseigner DATABASE_URL, NEXTAUTH_SECRET, STRIPE_SECRET_KEY, etc.

# 3. Lancer PostgreSQL si besoin (exemple Docker)
docker run --name rental-db -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=rental_platform -p 5432:5432 -d postgres:16

# 4. Créer les tables à partir du schéma Prisma
npm run db:push

# 5. Charger le jeu de données de démo (admin / propriétaire / locataire)
npm run db:seed

# 6. Lancer le serveur de dev
npm run dev
```

L'app est disponible sur `http://localhost:3000`.

Comptes de démo créés par le seed (mot de passe : `password123`) :
- `admin@clef.fr`
- `owner@clef.fr`
- `tenant@clef.fr`

### Stripe en local

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copier le `whsec_...` affiché dans `STRIPE_WEBHOOK_SECRET`.

## 6. Explication du calcul d'éligibilité (exemple)

Locataire en CDI, revenu net 2 100 € :
- Loyer max "règle stricte 33%" : 2 100 × 0.33 = **693 €**
- Multiplicateur CDI = 1.0 → revenu effectif = 2 100 €
- Loyer max recommandé = 2 100 × 0.33 = **693 €**
- Score de solvabilité = 100/100

Même profil en freelance sans garant :
- Multiplicateur freelance = 0.8 → revenu effectif = 1 680 €
- Loyer max recommandé = 1 680 × 0.33 ≈ **554 €**
- Score ≈ 53/100

Avec un garant à 3000€/mois :
- Bonus garant = min(3000×0.5, 2100×0.6) = 1260€ (plafonné)
- Revenu effectif = 2100×0.8 + 1260 = 2940€
- Loyer max recommandé ≈ 970€
- Score ≈ 100/100 (capé)

Ce moteur est isolé dans un seul fichier testable (`eligibility.ts`) pour pouvoir affiner les pondérations sans toucher au reste du code.

## 7. Roadmap V2

**Priorité haute (renforcer la confiance et la conformité) :**
1. Upload réel des documents (S3/R2 + URLs signées) + prévisualisation dans l'admin.
2. Vérification semi-automatique : OCR sur fiches de paie/avis d'imposition (ex. via un service tiers) pour pré-remplir et flaguer les incohérences avant la revue manuelle.
3. Conformité RGPD : politique de conservation des documents, export/suppression des données à la demande.
4. Renouvellement automatique de l'abonnement (Stripe Subscriptions au lieu d'un paiement unique), emails de rappel avant expiration.

**Priorité moyenne (expérience produit) :**
5. Messagerie temps réel (WebSocket ou Pusher/Ably) avec notifications.
6. Upload multi-photos avec réorganisation (drag & drop) pour les annonces.
7. Recherche avancée (carte interactive, filtres surface/pièces/quartier).
8. Notifications email/SMS (candidature reçue, dossier validé, etc.) via Resend/Twilio.
9. Espace "brouillon" pour les annonces avant publication + prévisualisation.

**Priorité anti-fraude / scale :**
10. Détection de comptes dupliqués (email/téléphone/IP) et limitation du nombre de candidatures par jour.
11. Système de signalement d'annonces et de profils par les utilisateurs.
12. Vérification d'identité renforcée (ex. partenaire type Onfido) pour les profils à fort score.
13. Passage progressif à une architecture découplée (API séparée en NestJS, queue de jobs pour l'OCR et les emails) si le trafic le justifie.
14. Tests automatisés (unitaires sur `eligibility.ts`, tests d'intégration sur les routes API, tests E2E sur les parcours clés) et CI/CD.

## 8. Notes de sécurité déjà en place dans le MVP

- Mots de passe hashés (bcrypt), jamais stockés en clair.
- Vérification des règles d'éligibilité **côté serveur** (pas seulement dans l'UI), donc impossible à contourner en modifiant le frontend.
- Séparation stricte des rôles via middleware (`/tenant`, `/owner`, `/admin`).
- Journal de modération (`ModerationLog`) pour tracer chaque décision admin.
- Webhook Stripe vérifié par signature avant toute mise à jour d'abonnement.

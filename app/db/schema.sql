-- Babierland City · billetterie
-- Idempotent : peut être rejoué (npm run migrate).

CREATE SEQUENCE IF NOT EXISTS seq_billet_solo;
CREATE SEQUENCE IF NOT EXISTS seq_billet_duo;

-- Une commande = un pass réservé par une personne (site ou guichet).
CREATE TABLE IF NOT EXISTS commandes (
  id           bigserial PRIMARY KEY,
  ref          text NOT NULL UNIQUE,                        -- ex. BC-7K3F9Q, donnée à l'acheteur
  pass         text NOT NULL CHECK (pass IN ('solo', 'duo')),
  nom          text NOT NULL,
  prenom       text NOT NULL,
  telephone    text NOT NULL,                               -- E.164 : +2250707000000
  email        text,
  nom_duo      text,                                        -- 2e personne (Duo)
  montant      integer NOT NULL,                            -- FCFA
  operateur    text,                                        -- Wave, Orange Money, MTN MoMo, Moov Money, Espèces
  statut       text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'payee', 'annulee')),
  canal        text NOT NULL DEFAULT 'site' CHECK (canal IN ('site', 'guichet')),
  vendeur      text,                                        -- qui a encaissé (guichet / confirmation manuelle)
  paiement_ref text,                                        -- réf. transaction (mobile money / passerelle)
  note         text,
  cree_le      timestamptz NOT NULL DEFAULT now(),
  payee_le     timestamptz,
  annulee_le   timestamptz,
  CHECK (pass = 'solo' OR nom_duo IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS commandes_statut_idx ON commandes (statut, cree_le);

-- Un billet = un QR. Émis à la confirmation du paiement. Un Duo = 1 billet pour 2 entrées.
CREATE TABLE IF NOT EXISTS billets (
  id          bigserial PRIMARY KEY,
  numero      text NOT NULL UNIQUE,                         -- S001, D001…
  code        text NOT NULL UNIQUE,                         -- secret encodé dans le QR : S001-XXXX-XXXX-XXXX
  commande_id bigint NOT NULL UNIQUE REFERENCES commandes (id),
  statut      text NOT NULL DEFAULT 'valide' CHECK (statut IN ('valide', 'annule')),
  entre_le    timestamptz,                                  -- scanné à l'entrée
  entre_par   text,                                         -- poste de contrôle
  cree_le     timestamptz NOT NULL DEFAULT now()
);

-- ---------- Conformité (loi n° 2013-450 et loi n° 2013-546) ----------
-- Preuve du consentement et de l'acceptation des conditions de vente.
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS cgv_version     text;        -- version des conditions acceptées
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS cgv_acceptees_le timestamptz;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS mineur          boolean NOT NULL DEFAULT false; -- a déclaré avoir moins de 18 ans (autorisation parentale cochée)
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS optin_infos     boolean NOT NULL DEFAULT false; -- accepte de recevoir les infos des prochains événements
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS anonymisee_le   timestamptz; -- données personnelles effacées (droit à l'effacement / fin de conservation)

-- Contacts ayant accepté la prospection (art. 22 loi 2013-450, art. 14 loi 2013-546).
CREATE TABLE IF NOT EXISTS abonnes (
  telephone   text PRIMARY KEY,
  prenom      text NOT NULL,
  nom         text NOT NULL,
  email       text,
  consenti_le timestamptz NOT NULL DEFAULT now(),
  source      text NOT NULL                                  -- réf. de la commande d'origine
);

-- Traçabilité des accès et opérations (art. 41 loi 2013-450).
CREATE TABLE IF NOT EXISTS journal (
  id      bigserial PRIMARY KEY,
  quand   timestamptz NOT NULL DEFAULT now(),
  acteur  text NOT NULL,                                     -- prénom de la personne / nom du poste
  action  text NOT NULL,                                     -- confirmer, annuler, vendre, anonymiser, export, scan…
  ref     text,                                              -- réf. commande ou n° de billet
  details jsonb
);
CREATE INDEX IF NOT EXISTS journal_quand_idx ON journal (quand);

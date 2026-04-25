export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      beneficiaires: {
        Row: {
          annee_formation: number
          commentaire: string | null
          consentement_date: string | null
          consentement_recueilli: boolean
          courriel: string | null
          created_at: string
          created_by: string | null
          date_debut_formation: string | null
          date_fin_formation: string | null
          date_naissance: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          domaine_formation_code: string
          fonction_actuelle: string | null
          id: string
          identifiant_externe: string | null
          import_batch_id: string | null
          intitule_formation: string | null
          localite_residence: string | null
          modalite_formation_code: string | null
          nom: string
          organisation_id: string | null
          partenaire_accompagnement: string | null
          pays_code: string
          prenom: string
          projet_code: string
          qualite_a_verifier: boolean | null
          sexe: Database["public"]["Enums"]["sexe"]
          source_import: Database["public"]["Enums"]["source_import"]
          statut_code: string
          telephone: string | null
          updated_at: string
        }
        Insert: {
          annee_formation: number
          commentaire?: string | null
          consentement_date?: string | null
          consentement_recueilli?: boolean
          courriel?: string | null
          created_at?: string
          created_by?: string | null
          date_debut_formation?: string | null
          date_fin_formation?: string | null
          date_naissance?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          domaine_formation_code: string
          fonction_actuelle?: string | null
          id?: string
          identifiant_externe?: string | null
          import_batch_id?: string | null
          intitule_formation?: string | null
          localite_residence?: string | null
          modalite_formation_code?: string | null
          nom: string
          organisation_id?: string | null
          partenaire_accompagnement?: string | null
          pays_code: string
          prenom: string
          projet_code: string
          qualite_a_verifier?: boolean | null
          sexe: Database["public"]["Enums"]["sexe"]
          source_import?: Database["public"]["Enums"]["source_import"]
          statut_code: string
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          annee_formation?: number
          commentaire?: string | null
          consentement_date?: string | null
          consentement_recueilli?: boolean
          courriel?: string | null
          created_at?: string
          created_by?: string | null
          date_debut_formation?: string | null
          date_fin_formation?: string | null
          date_naissance?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          domaine_formation_code?: string
          fonction_actuelle?: string | null
          id?: string
          identifiant_externe?: string | null
          import_batch_id?: string | null
          intitule_formation?: string | null
          localite_residence?: string | null
          modalite_formation_code?: string | null
          nom?: string
          organisation_id?: string | null
          partenaire_accompagnement?: string | null
          pays_code?: string
          prenom?: string
          projet_code?: string
          qualite_a_verifier?: boolean | null
          sexe?: Database["public"]["Enums"]["sexe"]
          source_import?: Database["public"]["Enums"]["source_import"]
          statut_code?: string
          telephone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "beneficiaires_domaine_formation_code_fkey"
            columns: ["domaine_formation_code"]
            isOneToOne: false
            referencedRelation: "domaines_formation"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "beneficiaires_modalite_formation_code_fkey"
            columns: ["modalite_formation_code"]
            isOneToOne: false
            referencedRelation: "modalites_formation"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "beneficiaires_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficiaires_pays_code_fkey"
            columns: ["pays_code"]
            isOneToOne: false
            referencedRelation: "pays"
            referencedColumns: ["code_iso"]
          },
          {
            foreignKeyName: "beneficiaires_projet_code_fkey"
            columns: ["projet_code"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "beneficiaires_statut_code_fkey"
            columns: ["statut_code"]
            isOneToOne: false
            referencedRelation: "statuts_beneficiaire"
            referencedColumns: ["code"]
          },
        ]
      }
      devises: {
        Row: {
          actif: boolean
          code: string
          libelle: string
          ordre_affichage: number
        }
        Insert: {
          actif?: boolean
          code: string
          libelle: string
          ordre_affichage?: number
        }
        Update: {
          actif?: boolean
          code?: string
          libelle?: string
          ordre_affichage?: number
        }
        Relationships: []
      }
      domaines_formation: {
        Row: {
          actif: boolean
          code: string
          libelle: string
          ordre_affichage: number
        }
        Insert: {
          actif?: boolean
          code: string
          libelle: string
          ordre_affichage?: number
        }
        Update: {
          actif?: boolean
          code?: string
          libelle?: string
          ordre_affichage?: number
        }
        Relationships: []
      }
      imports_excel: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          demarre_a: string
          fichier_hash_sha256: string | null
          fichier_nom: string
          fichier_taille_octets: number | null
          id: string
          nb_avertissements: number
          nb_erreurs: number
          nb_lignes_a1: number
          nb_lignes_b1: number
          nb_lignes_inserees: number
          nb_lignes_mises_a_jour: number
          organisation_id: string | null
          projet_code: string | null
          rapport_avertissements: Json
          rapport_erreurs: Json
          statut: Database["public"]["Enums"]["statut_import"]
          termine_a: string | null
          updated_at: string
          version_template: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          demarre_a?: string
          fichier_hash_sha256?: string | null
          fichier_nom: string
          fichier_taille_octets?: number | null
          id?: string
          nb_avertissements?: number
          nb_erreurs?: number
          nb_lignes_a1?: number
          nb_lignes_b1?: number
          nb_lignes_inserees?: number
          nb_lignes_mises_a_jour?: number
          organisation_id?: string | null
          projet_code?: string | null
          rapport_avertissements?: Json
          rapport_erreurs?: Json
          statut?: Database["public"]["Enums"]["statut_import"]
          termine_a?: string | null
          updated_at?: string
          version_template?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          demarre_a?: string
          fichier_hash_sha256?: string | null
          fichier_nom?: string
          fichier_taille_octets?: number | null
          id?: string
          nb_avertissements?: number
          nb_erreurs?: number
          nb_lignes_a1?: number
          nb_lignes_b1?: number
          nb_lignes_inserees?: number
          nb_lignes_mises_a_jour?: number
          organisation_id?: string | null
          projet_code?: string | null
          rapport_avertissements?: Json
          rapport_erreurs?: Json
          statut?: Database["public"]["Enums"]["statut_import"]
          termine_a?: string | null
          updated_at?: string
          version_template?: string
        }
        Relationships: [
          {
            foreignKeyName: "imports_excel_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imports_excel_projet_code_fkey"
            columns: ["projet_code"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["code"]
          },
        ]
      }
      indicateurs: {
        Row: {
          actif: boolean
          categorie: string
          code: string
          definition: string
          est_pivot: boolean
          formule_calcul: string | null
          frequence: string | null
          libelle: string
          methode_collecte: string | null
          ordre_affichage: number
          precautions: string | null
          projets_concernes: string[]
          sources: string | null
          variables: string[]
        }
        Insert: {
          actif?: boolean
          categorie: string
          code: string
          definition: string
          est_pivot?: boolean
          formule_calcul?: string | null
          frequence?: string | null
          libelle: string
          methode_collecte?: string | null
          ordre_affichage?: number
          precautions?: string | null
          projets_concernes?: string[]
          sources?: string | null
          variables?: string[]
        }
        Update: {
          actif?: boolean
          categorie?: string
          code?: string
          definition?: string
          est_pivot?: boolean
          formule_calcul?: string | null
          frequence?: string | null
          libelle?: string
          methode_collecte?: string | null
          ordre_affichage?: number
          precautions?: string | null
          projets_concernes?: string[]
          sources?: string | null
          variables?: string[]
        }
        Relationships: []
      }
      journaux_audit: {
        Row: {
          action: Database["public"]["Enums"]["action_audit"]
          diff: Json
          horodatage: string
          id: number
          ligne_id: string | null
          table_affectee: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["action_audit"]
          diff?: Json
          horodatage?: string
          id?: number
          ligne_id?: string | null
          table_affectee: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["action_audit"]
          diff?: Json
          horodatage?: string
          id?: number
          ligne_id?: string | null
          table_affectee?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      modalites_formation: {
        Row: {
          actif: boolean
          code: string
          libelle: string
          ordre_affichage: number
        }
        Insert: {
          actif?: boolean
          code: string
          libelle: string
          ordre_affichage?: number
        }
        Update: {
          actif?: boolean
          code?: string
          libelle?: string
          ordre_affichage?: number
        }
        Relationships: []
      }
      natures_appui: {
        Row: {
          actif: boolean
          code: string
          libelle: string
          ordre_affichage: number
        }
        Insert: {
          actif?: boolean
          code: string
          libelle: string
          ordre_affichage?: number
        }
        Update: {
          actif?: boolean
          code?: string
          libelle?: string
          ordre_affichage?: number
        }
        Relationships: []
      }
      notifications_admin: {
        Row: {
          created_at: string
          donnees: Json
          id: string
          lue: boolean
          lue_le: string | null
          lue_par: string | null
          message: string
          type: string
          user_id_concerne: string | null
        }
        Insert: {
          created_at?: string
          donnees?: Json
          id?: string
          lue?: boolean
          lue_le?: string | null
          lue_par?: string | null
          message: string
          type: string
          user_id_concerne?: string | null
        }
        Update: {
          created_at?: string
          donnees?: Json
          id?: string
          lue?: boolean
          lue_le?: string | null
          lue_par?: string | null
          message?: string
          type?: string
          user_id_concerne?: string | null
        }
        Relationships: []
      }
      organisations: {
        Row: {
          actif: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email_contact: string | null
          id: string
          nom: string
          pays_code: string | null
          projets_geres: string[]
          telephone_contact: string | null
          type: Database["public"]["Enums"]["type_organisation"]
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email_contact?: string | null
          id?: string
          nom: string
          pays_code?: string | null
          projets_geres?: string[]
          telephone_contact?: string | null
          type: Database["public"]["Enums"]["type_organisation"]
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email_contact?: string | null
          id?: string
          nom?: string
          pays_code?: string | null
          projets_geres?: string[]
          telephone_contact?: string | null
          type?: Database["public"]["Enums"]["type_organisation"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisations_pays_code_fkey"
            columns: ["pays_code"]
            isOneToOne: false
            referencedRelation: "pays"
            referencedColumns: ["code_iso"]
          },
        ]
      }
      pays: {
        Row: {
          actif: boolean
          code_iso: string
          libelle_fr: string
          ordre_affichage: number
          region: string | null
        }
        Insert: {
          actif?: boolean
          code_iso: string
          libelle_fr: string
          ordre_affichage?: number
          region?: string | null
        }
        Update: {
          actif?: boolean
          code_iso?: string
          libelle_fr?: string
          ordre_affichage?: number
          region?: string | null
        }
        Relationships: []
      }
      programmes_strategiques: {
        Row: {
          actif: boolean
          code: string
          libelle: string
          ordre_affichage: number
        }
        Insert: {
          actif?: boolean
          code: string
          libelle: string
          ordre_affichage?: number
        }
        Update: {
          actif?: boolean
          code?: string
          libelle?: string
          ordre_affichage?: number
        }
        Relationships: []
      }
      projets: {
        Row: {
          actif: boolean
          code: string
          concerne_emploi_jeunes: boolean
          libelle: string
          ordre_affichage: number
          programme_strategique: string
        }
        Insert: {
          actif?: boolean
          code: string
          concerne_emploi_jeunes?: boolean
          libelle: string
          ordre_affichage?: number
          programme_strategique: string
        }
        Update: {
          actif?: boolean
          code?: string
          concerne_emploi_jeunes?: boolean
          libelle?: string
          ordre_affichage?: number
          programme_strategique?: string
        }
        Relationships: [
          {
            foreignKeyName: "projets_programme_strategique_fkey"
            columns: ["programme_strategique"]
            isOneToOne: false
            referencedRelation: "programmes_strategiques"
            referencedColumns: ["code"]
          },
        ]
      }
      projets_codes_legacy: {
        Row: {
          code_legacy: string
          code_officiel: string
          remplace_au: string
        }
        Insert: {
          code_legacy: string
          code_officiel: string
          remplace_au?: string
        }
        Update: {
          code_legacy?: string
          code_officiel?: string
          remplace_au?: string
        }
        Relationships: [
          {
            foreignKeyName: "projets_codes_legacy_code_officiel_fkey"
            columns: ["code_officiel"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["code"]
          },
        ]
      }
      reponses_enquetes: {
        Row: {
          agent_collecte: string | null
          beneficiaire_id: string | null
          canal_collecte: Database["public"]["Enums"]["canal_collecte"]
          created_at: string
          created_by: string | null
          date_collecte: string
          deleted_at: string | null
          donnees: Json
          id: string
          indicateur_code: string
          lien_public_token: string | null
          projet_code: string | null
          session_enquete_id: string | null
          structure_id: string | null
          updated_at: string
          vague_enquete: Database["public"]["Enums"]["vague_enquete"]
        }
        Insert: {
          agent_collecte?: string | null
          beneficiaire_id?: string | null
          canal_collecte?: Database["public"]["Enums"]["canal_collecte"]
          created_at?: string
          created_by?: string | null
          date_collecte?: string
          deleted_at?: string | null
          donnees?: Json
          id?: string
          indicateur_code: string
          lien_public_token?: string | null
          projet_code?: string | null
          session_enquete_id?: string | null
          structure_id?: string | null
          updated_at?: string
          vague_enquete?: Database["public"]["Enums"]["vague_enquete"]
        }
        Update: {
          agent_collecte?: string | null
          beneficiaire_id?: string | null
          canal_collecte?: Database["public"]["Enums"]["canal_collecte"]
          created_at?: string
          created_by?: string | null
          date_collecte?: string
          deleted_at?: string | null
          donnees?: Json
          id?: string
          indicateur_code?: string
          lien_public_token?: string | null
          projet_code?: string | null
          session_enquete_id?: string | null
          structure_id?: string | null
          updated_at?: string
          vague_enquete?: Database["public"]["Enums"]["vague_enquete"]
        }
        Relationships: [
          {
            foreignKeyName: "reponses_enquetes_beneficiaire_id_fkey"
            columns: ["beneficiaire_id"]
            isOneToOne: false
            referencedRelation: "beneficiaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reponses_enquetes_indicateur_code_fkey"
            columns: ["indicateur_code"]
            isOneToOne: false
            referencedRelation: "indicateurs"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "reponses_enquetes_projet_code_fkey"
            columns: ["projet_code"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "reponses_enquetes_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      secteurs_activite: {
        Row: {
          actif: boolean
          code: string
          libelle: string
          ordre_affichage: number
        }
        Insert: {
          actif?: boolean
          code: string
          libelle: string
          ordre_affichage?: number
        }
        Update: {
          actif?: boolean
          code?: string
          libelle?: string
          ordre_affichage?: number
        }
        Relationships: []
      }
      statuts_beneficiaire: {
        Row: {
          actif: boolean
          code: string
          libelle: string
          ordre_affichage: number
        }
        Insert: {
          actif?: boolean
          code: string
          libelle: string
          ordre_affichage?: number
        }
        Update: {
          actif?: boolean
          code?: string
          libelle?: string
          ordre_affichage?: number
        }
        Relationships: []
      }
      structures: {
        Row: {
          adresse: string | null
          annee_appui: number
          chiffre_affaires: number | null
          commentaire: string | null
          consentement_date: string | null
          consentement_recueilli: boolean
          courriel_porteur: string | null
          created_at: string
          created_by: string | null
          date_creation: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          devise_code: string | null
          emplois_crees: number | null
          employes_permanents: number | null
          employes_temporaires: number | null
          fonction_porteur: string | null
          id: string
          identifiant_externe: string | null
          import_batch_id: string | null
          intitule_initiative: string | null
          latitude: number | null
          localite: string | null
          longitude: number | null
          montant_appui: number | null
          nature_appui_code: string
          nom_structure: string
          organisation_id: string | null
          pays_code: string
          porteur_date_naissance: string | null
          porteur_nom: string
          porteur_prenom: string | null
          porteur_sexe: Database["public"]["Enums"]["sexe"]
          projet_code: string
          secteur_activite_code: string
          secteur_precis: string | null
          source_import: Database["public"]["Enums"]["source_import"]
          statut_creation: Database["public"]["Enums"]["statut_structure"]
          telephone_porteur: string | null
          type_structure_code: string
          updated_at: string
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          annee_appui: number
          chiffre_affaires?: number | null
          commentaire?: string | null
          consentement_date?: string | null
          consentement_recueilli?: boolean
          courriel_porteur?: string | null
          created_at?: string
          created_by?: string | null
          date_creation?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          devise_code?: string | null
          emplois_crees?: number | null
          employes_permanents?: number | null
          employes_temporaires?: number | null
          fonction_porteur?: string | null
          id?: string
          identifiant_externe?: string | null
          import_batch_id?: string | null
          intitule_initiative?: string | null
          latitude?: number | null
          localite?: string | null
          longitude?: number | null
          montant_appui?: number | null
          nature_appui_code: string
          nom_structure: string
          organisation_id?: string | null
          pays_code: string
          porteur_date_naissance?: string | null
          porteur_nom: string
          porteur_prenom?: string | null
          porteur_sexe: Database["public"]["Enums"]["sexe"]
          projet_code: string
          secteur_activite_code: string
          secteur_precis?: string | null
          source_import?: Database["public"]["Enums"]["source_import"]
          statut_creation: Database["public"]["Enums"]["statut_structure"]
          telephone_porteur?: string | null
          type_structure_code: string
          updated_at?: string
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          annee_appui?: number
          chiffre_affaires?: number | null
          commentaire?: string | null
          consentement_date?: string | null
          consentement_recueilli?: boolean
          courriel_porteur?: string | null
          created_at?: string
          created_by?: string | null
          date_creation?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          devise_code?: string | null
          emplois_crees?: number | null
          employes_permanents?: number | null
          employes_temporaires?: number | null
          fonction_porteur?: string | null
          id?: string
          identifiant_externe?: string | null
          import_batch_id?: string | null
          intitule_initiative?: string | null
          latitude?: number | null
          localite?: string | null
          longitude?: number | null
          montant_appui?: number | null
          nature_appui_code?: string
          nom_structure?: string
          organisation_id?: string | null
          pays_code?: string
          porteur_date_naissance?: string | null
          porteur_nom?: string
          porteur_prenom?: string | null
          porteur_sexe?: Database["public"]["Enums"]["sexe"]
          projet_code?: string
          secteur_activite_code?: string
          secteur_precis?: string | null
          source_import?: Database["public"]["Enums"]["source_import"]
          statut_creation?: Database["public"]["Enums"]["statut_structure"]
          telephone_porteur?: string | null
          type_structure_code?: string
          updated_at?: string
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "structures_devise_code_fkey"
            columns: ["devise_code"]
            isOneToOne: false
            referencedRelation: "devises"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "structures_nature_appui_code_fkey"
            columns: ["nature_appui_code"]
            isOneToOne: false
            referencedRelation: "natures_appui"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "structures_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structures_pays_code_fkey"
            columns: ["pays_code"]
            isOneToOne: false
            referencedRelation: "pays"
            referencedColumns: ["code_iso"]
          },
          {
            foreignKeyName: "structures_projet_code_fkey"
            columns: ["projet_code"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "structures_secteur_activite_code_fkey"
            columns: ["secteur_activite_code"]
            isOneToOne: false
            referencedRelation: "secteurs_activite"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "structures_type_structure_code_fkey"
            columns: ["type_structure_code"]
            isOneToOne: false
            referencedRelation: "types_structure"
            referencedColumns: ["code"]
          },
        ]
      }
      types_structure: {
        Row: {
          actif: boolean
          code: string
          libelle: string
          ordre_affichage: number
        }
        Insert: {
          actif?: boolean
          code: string
          libelle: string
          ordre_affichage?: number
        }
        Update: {
          actif?: boolean
          code?: string
          libelle?: string
          ordre_affichage?: number
        }
        Relationships: []
      }
      utilisateurs: {
        Row: {
          actif: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          nom_complet: string
          organisation_id: string | null
          role: Database["public"]["Enums"]["role_utilisateur"]
          statut_validation: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          nom_complet: string
          organisation_id?: string | null
          role?: Database["public"]["Enums"]["role_utilisateur"]
          statut_validation?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          nom_complet?: string
          organisation_id?: string | null
          role?: Database["public"]["Enums"]["role_utilisateur"]
          statut_validation?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "utilisateurs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      valeurs_consentement: {
        Row: {
          code: string
          libelle: string
          ordre_affichage: number
          recueilli: boolean
        }
        Insert: {
          code: string
          libelle: string
          ordre_affichage?: number
          recueilli: boolean
        }
        Update: {
          code?: string
          libelle?: string
          ordre_affichage?: number
          recueilli?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_beneficiaire: { Args: { p_id: string }; Returns: boolean }
      can_read_projet: { Args: { p_code: string }; Returns: boolean }
      can_read_structure: { Args: { p_id: string }; Returns: boolean }
      current_organisation_id: { Args: never; Returns: string }
      current_projets_geres: { Args: never; Returns: string[] }
      current_role_metier: {
        Args: never
        Returns: Database["public"]["Enums"]["role_utilisateur"]
      }
      current_statut_validation: { Args: never; Returns: string }
      find_beneficiaire_doublon:
        | {
            Args: {
              p_date_naissance: string
              p_nom: string
              p_prenom: string
              p_projet_code: string
            }
            Returns: {
              date_naissance: string
              id: string
              nom: string
              prenom: string
              projet_code: string
            }[]
          }
        | {
            Args: {
              p_date_naissance: string
              p_exclude_id?: string
              p_nom: string
              p_prenom: string
              p_projet_code: string
            }
            Returns: {
              date_naissance: string
              id: string
              nom: string
              prenom: string
              projet_code: string
            }[]
          }
      get_kpis_dashboard: { Args: never; Returns: Json }
      get_kpis_dashboard_admin_scs: { Args: never; Returns: Json }
      get_kpis_dashboard_contributeur_partenaire: { Args: never; Returns: Json }
      get_kpis_dashboard_editeur_projet: { Args: never; Returns: Json }
      get_kpis_dashboard_lecteur: { Args: never; Returns: Json }
      is_admin_scs: { Args: never; Returns: boolean }
      notifications_admin_non_lues_count: { Args: never; Returns: number }
      rechercher_beneficiaires: {
        Args: { search_text: string; seuil_similarite?: number }
        Returns: {
          id: string
          similarite: number
        }[]
      }
      rechercher_structures: {
        Args: { search_text: string; seuil_similarite?: number }
        Returns: {
          id: string
          similarite: number
        }[]
      }
      find_structure_doublon: {
        Args: {
          p_nom_structure: string
          p_pays_code: string
          p_projet_code: string
          p_seuil_similarite?: number
          p_exclude_id?: string
        }
        Returns: {
          id: string
          nom_structure: string
          pays_code: string
          projet_code: string
          similarity_score: number
        }[]
      }
      lister_sessions_enquete: {
        Args: {
          p_questionnaire?: string | null
          p_projet_code?: string | null
          p_cible_id?: string | null
          p_vague_enquete?: string | null
          p_canal_collecte?: string | null
          p_date_debut?: string | null
          p_date_fin?: string | null
          p_recherche?: string | null
          p_mien_uid?: string | null
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          id: string
          beneficiaire_id: string | null
          structure_id: string | null
          cible_libelle: string | null
          questionnaire: string | null
          projet_code: string | null
          programme_strategique: string | null
          vague_enquete: string
          canal_collecte: string
          date_collecte: string
          nb_indicateurs: number
          indicateurs: string[]
          created_at: string
          updated_at: string
          created_by: string | null
          total_count: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
      unaccent_immutable: { Args: { "": string }; Returns: string }
      utilisateurs_privileges_unchanged: {
        Args: {
          p_actif: boolean
          p_organisation_id: string
          p_role: Database["public"]["Enums"]["role_utilisateur"]
        }
        Returns: boolean
      }
    }
    Enums: {
      action_audit: "INSERT" | "UPDATE" | "DELETE" | "SOFT_DELETE" | "RESTORE"
      canal_collecte:
        | "formulaire_web"
        | "entretien"
        | "telephone"
        | "import"
        | "email"
        | "sms"
        | "whatsapp"
      role_utilisateur:
        | "admin_scs"
        | "editeur_projet"
        | "contributeur_partenaire"
        | "lecteur"
      sexe: "F" | "M" | "Autre"
      source_import:
        | "manuelle"
        | "excel_v1"
        | "excel_v2"
        | "formulaire_web"
        | "api"
      statut_import:
        | "en_cours"
        | "succes"
        | "echec_partiel"
        | "echec_total"
        | "annule"
      statut_structure: "creation" | "renforcement" | "relance"
      type_organisation:
        | "scs"
        | "unite_chef_file"
        | "partenaire_mise_en_oeuvre"
        | "autre"
      vague_enquete:
        | "6_mois"
        | "12_mois"
        | "24_mois"
        | "ponctuelle"
        | "avant_formation"
        | "fin_formation"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      action_audit: ["INSERT", "UPDATE", "DELETE", "SOFT_DELETE", "RESTORE"],
      canal_collecte: [
        "formulaire_web",
        "entretien",
        "telephone",
        "import",
        "email",
        "sms",
        "whatsapp",
      ],
      role_utilisateur: [
        "admin_scs",
        "editeur_projet",
        "contributeur_partenaire",
        "lecteur",
      ],
      sexe: ["F", "M", "Autre"],
      source_import: [
        "manuelle",
        "excel_v1",
        "excel_v2",
        "formulaire_web",
        "api",
      ],
      statut_import: [
        "en_cours",
        "succes",
        "echec_partiel",
        "echec_total",
        "annule",
      ],
      statut_structure: ["creation", "renforcement", "relance"],
      type_organisation: [
        "scs",
        "unite_chef_file",
        "partenaire_mise_en_oeuvre",
        "autre",
      ],
      vague_enquete: [
        "6_mois",
        "12_mois",
        "24_mois",
        "ponctuelle",
        "avant_formation",
        "fin_formation",
      ],
    },
  },
} as const

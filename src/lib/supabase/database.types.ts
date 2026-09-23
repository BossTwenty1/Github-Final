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
      account: {
        Row: {
          account_id: string
          account_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          is_active: boolean
          revision: number
          role_id: number
          updated_at: string
          username: string
        }
        Insert: {
          account_id: string
          account_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          is_active?: boolean
          revision?: number
          role_id: number
          updated_at?: string
          username: string
        }
        Update: {
          account_id?: string
          account_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          is_active?: boolean
          revision?: number
          role_id?: number
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "account_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "account_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role"
            referencedColumns: ["role_id"]
          },
        ]
      }
      area: {
        Row: {
          area_category: string
          area_code: string
          area_id: number
          area_name: string
          boundary_geom: unknown
          site_id: number
        }
        Insert: {
          area_category: string
          area_code: string
          area_id?: number
          area_name: string
          boundary_geom?: unknown
          site_id: number
        }
        Update: {
          area_category?: string
          area_code?: string
          area_id?: number
          area_name?: string
          boundary_geom?: unknown
          site_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "area_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "site"
            referencedColumns: ["site_id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_account_id: string | null
          audit_id: number
          created_at: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_account_id?: string | null
          audit_id?: number
          created_at?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_account_id?: string | null
          audit_id?: number
          created_at?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_account_id_fkey"
            columns: ["actor_account_id"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["account_id"]
          },
        ]
      }
      block: {
        Row: {
          block_id: number
          block_name: string | null
          block_number: number
          pricing_tier: string | null
          sector_id: number
        }
        Insert: {
          block_id?: number
          block_name?: string | null
          block_number: number
          pricing_tier?: string | null
          sector_id: number
        }
        Update: {
          block_id?: number
          block_name?: string | null
          block_number?: number
          pricing_tier?: string | null
          sector_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "block_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sector"
            referencedColumns: ["sector_id"]
          },
        ]
      }
      burial_record: {
        Row: {
          burial_id: number
          created_at: string
          created_by: string | null
          deceased_id: number
          deleted_at: string | null
          exhumation_date: string | null
          interment_date: string | null
          interment_order_number: string | null
          interment_status: string
          lot_id: number
          quality_notes: string | null
          record_source: string | null
          record_status: string
          reference_no: string | null
          remains_type: string
          revision: number
          service_provider: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          burial_id?: number
          created_at?: string
          created_by?: string | null
          deceased_id: number
          deleted_at?: string | null
          exhumation_date?: string | null
          interment_date?: string | null
          interment_order_number?: string | null
          interment_status: string
          lot_id: number
          quality_notes?: string | null
          record_source?: string | null
          record_status?: string
          reference_no?: string | null
          remains_type: string
          revision?: number
          service_provider?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          burial_id?: number
          created_at?: string
          created_by?: string | null
          deceased_id?: number
          deleted_at?: string | null
          exhumation_date?: string | null
          interment_date?: string | null
          interment_order_number?: string | null
          interment_status?: string
          lot_id?: number
          quality_notes?: string | null
          record_source?: string | null
          record_status?: string
          reference_no?: string | null
          remains_type?: string
          revision?: number
          service_provider?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "burial_record_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "burial_record_deceased_id_fkey"
            columns: ["deceased_id"]
            isOneToOne: false
            referencedRelation: "deceased"
            referencedColumns: ["deceased_id"]
          },
          {
            foreignKeyName: "burial_record_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lot"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "burial_record_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["account_id"]
          },
        ]
      }
      deceased: {
        Row: {
          birth_date: string | null
          cause_of_death: string | null
          death_date: string | null
          deceased_id: number
          display_name: string
          public_display: boolean
        }
        Insert: {
          birth_date?: string | null
          cause_of_death?: string | null
          death_date?: string | null
          deceased_id?: number
          display_name: string
          public_display?: boolean
        }
        Update: {
          birth_date?: string | null
          cause_of_death?: string | null
          death_date?: string | null
          deceased_id?: number
          display_name?: string
          public_display?: boolean
        }
        Relationships: []
      }
      lot: {
        Row: {
          area_id: number
          block_id: number | null
          coordinate_accuracy_m: number | null
          coordinate_rejection_reason: string | null
          coordinate_status: string
          coordinate_verified: boolean
          created_at: string
          deleted_at: string | null
          legacy_location_code: string | null
          legacy_pa_number: string | null
          length_m: number | null
          location_geom: unknown
          lot_code: string
          lot_id: number
          lot_owner_id: number | null
          px_loc_x: number | null
          px_loc_y: number | null
          revision: number
          status: string
          updated_at: string
          width_m: number | null
        }
        Insert: {
          area_id: number
          block_id?: number | null
          coordinate_accuracy_m?: number | null
          coordinate_rejection_reason?: string | null
          coordinate_status?: string
          coordinate_verified?: boolean
          created_at?: string
          deleted_at?: string | null
          legacy_location_code?: string | null
          legacy_pa_number?: string | null
          length_m?: number | null
          location_geom?: unknown
          lot_code: string
          lot_id?: number
          lot_owner_id?: number | null
          px_loc_x?: number | null
          px_loc_y?: number | null
          revision?: number
          status?: string
          updated_at?: string
          width_m?: number | null
        }
        Update: {
          area_id?: number
          block_id?: number | null
          coordinate_accuracy_m?: number | null
          coordinate_rejection_reason?: string | null
          coordinate_status?: string
          coordinate_verified?: boolean
          created_at?: string
          deleted_at?: string | null
          legacy_location_code?: string | null
          legacy_pa_number?: string | null
          length_m?: number | null
          location_geom?: unknown
          lot_code?: string
          lot_id?: number
          lot_owner_id?: number | null
          px_loc_x?: number | null
          px_loc_y?: number | null
          revision?: number
          status?: string
          updated_at?: string
          width_m?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lot_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "area"
            referencedColumns: ["area_id"]
          },
          {
            foreignKeyName: "lot_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "block"
            referencedColumns: ["block_id"]
          },
          {
            foreignKeyName: "lot_lot_owner_id_fkey"
            columns: ["lot_owner_id"]
            isOneToOne: false
            referencedRelation: "lot_owner"
            referencedColumns: ["lot_owner_id"]
          },
        ]
      }
      lot_owner: {
        Row: {
          address: string
          aliases: string | null
          deleted_at: string | null
          first_name: string
          last_name: string
          lot_owner_id: number
          middle_name: string | null
          representative_contact: string | null
          representative_name: string | null
          representative_relation: string | null
          revision: number
          suffix: string | null
        }
        Insert: {
          address: string
          aliases?: string | null
          deleted_at?: string | null
          first_name: string
          last_name: string
          lot_owner_id?: number
          middle_name?: string | null
          representative_contact?: string | null
          representative_name?: string | null
          representative_relation?: string | null
          revision?: number
          suffix?: string | null
        }
        Update: {
          address?: string
          aliases?: string | null
          deleted_at?: string | null
          first_name?: string
          last_name?: string
          lot_owner_id?: number
          middle_name?: string | null
          representative_contact?: string | null
          representative_name?: string | null
          representative_relation?: string | null
          revision?: number
          suffix?: string | null
        }
        Relationships: []
      }
      map_edge: {
        Row: {
          distance_m: number | null
          edge_id: number
          edge_type: string
          from_node_id: number
          is_restricted: boolean
          path_geom: unknown
          to_node_id: number
        }
        Insert: {
          distance_m?: number | null
          edge_id?: number
          edge_type: string
          from_node_id: number
          is_restricted?: boolean
          path_geom?: unknown
          to_node_id: number
        }
        Update: {
          distance_m?: number | null
          edge_id?: number
          edge_type?: string
          from_node_id?: number
          is_restricted?: boolean
          path_geom?: unknown
          to_node_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "map_edge_from_node_id_fkey"
            columns: ["from_node_id"]
            isOneToOne: false
            referencedRelation: "map_node"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "map_edge_to_node_id_fkey"
            columns: ["to_node_id"]
            isOneToOne: false
            referencedRelation: "map_node"
            referencedColumns: ["node_id"]
          },
        ]
      }
      map_node: {
        Row: {
          location_geom: unknown
          node_id: number
          node_name: string
          node_type: string
          px_loc_x: number | null
          px_loc_y: number | null
          site_id: number
        }
        Insert: {
          location_geom?: unknown
          node_id?: number
          node_name: string
          node_type: string
          px_loc_x?: number | null
          px_loc_y?: number | null
          site_id: number
        }
        Update: {
          location_geom?: unknown
          node_id?: number
          node_name?: string
          node_type?: string
          px_loc_x?: number | null
          px_loc_y?: number | null
          site_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "map_node_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "site"
            referencedColumns: ["site_id"]
          },
        ]
      }
      photo: {
        Row: {
          approval_status: string
          burial_id: number
          caption: string | null
          captured_at: string | null
          created_at: string
          file_name: string
          photo_id: number
          public_display: boolean
          reviewed_by: string | null
          revision: number
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          approval_status?: string
          burial_id: number
          caption?: string | null
          captured_at?: string | null
          created_at?: string
          file_name: string
          photo_id?: number
          public_display?: boolean
          reviewed_by?: string | null
          revision?: number
          storage_path: string
          uploaded_by: string
        }
        Update: {
          approval_status?: string
          burial_id?: number
          caption?: string | null
          captured_at?: string | null
          created_at?: string
          file_name?: string
          photo_id?: number
          public_display?: boolean
          reviewed_by?: string | null
          revision?: number
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_burial_id_fkey"
            columns: ["burial_id"]
            isOneToOne: false
            referencedRelation: "burial_record"
            referencedColumns: ["burial_id"]
          },
          {
            foreignKeyName: "photo_burial_id_fkey"
            columns: ["burial_id"]
            isOneToOne: false
            referencedRelation: "public_burial_records"
            referencedColumns: ["burial_id"]
          },
          {
            foreignKeyName: "photo_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "photo_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["account_id"]
          },
        ]
      }
      record_history: {
        Row: {
          actor_id: string | null
          after_revision: number
          before_values: Json
          created_at: string
          entity: string
          history_id: number
          operation: string
          record_id: string
        }
        Insert: {
          actor_id?: string | null
          after_revision: number
          before_values: Json
          created_at?: string
          entity: string
          history_id?: never
          operation: string
          record_id: string
        }
        Update: {
          actor_id?: string | null
          after_revision?: number
          before_values?: Json
          created_at?: string
          entity?: string
          history_id?: never
          operation?: string
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["account_id"]
          },
        ]
      }
      role: {
        Row: {
          description: string
          role_id: number
          role_name: string
        }
        Insert: {
          description: string
          role_id?: number
          role_name: string
        }
        Update: {
          description?: string
          role_id?: number
          role_name?: string
        }
        Relationships: []
      }
      sector: {
        Row: {
          area_id: number
          sector_code: string
          sector_id: number
          sector_name: string | null
        }
        Insert: {
          area_id: number
          sector_code: string
          sector_id?: number
          sector_name?: string | null
        }
        Update: {
          area_id?: number
          sector_code?: string
          sector_id?: number
          sector_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sector_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "area"
            referencedColumns: ["area_id"]
          },
        ]
      }
      site: {
        Row: {
          address: string
          boundary_geom: unknown
          created_at: string
          geo_transform_json: Json | null
          site_id: number
          site_name: string
          updated_at: string
        }
        Insert: {
          address: string
          boundary_geom?: unknown
          created_at?: string
          geo_transform_json?: Json | null
          site_id?: number
          site_name: string
          updated_at?: string
        }
        Update: {
          address?: string
          boundary_geom?: unknown
          created_at?: string
          geo_transform_json?: Json | null
          site_id?: number
          site_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_mutation: {
        Row: {
          actor_id: string
          created_at: string
          request: Json
          request_id: string
          result: Json | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          request: Json
          request_id: string
          result?: Json | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          request?: Json
          request_id?: string
          result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_mutation_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["account_id"]
          },
        ]
      }
    }
    Views: {
      public_burial_photos: {
        Row: {
          burial_id: number | null
          caption: string | null
          captured_at: string | null
          file_name: string | null
          photo_id: number | null
          storage_path: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photo_burial_id_fkey"
            columns: ["burial_id"]
            isOneToOne: false
            referencedRelation: "burial_record"
            referencedColumns: ["burial_id"]
          },
          {
            foreignKeyName: "photo_burial_id_fkey"
            columns: ["burial_id"]
            isOneToOne: false
            referencedRelation: "public_burial_records"
            referencedColumns: ["burial_id"]
          },
        ]
      }
      public_burial_records: {
        Row: {
          area_name: string | null
          birth_date: string | null
          block_number: number | null
          burial_id: number | null
          death_date: string | null
          display_name: string | null
          interment_date: string | null
          location_geom: unknown
          location_verified: boolean | null
          lot_code: string | null
          px_loc_x: number | null
          px_loc_y: number | null
          record_status: string | null
          sector_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_activate_account: {
        Args: { p_account_id: string }
        Returns: {
          account_id: string
          account_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          is_active: boolean
          revision: number
          role_id: number
          updated_at: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "account"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_approve_account: {
        Args: { p_account_id: string }
        Returns: {
          account_id: string
          account_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          is_active: boolean
          revision: number
          role_id: number
          updated_at: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "account"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_change_account_role: {
        Args: { p_account_id: string; p_role_name: string }
        Returns: {
          account_id: string
          account_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          is_active: boolean
          revision: number
          role_id: number
          updated_at: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "account"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_create_account: {
        Args: { p_account_id: string; p_role_name: string; p_username: string }
        Returns: {
          account_id: string
          account_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          is_active: boolean
          revision: number
          role_id: number
          updated_at: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "account"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_create_burial_record: {
        Args: {
          p_birth_date: string
          p_death_date: string
          p_display_name: string
          p_interment_date: string
          p_interment_status: string
          p_lot_id: number
          p_public_display: boolean
          p_quality_notes: string
          p_record_source: string
          p_record_status: string
          p_reference_no: string
          p_remains_type: string
          p_service_provider: string
        }
        Returns: number
      }
      admin_deactivate_account: {
        Args: { p_account_id: string; p_account_status: string }
        Returns: {
          account_id: string
          account_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          is_active: boolean
          revision: number
          role_id: number
          updated_at: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "account"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_delete_burial_record: {
        Args: { p_burial_id: number }
        Returns: undefined
      }
      admin_update_burial_record: {
        Args: {
          p_birth_date: string
          p_burial_id: number
          p_death_date: string
          p_display_name: string
          p_interment_date: string
          p_interment_status: string
          p_lot_id: number
          p_public_display: boolean
          p_quality_notes: string
          p_record_source: string
          p_record_status: string
          p_reference_no: string
          p_remains_type: string
          p_service_provider: string
        }
        Returns: undefined
      }
      audit_safe_row: {
        Args: { p_row: Json; p_table_name: string }
        Returns: Json
      }
      bootstrap_first_admin: {
        Args: { p_account_id: string; p_username: string }
        Returns: {
          account_id: string
          account_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          is_active: boolean
          revision: number
          role_id: number
          updated_at: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "account"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      export_audit_log: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          action: string
          actor_account_id: string | null
          audit_id: number
          created_at: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
        }[]
        SetofOptions: {
          from: "*"
          to: "audit_log"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_my_account: {
        Args: never
        Returns: {
          account_id: string
          account_status: string
          is_active: boolean
          role_name: string
          username: string
        }[]
      }
      is_active_admin: { Args: never; Returns: boolean }
      is_active_admin_or_manager: { Args: never; Returns: boolean }
      is_active_manager: { Args: never; Returns: boolean }
      search_name_key: { Args: { value: string }; Returns: string }
      search_normalize: { Args: { value: string }; Returns: string }
      search_public_burials: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_query?: string
          p_section?: string
          p_sort?: string
          p_year?: string
        }
        Returns: Json
      }
      search_staff_burials: {
        Args: { p_page?: number; p_query?: string }
        Returns: Json
      }
      staff_dashboard_counts: { Args: never; Returns: Json }
      staff_save_record: {
        Args: {
          p_entity: string
          p_id: string
          p_operation?: string
          p_request_id: string
          p_revision: number
          p_values: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

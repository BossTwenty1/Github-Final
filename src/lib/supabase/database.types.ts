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
      georeferencing_run: {
        Row: {
          run_id: string
          release_id: string
          site_id: number
          run_code: string
          source_reference: string
          source_hash: string
          source_width: number | null
          source_height: number | null
          source_coordinate_space: string
          working_srid: number
          output_srid: number
          method: string
          processing_parameters: Json
          processed_at: string
          qgis_version: string
          operator_reference: string | null
          reviewer_reference: string | null
          output_artifact_reference: string
          output_artifact_hash: string
          review_state: string
          revision: number
          notes: string | null
          review_notes: string | null
          created_at: string
          created_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          run_id?: string
          release_id: string
          site_id: number
          run_code: string
          source_reference: string
          source_hash: string
          source_width?: number | null
          source_height?: number | null
          source_coordinate_space: string
          working_srid: number
          output_srid: number
          method: string
          processing_parameters?: Json
          processed_at: string
          qgis_version: string
          operator_reference?: string | null
          reviewer_reference?: string | null
          output_artifact_reference: string
          output_artifact_hash: string
          review_state?: string
          revision?: number
          notes?: string | null
          review_notes?: string | null
          created_at?: string
          created_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          run_id?: string
          release_id?: string
          site_id?: number
          run_code?: string
          source_reference?: string
          source_hash?: string
          source_width?: number | null
          source_height?: number | null
          source_coordinate_space?: string
          working_srid?: number
          output_srid?: number
          method?: string
          processing_parameters?: Json
          processed_at?: string
          qgis_version?: string
          operator_reference?: string | null
          reviewer_reference?: string | null
          output_artifact_reference?: string
          output_artifact_hash?: string
          review_state?: string
          revision?: number
          notes?: string | null
          review_notes?: string | null
          created_at?: string
          created_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          { foreignKeyName: "georeferencing_run_release_site_fkey"; columns: ["release_id", "site_id"]; isOneToOne: false; referencedRelation: "mapping_release"; referencedColumns: ["release_id", "site_id"] },
          { foreignKeyName: "georeferencing_run_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "account"; referencedColumns: ["account_id"] },
          { foreignKeyName: "georeferencing_run_reviewed_by_fkey"; columns: ["reviewed_by"]; isOneToOne: false; referencedRelation: "account"; referencedColumns: ["account_id"] },
        ]
      }
      georeferencing_run_point: {
        Row: {
          run_point_id: string
          run_id: string
          release_id: string
          site_id: number
          point_id: string
          capture_id: string
          role: string
          source_x: number
          source_y: number
          fitting_residual_m: number | null
          created_at: string
        }
        Insert: {
          run_point_id?: string
          run_id: string
          release_id: string
          site_id: number
          point_id: string
          capture_id: string
          role: string
          source_x: number
          source_y: number
          fitting_residual_m?: number | null
          created_at?: string
        }
        Update: {
          run_point_id?: string
          run_id?: string
          release_id?: string
          site_id?: number
          point_id?: string
          capture_id?: string
          role?: string
          source_x?: number
          source_y?: number
          fitting_residual_m?: number | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "georeferencing_run_point_run_scope_fkey"; columns: ["run_id", "release_id", "site_id"]; isOneToOne: false; referencedRelation: "georeferencing_run"; referencedColumns: ["run_id", "release_id", "site_id"] },
          { foreignKeyName: "georeferencing_run_point_point_site_fkey"; columns: ["point_id", "site_id"]; isOneToOne: false; referencedRelation: "survey_point"; referencedColumns: ["point_id", "site_id"] },
          { foreignKeyName: "georeferencing_run_point_capture_fkey"; columns: ["capture_id", "point_id", "site_id"]; isOneToOne: false; referencedRelation: "survey_capture"; referencedColumns: ["capture_id", "point_id", "site_id"] },
        ]
      }
      georeferencing_validation: {
        Row: {
          run_point_id: string
          transformed_plan_point: unknown
          review_state: string
          revision: number
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          created_at: string
        }
        Insert: {
          run_point_id: string
          transformed_plan_point: unknown
          review_state?: string
          revision?: number
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          created_at?: string
        }
        Update: {
          run_point_id?: string
          transformed_plan_point?: unknown
          review_state?: string
          revision?: number
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "georeferencing_validation_run_point_id_fkey"; columns: ["run_point_id"]; isOneToOne: true; referencedRelation: "georeferencing_run_point"; referencedColumns: ["run_point_id"] },
          { foreignKeyName: "georeferencing_validation_reviewed_by_fkey"; columns: ["reviewed_by"]; isOneToOne: false; referencedRelation: "account"; referencedColumns: ["account_id"] },
        ]
      }
      grave_access_point: {
        Row: {
          access_point_id: string
          mapping_release_id: string
          site_id: number
          georeferencing_run_id: string
          source_feature_id: string
          artifact_hash: string
          layer_name: string
          layer_version: string
          lot_id: number
          area_id: number
          node_id: number
          access_point_geom: unknown
          review_state: string
          revision: number
          private_notes: string | null
          created_at: string
          imported_at: string
          created_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          access_point_id?: string
          mapping_release_id: string
          site_id: number
          georeferencing_run_id: string
          source_feature_id: string
          artifact_hash: string
          layer_name: string
          layer_version: string
          lot_id: number
          area_id: number
          node_id: number
          access_point_geom: unknown
          review_state?: string
          revision?: number
          private_notes?: string | null
          created_at?: string
          imported_at?: string
          created_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          access_point_id?: string
          mapping_release_id?: string
          site_id?: number
          georeferencing_run_id?: string
          source_feature_id?: string
          artifact_hash?: string
          layer_name?: string
          layer_version?: string
          lot_id?: number
          area_id?: number
          node_id?: number
          access_point_geom?: unknown
          review_state?: string
          revision?: number
          private_notes?: string | null
          created_at?: string
          imported_at?: string
          created_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          { foreignKeyName: "grave_access_point_release_site_fkey"; columns: ["mapping_release_id", "site_id"]; isOneToOne: false; referencedRelation: "mapping_release"; referencedColumns: ["release_id", "site_id"] },
          { foreignKeyName: "grave_access_point_run_scope_fkey"; columns: ["georeferencing_run_id", "mapping_release_id", "site_id"]; isOneToOne: false; referencedRelation: "georeferencing_run"; referencedColumns: ["run_id", "release_id", "site_id"] },
          { foreignKeyName: "grave_access_point_plot_fkey"; columns: ["mapping_release_id", "lot_id"]; isOneToOne: true; referencedRelation: "plot_geometry"; referencedColumns: ["mapping_release_id", "lot_id"] },
          { foreignKeyName: "grave_access_point_area_fkey"; columns: ["mapping_release_id", "site_id", "area_id"]; isOneToOne: false; referencedRelation: "mapping_release_area"; referencedColumns: ["release_id", "site_id", "area_id"] },
          { foreignKeyName: "grave_access_point_node_fkey"; columns: ["node_id", "site_id", "mapping_release_id"]; isOneToOne: false; referencedRelation: "map_node"; referencedColumns: ["node_id", "site_id", "mapping_release_id"] },
          { foreignKeyName: "grave_access_point_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "account"; referencedColumns: ["account_id"] },
          { foreignKeyName: "grave_access_point_reviewed_by_fkey"; columns: ["reviewed_by"]; isOneToOne: false; referencedRelation: "account"; referencedColumns: ["account_id"] },
        ]
      }
      mapping_display_feature: {
        Row: {
          display_feature_id: string
          mapping_release_id: string
          site_id: number
          georeferencing_run_id: string
          source_feature_id: string
          artifact_hash: string
          layer_name: string
          layer_version: string
          kind: string
          label: string
          route_node_id: number | null
          display_geom: unknown
          review_state: string
          revision: number
          private_notes: string | null
          created_at: string
          imported_at: string
          created_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          display_feature_id?: string
          mapping_release_id: string
          site_id: number
          georeferencing_run_id: string
          source_feature_id: string
          artifact_hash: string
          layer_name: string
          layer_version: string
          kind: string
          label: string
          route_node_id?: number | null
          display_geom: unknown
          review_state?: string
          revision?: number
          private_notes?: string | null
          created_at?: string
          imported_at?: string
          created_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          display_feature_id?: string
          mapping_release_id?: string
          site_id?: number
          georeferencing_run_id?: string
          source_feature_id?: string
          artifact_hash?: string
          layer_name?: string
          layer_version?: string
          kind?: string
          label?: string
          route_node_id?: number | null
          display_geom?: unknown
          review_state?: string
          revision?: number
          private_notes?: string | null
          created_at?: string
          imported_at?: string
          created_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          { foreignKeyName: "mapping_display_feature_release_site_fkey"; columns: ["mapping_release_id", "site_id"]; isOneToOne: false; referencedRelation: "mapping_release"; referencedColumns: ["release_id", "site_id"] },
          { foreignKeyName: "mapping_display_feature_run_scope_fkey"; columns: ["georeferencing_run_id", "mapping_release_id", "site_id"]; isOneToOne: false; referencedRelation: "georeferencing_run"; referencedColumns: ["run_id", "release_id", "site_id"] },
          { foreignKeyName: "mapping_display_feature_node_fkey"; columns: ["route_node_id", "site_id", "mapping_release_id"]; isOneToOne: false; referencedRelation: "map_node"; referencedColumns: ["node_id", "site_id", "mapping_release_id"] },
          { foreignKeyName: "mapping_display_feature_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "account"; referencedColumns: ["account_id"] },
          { foreignKeyName: "mapping_display_feature_reviewed_by_fkey"; columns: ["reviewed_by"]; isOneToOne: false; referencedRelation: "account"; referencedColumns: ["account_id"] },
        ]
      }
      mapping_boundary: {
        Row: {
          boundary_id: string
          mapping_release_id: string
          site_id: number
          georeferencing_run_id: string
          source_feature_id: string
          artifact_hash: string
          layer_name: string
          layer_version: string
          kind: string
          area_id: number | null
          boundary_geom: unknown
          review_state: string
          revision: number
          private_notes: string | null
          created_at: string
          imported_at: string
          created_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          boundary_id?: string
          mapping_release_id: string
          site_id: number
          georeferencing_run_id: string
          source_feature_id: string
          artifact_hash: string
          layer_name: string
          layer_version: string
          kind: string
          area_id?: number | null
          boundary_geom: unknown
          review_state?: string
          revision?: number
          private_notes?: string | null
          created_at?: string
          imported_at?: string
          created_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          boundary_id?: string
          mapping_release_id?: string
          site_id?: number
          georeferencing_run_id?: string
          source_feature_id?: string
          artifact_hash?: string
          layer_name?: string
          layer_version?: string
          kind?: string
          area_id?: number | null
          boundary_geom?: unknown
          review_state?: string
          revision?: number
          private_notes?: string | null
          created_at?: string
          imported_at?: string
          created_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          { foreignKeyName: "mapping_boundary_release_site_fkey"; columns: ["mapping_release_id", "site_id"]; isOneToOne: false; referencedRelation: "mapping_release"; referencedColumns: ["release_id", "site_id"] },
          { foreignKeyName: "mapping_boundary_run_scope_fkey"; columns: ["georeferencing_run_id", "mapping_release_id", "site_id"]; isOneToOne: false; referencedRelation: "georeferencing_run"; referencedColumns: ["run_id", "release_id", "site_id"] },
          { foreignKeyName: "mapping_boundary_area_id_fkey"; columns: ["area_id"]; isOneToOne: false; referencedRelation: "area"; referencedColumns: ["area_id"] },
          { foreignKeyName: "mapping_boundary_area_scope_fkey"; columns: ["mapping_release_id", "site_id", "area_id"]; isOneToOne: false; referencedRelation: "mapping_release_area"; referencedColumns: ["release_id", "site_id", "area_id"] },
          { foreignKeyName: "mapping_boundary_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "account"; referencedColumns: ["account_id"] },
          { foreignKeyName: "mapping_boundary_reviewed_by_fkey"; columns: ["reviewed_by"]; isOneToOne: false; referencedRelation: "account"; referencedColumns: ["account_id"] },
        ]
      }
      plot_geometry: {
        Row: {
          plot_geometry_id: string
          mapping_release_id: string
          site_id: number
          georeferencing_run_id: string
          source_feature_id: string
          artifact_hash: string
          layer_name: string
          layer_version: string
          lot_id: number
          area_id: number
          plot_geom: unknown
          review_state: string
          revision: number
          private_notes: string | null
          created_at: string
          imported_at: string
          created_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          plot_geometry_id?: string
          mapping_release_id: string
          site_id: number
          georeferencing_run_id: string
          source_feature_id: string
          artifact_hash: string
          layer_name: string
          layer_version: string
          lot_id: number
          area_id: number
          plot_geom: unknown
          review_state?: string
          revision?: number
          private_notes?: string | null
          created_at?: string
          imported_at?: string
          created_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          plot_geometry_id?: string
          mapping_release_id?: string
          site_id?: number
          georeferencing_run_id?: string
          source_feature_id?: string
          artifact_hash?: string
          layer_name?: string
          layer_version?: string
          lot_id?: number
          area_id?: number
          plot_geom?: unknown
          review_state?: string
          revision?: number
          private_notes?: string | null
          created_at?: string
          imported_at?: string
          created_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          { foreignKeyName: "plot_geometry_release_site_fkey"; columns: ["mapping_release_id", "site_id"]; isOneToOne: false; referencedRelation: "mapping_release"; referencedColumns: ["release_id", "site_id"] },
          { foreignKeyName: "plot_geometry_run_scope_fkey"; columns: ["georeferencing_run_id", "mapping_release_id", "site_id"]; isOneToOne: false; referencedRelation: "georeferencing_run"; referencedColumns: ["run_id", "release_id", "site_id"] },
          { foreignKeyName: "plot_geometry_lot_id_fkey"; columns: ["lot_id"]; isOneToOne: false; referencedRelation: "lot"; referencedColumns: ["lot_id"] },
          { foreignKeyName: "plot_geometry_area_id_fkey"; columns: ["area_id"]; isOneToOne: false; referencedRelation: "area"; referencedColumns: ["area_id"] },
          { foreignKeyName: "plot_geometry_area_scope_fkey"; columns: ["mapping_release_id", "site_id", "area_id"]; isOneToOne: false; referencedRelation: "mapping_release_area"; referencedColumns: ["release_id", "site_id", "area_id"] },
          { foreignKeyName: "plot_geometry_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "account"; referencedColumns: ["account_id"] },
          { foreignKeyName: "plot_geometry_reviewed_by_fkey"; columns: ["reviewed_by"]; isOneToOne: false; referencedRelation: "account"; referencedColumns: ["account_id"] },
        ]
      }
      mapping_walkway_source: {
        Row: {
          walkway_source_id: string
          mapping_release_id: string
          site_id: number
          georeferencing_run_id: string
          source_feature_id: string
          artifact_hash: string
          layer_name: string
          layer_version: string
          area_id: number
          walkway_type: string
          walking_allowed: boolean
          restriction_context: string | null
          centerline_geom: unknown
          review_state: string
          revision: number
          private_notes: string | null
          created_at: string
          imported_at: string
          created_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          walkway_source_id?: string
          mapping_release_id: string
          site_id: number
          georeferencing_run_id: string
          source_feature_id: string
          artifact_hash: string
          layer_name: string
          layer_version: string
          area_id: number
          walkway_type: string
          walking_allowed?: boolean
          restriction_context?: string | null
          centerline_geom: unknown
          review_state?: string
          revision?: number
          private_notes?: string | null
          created_at?: string
          imported_at?: string
          created_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          walkway_source_id?: string
          mapping_release_id?: string
          site_id?: number
          georeferencing_run_id?: string
          source_feature_id?: string
          artifact_hash?: string
          layer_name?: string
          layer_version?: string
          area_id?: number
          walkway_type?: string
          walking_allowed?: boolean
          restriction_context?: string | null
          centerline_geom?: unknown
          review_state?: string
          revision?: number
          private_notes?: string | null
          created_at?: string
          imported_at?: string
          created_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          { foreignKeyName: "mapping_walkway_source_release_site_fkey"; columns: ["mapping_release_id", "site_id"]; isOneToOne: false; referencedRelation: "mapping_release"; referencedColumns: ["release_id", "site_id"] },
          { foreignKeyName: "mapping_walkway_source_run_scope_fkey"; columns: ["georeferencing_run_id", "mapping_release_id", "site_id"]; isOneToOne: false; referencedRelation: "georeferencing_run"; referencedColumns: ["run_id", "release_id", "site_id"] },
          { foreignKeyName: "mapping_walkway_source_area_id_fkey"; columns: ["area_id"]; isOneToOne: false; referencedRelation: "area"; referencedColumns: ["area_id"] },
          { foreignKeyName: "mapping_walkway_source_area_scope_fkey"; columns: ["mapping_release_id", "site_id", "area_id"]; isOneToOne: false; referencedRelation: "mapping_release_area"; referencedColumns: ["release_id", "site_id", "area_id"] },
          { foreignKeyName: "mapping_walkway_source_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "account"; referencedColumns: ["account_id"] },
          { foreignKeyName: "mapping_walkway_source_reviewed_by_fkey"; columns: ["reviewed_by"]; isOneToOne: false; referencedRelation: "account"; referencedColumns: ["account_id"] },
        ]
      }
      survey_point: {
        Row: {
          point_id: string
          site_id: number
          point_code: string
          role: string
          description: string | null
          source_plan_reference: string | null
          notes: string | null
          active: boolean
          review_state: string
          revision: number
          predecessor_point_id: string | null
          created_at: string
          created_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          point_id?: string
          site_id: number
          point_code: string
          role: string
          description?: string | null
          source_plan_reference?: string | null
          notes?: string | null
          active?: boolean
          review_state?: string
          revision?: number
          predecessor_point_id?: string | null
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          point_id?: string
          site_id?: number
          point_code?: string
          role?: string
          description?: string | null
          source_plan_reference?: string | null
          notes?: string | null
          active?: boolean
          review_state?: string
          revision?: number
          predecessor_point_id?: string | null
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          { foreignKeyName: "survey_point_site_id_fkey"; columns: ["site_id"]; isOneToOne: false; referencedRelation: "site"; referencedColumns: ["site_id"] },
          { foreignKeyName: "survey_point_predecessor_fkey"; columns: ["predecessor_point_id"]; isOneToOne: false; referencedRelation: "survey_point"; referencedColumns: ["point_id"] },
          { foreignKeyName: "survey_point_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "account"; referencedColumns: ["account_id"] },
          { foreignKeyName: "survey_point_updated_by_fkey"; columns: ["updated_by"]; isOneToOne: false; referencedRelation: "account"; referencedColumns: ["account_id"] },
        ]
      }
      survey_capture: {
        Row: {
          capture_id: string
          point_id: string
          site_id: number
          capture_code: string
          started_at: string
          ended_at: string | null
          device_reference: string | null
          operator_reference: string | null
          notes: string | null
          remeasures_capture_id: string | null
          remeasure_required: boolean
          review_state: string
          review_reason: string | null
          revision: number
          created_at: string
          created_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          capture_id?: string
          point_id: string
          site_id: number
          capture_code: string
          started_at: string
          ended_at?: string | null
          device_reference?: string | null
          operator_reference?: string | null
          notes?: string | null
          remeasures_capture_id?: string | null
          remeasure_required?: boolean
          review_state?: string
          review_reason?: string | null
          revision?: number
          created_at?: string
          created_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          capture_id?: string
          point_id?: string
          site_id?: number
          capture_code?: string
          started_at?: string
          ended_at?: string | null
          device_reference?: string | null
          operator_reference?: string | null
          notes?: string | null
          remeasures_capture_id?: string | null
          remeasure_required?: boolean
          review_state?: string
          review_reason?: string | null
          revision?: number
          created_at?: string
          created_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          { foreignKeyName: "survey_capture_point_site_fkey"; columns: ["point_id", "site_id"]; isOneToOne: false; referencedRelation: "survey_point"; referencedColumns: ["point_id", "site_id"] },
          { foreignKeyName: "survey_capture_parent_fkey"; columns: ["remeasures_capture_id", "point_id", "site_id"]; isOneToOne: false; referencedRelation: "survey_capture"; referencedColumns: ["capture_id", "point_id", "site_id"] },
          { foreignKeyName: "survey_capture_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "account"; referencedColumns: ["account_id"] },
          { foreignKeyName: "survey_capture_reviewed_by_fkey"; columns: ["reviewed_by"]; isOneToOne: false; referencedRelation: "account"; referencedColumns: ["account_id"] },
        ]
      }
      survey_observation: {
        Row: {
          observation_id: string
          capture_id: string
          observation_order: number
          latitude: number
          longitude: number
          reported_accuracy_m: number
          captured_at: string
          notes: string | null
          created_at: string
        }
        Insert: {
          observation_id?: string
          capture_id: string
          observation_order: number
          latitude: number
          longitude: number
          reported_accuracy_m: number
          captured_at: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          observation_id?: string
          capture_id?: string
          observation_order?: number
          latitude?: number
          longitude?: number
          reported_accuracy_m?: number
          captured_at?: string
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "survey_observation_capture_id_fkey"; columns: ["capture_id"]; isOneToOne: false; referencedRelation: "survey_capture"; referencedColumns: ["capture_id"] },
        ]
      }
      mapping_release: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          field_srid: number
          notes: string | null
          package_hash: string | null
          package_reference: string | null
          pilot_area_id: number | null
          published_at: string | null
          published_by: string | null
          published_srid: number
          qgis_version: string | null
          rejection_reason: string | null
          release_code: string
          release_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          revision: number
          scope_kind: string
          selected_run_id: string | null
          site_id: number
          source_coordinate_space: string | null
          source_plan_hash: string | null
          source_plan_reference: string | null
          source_plan_version: string | null
          staged_at: string | null
          staged_by: string | null
          status: string
          title: string
          validated_at: string | null
          validated_by: string | null
          validation_report_hash: string | null
          validation_summary: Json | null
          working_srid: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          field_srid?: number
          notes?: string | null
          package_hash?: string | null
          package_reference?: string | null
          pilot_area_id?: number | null
          published_at?: string | null
          published_by?: string | null
          published_srid?: number
          qgis_version?: string | null
          rejection_reason?: string | null
          release_code: string
          release_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision?: number
          scope_kind: string
          selected_run_id?: string | null
          site_id: number
          source_coordinate_space?: string | null
          source_plan_hash?: string | null
          source_plan_reference?: string | null
          source_plan_version?: string | null
          staged_at?: string | null
          staged_by?: string | null
          status?: string
          title: string
          validated_at?: string | null
          validated_by?: string | null
          validation_report_hash?: string | null
          validation_summary?: Json | null
          working_srid?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          field_srid?: number
          notes?: string | null
          package_hash?: string | null
          package_reference?: string | null
          pilot_area_id?: number | null
          published_at?: string | null
          published_by?: string | null
          published_srid?: number
          qgis_version?: string | null
          rejection_reason?: string | null
          release_code?: string
          release_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision?: number
          scope_kind?: string
          selected_run_id?: string | null
          site_id?: number
          source_coordinate_space?: string | null
          source_plan_hash?: string | null
          source_plan_reference?: string | null
          source_plan_version?: string | null
          staged_at?: string | null
          staged_by?: string | null
          status?: string
          title?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_report_hash?: string | null
          validation_summary?: Json | null
          working_srid?: number
        }
        Relationships: [
          {
            foreignKeyName: "mapping_release_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "site"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "mapping_release_pilot_area_id_fkey"
            columns: ["pilot_area_id"]
            isOneToOne: false
            referencedRelation: "area"
            referencedColumns: ["area_id"]
          },
          {
            foreignKeyName: "mapping_release_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "mapping_release_staged_by_fkey"
            columns: ["staged_by"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "mapping_release_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "mapping_release_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "mapping_release_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "mapping_release_selected_run_fkey"
            columns: ["selected_run_id", "release_id", "site_id"]
            isOneToOne: false
            referencedRelation: "georeferencing_run"
            referencedColumns: ["run_id", "release_id", "site_id"]
          },
        ]
      }
      mapping_release_area: {
        Row: {
          release_id: string
          site_id: number
          area_id: number
        }
        Insert: {
          release_id: string
          site_id: number
          area_id: number
        }
        Update: {
          release_id?: string
          site_id?: number
          area_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "mapping_release_area_release_site_fkey"
            columns: ["release_id", "site_id"]
            isOneToOne: false
            referencedRelation: "mapping_release"
            referencedColumns: ["release_id", "site_id"]
          },
          {
            foreignKeyName: "mapping_release_area_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "area"
            referencedColumns: ["area_id"]
          },
        ]
      }
      mapping_publication: {
        Row: {
          site_id: number
          area_id: number
          release_id: string
          published_at: string
          published_by: string | null
        }
        Insert: {
          site_id: number
          area_id: number
          release_id: string
          published_at?: string
          published_by?: string | null
        }
        Update: {
          site_id?: number
          area_id?: number
          release_id?: string
          published_at?: string
          published_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mapping_publication_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "site"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "mapping_publication_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "area"
            referencedColumns: ["area_id"]
          },
          {
            foreignKeyName: "mapping_publication_membership_fkey"
            columns: ["release_id", "site_id", "area_id"]
            isOneToOne: false
            referencedRelation: "mapping_release_area"
            referencedColumns: ["release_id", "site_id", "area_id"]
          },
          {
            foreignKeyName: "mapping_publication_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["account_id"]
          },
        ]
      }
      mapping_publication_event: {
        Row: {
          event_id: string
          site_id: number
          area_id: number
          previous_release_id: string | null
          new_release_id: string
          request_id: string
          kind: string
          actor_account_id: string | null
          created_at: string
        }
        Insert: {
          event_id?: string
          site_id: number
          area_id: number
          previous_release_id?: string | null
          new_release_id: string
          request_id: string
          kind: string
          actor_account_id?: string | null
          created_at?: string
        }
        Update: {
          event_id?: string
          site_id?: number
          area_id?: number
          previous_release_id?: string | null
          new_release_id?: string
          request_id?: string
          kind?: string
          actor_account_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mapping_publication_event_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "site"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "mapping_publication_event_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "area"
            referencedColumns: ["area_id"]
          },
          {
            foreignKeyName: "mapping_publication_event_previous_release_id_fkey"
            columns: ["previous_release_id"]
            isOneToOne: false
            referencedRelation: "mapping_release"
            referencedColumns: ["release_id"]
          },
          {
            foreignKeyName: "mapping_publication_event_new_release_id_fkey"
            columns: ["new_release_id"]
            isOneToOne: false
            referencedRelation: "mapping_release"
            referencedColumns: ["release_id"]
          },
          {
            foreignKeyName: "mapping_publication_event_membership_fkey"
            columns: ["new_release_id", "site_id", "area_id"]
            isOneToOne: false
            referencedRelation: "mapping_release_area"
            referencedColumns: ["release_id", "site_id", "area_id"]
          },
          {
            foreignKeyName: "mapping_publication_event_actor_account_id_fkey"
            columns: ["actor_account_id"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["account_id"]
          },
        ]
      }
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
          artifact_hash: string | null
          distance_m: number | null
          edge_id: number
          edge_type: string
          forward_cost_m: number | null
          from_node_id: number
          imported_at: string | null
          is_restricted: boolean
          layer_name: string | null
          layer_version: string | null
          mapping_release_id: string | null
          path_geom: unknown
          reverse_cost_m: number | null
          review_notes: string | null
          review_state: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          revision: number | null
          site_id: number | null
          source_feature_id: string | null
          source_walkway_id: string | null
          to_node_id: number
          direction: string | null
          walking_allowed: boolean | null
        }
        Insert: {
          artifact_hash?: string | null
          distance_m?: number | null
          edge_id?: number
          edge_type: string
          forward_cost_m?: number | null
          from_node_id: number
          imported_at?: string | null
          is_restricted?: boolean
          layer_name?: string | null
          layer_version?: string | null
          mapping_release_id?: string | null
          path_geom?: unknown
          reverse_cost_m?: number | null
          review_notes?: string | null
          review_state?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision?: number | null
          site_id?: number | null
          source_feature_id?: string | null
          source_walkway_id?: string | null
          to_node_id: number
          direction?: string | null
          walking_allowed?: boolean | null
        }
        Update: {
          artifact_hash?: string | null
          distance_m?: number | null
          edge_id?: number
          edge_type?: string
          forward_cost_m?: number | null
          from_node_id?: number
          imported_at?: string | null
          is_restricted?: boolean
          layer_name?: string | null
          layer_version?: string | null
          mapping_release_id?: string | null
          path_geom?: unknown
          reverse_cost_m?: number | null
          review_notes?: string | null
          review_state?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision?: number | null
          site_id?: number | null
          source_feature_id?: string | null
          source_walkway_id?: string | null
          to_node_id?: number
          direction?: string | null
          walking_allowed?: boolean | null
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
          { foreignKeyName: "map_edge_release_site_fkey"; columns: ["mapping_release_id", "site_id"]; isOneToOne: false; referencedRelation: "mapping_release"; referencedColumns: ["release_id", "site_id"] },
          { foreignKeyName: "map_edge_from_release_node_fkey"; columns: ["from_node_id", "site_id", "mapping_release_id"]; isOneToOne: false; referencedRelation: "map_node"; referencedColumns: ["node_id", "site_id", "mapping_release_id"] },
          { foreignKeyName: "map_edge_to_release_node_fkey"; columns: ["to_node_id", "site_id", "mapping_release_id"]; isOneToOne: false; referencedRelation: "map_node"; referencedColumns: ["node_id", "site_id", "mapping_release_id"] },
          { foreignKeyName: "map_edge_source_walkway_fkey"; columns: ["source_walkway_id", "mapping_release_id", "site_id"]; isOneToOne: false; referencedRelation: "mapping_walkway_source"; referencedColumns: ["walkway_source_id", "mapping_release_id", "site_id"] },
          { foreignKeyName: "map_edge_reviewed_by_fkey"; columns: ["reviewed_by"]; isOneToOne: false; referencedRelation: "account"; referencedColumns: ["account_id"] },
        ]
      }
      map_node: {
        Row: {
          artifact_hash: string | null
          imported_at: string | null
          layer_name: string | null
          layer_version: string | null
          location_geom: unknown
          mapping_release_id: string | null
          node_id: number
          node_name: string
          node_type: string
          px_loc_x: number | null
          px_loc_y: number | null
          review_notes: string | null
          review_state: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          revision: number | null
          site_id: number
          source_feature_id: string | null
        }
        Insert: {
          artifact_hash?: string | null
          imported_at?: string | null
          layer_name?: string | null
          layer_version?: string | null
          location_geom?: unknown
          mapping_release_id?: string | null
          node_id?: number
          node_name: string
          node_type: string
          px_loc_x?: number | null
          px_loc_y?: number | null
          review_notes?: string | null
          review_state?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision?: number | null
          site_id: number
          source_feature_id?: string | null
        }
        Update: {
          artifact_hash?: string | null
          imported_at?: string | null
          layer_name?: string | null
          layer_version?: string | null
          location_geom?: unknown
          mapping_release_id?: string | null
          node_id?: number
          node_name?: string
          node_type?: string
          px_loc_x?: number | null
          px_loc_y?: number | null
          review_notes?: string | null
          review_state?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision?: number | null
          site_id?: number
          source_feature_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "map_node_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "site"
            referencedColumns: ["site_id"]
          },
          { foreignKeyName: "map_node_release_site_fkey"; columns: ["mapping_release_id", "site_id"]; isOneToOne: false; referencedRelation: "mapping_release"; referencedColumns: ["release_id", "site_id"] },
          { foreignKeyName: "map_node_reviewed_by_fkey"; columns: ["reviewed_by"]; isOneToOne: false; referencedRelation: "account"; referencedColumns: ["account_id"] },
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
          coordinate_status: string | null
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
      staff_save_georeferencing_run: {
        Args: {
          p_run_id: string | null
          p_expected_revision: number | null
          p_values: Json
          p_memberships: Json
          p_results: Json
          p_request_id: string
        }
        Returns: Json
      }
      staff_review_georeferencing_run: {
        Args: {
          p_run_id: string
          p_expected_revision: number
          p_decision: string
          p_acknowledgements: Json
          p_notes: string | null
          p_request_id: string
        }
        Returns: Json
      }
      staff_save_survey_point: {
        Args: { p_point_id: string | null; p_expected_revision: number | null; p_values: Json; p_request_id: string }
        Returns: Json
      }
      staff_record_survey_capture: {
        Args: { p_point_id: string; p_capture_code: string; p_meta: Json; p_observations: Json; p_request_id: string }
        Returns: Json
      }
      staff_review_survey_capture: {
        Args: { p_capture_id: string; p_expected_revision: number; p_decision: string; p_acknowledgements: Json; p_notes: string | null; p_request_id: string }
        Returns: Json
      }
      staff_create_mapping_release: {
        Args: { p_values: Json; p_request_id: string }
        Returns: Json
      }
      staff_reject_mapping_release: {
        Args: {
          p_release_id: string
          p_expected_revision: number
          p_reason: string
          p_request_id: string
        }
        Returns: Json
      }
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

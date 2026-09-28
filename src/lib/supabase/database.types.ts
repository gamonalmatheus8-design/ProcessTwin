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
      analysis_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          dataset_id: string
          engine_version: string
          error_message: string | null
          id: string
          organization_id: string
          process_id: string
          started_at: string | null
          status: string
          summary: Json
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          dataset_id: string
          engine_version?: string
          error_message?: string | null
          id?: string
          organization_id: string
          process_id: string
          started_at?: string | null
          status?: string
          summary?: Json
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          dataset_id?: string
          engine_version?: string
          error_message?: string | null
          id?: string
          organization_id?: string
          process_id?: string
          started_at?: string | null
          status?: string
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "analysis_runs_dataset_id_organization_id_fkey"
            columns: ["dataset_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "analysis_runs_process_id_organization_id_fkey"
            columns: ["process_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      bottlenecks: {
        Row: {
          activity: string
          affected_cases: number | null
          analysis_run_id: string
          avg_wait_seconds: number | null
          created_at: string
          evidence: Json
          id: string
          organization_id: string
          process_id: string
          rank: number
          rework_rate_pct: number | null
          score: number
          severity: string
          sla_impact_pct: number | null
        }
        Insert: {
          activity: string
          affected_cases?: number | null
          analysis_run_id: string
          avg_wait_seconds?: number | null
          created_at?: string
          evidence?: Json
          id?: string
          organization_id: string
          process_id: string
          rank: number
          rework_rate_pct?: number | null
          score: number
          severity: string
          sla_impact_pct?: number | null
        }
        Update: {
          activity?: string
          affected_cases?: number | null
          analysis_run_id?: string
          avg_wait_seconds?: number | null
          created_at?: string
          evidence?: Json
          id?: string
          organization_id?: string
          process_id?: string
          rank?: number
          rework_rate_pct?: number | null
          score?: number
          severity?: string
          sla_impact_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bottlenecks_analysis_run_id_organization_id_fkey"
            columns: ["analysis_run_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "bottlenecks_process_id_organization_id_fkey"
            columns: ["process_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      datasets: {
        Row: {
          case_count: number
          column_mapping: Json
          created_at: string
          id: string
          name: string
          organization_id: string
          original_filename: string | null
          process_id: string
          row_count: number
          source_type: string
          storage_path: string | null
          uploaded_by: string
          validation_errors: Json
          validation_status: string
        }
        Insert: {
          case_count?: number
          column_mapping?: Json
          created_at?: string
          id?: string
          name: string
          organization_id: string
          original_filename?: string | null
          process_id: string
          row_count?: number
          source_type?: string
          storage_path?: string | null
          uploaded_by: string
          validation_errors?: Json
          validation_status?: string
        }
        Update: {
          case_count?: number
          column_mapping?: Json
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          original_filename?: string | null
          process_id?: string
          row_count?: number
          source_type?: string
          storage_path?: string | null
          uploaded_by?: string
          validation_errors?: Json
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "datasets_process_id_organization_id_fkey"
            columns: ["process_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      insights: {
        Row: {
          analysis_run_id: string | null
          confidence: number | null
          created_at: string
          evidence: Json
          id: string
          insight_type: string
          organization_id: string
          process_id: string
          simulation_run_id: string | null
          summary: string
          title: string
        }
        Insert: {
          analysis_run_id?: string | null
          confidence?: number | null
          created_at?: string
          evidence?: Json
          id?: string
          insight_type: string
          organization_id: string
          process_id: string
          simulation_run_id?: string | null
          summary: string
          title: string
        }
        Update: {
          analysis_run_id?: string | null
          confidence?: number | null
          created_at?: string
          evidence?: Json
          id?: string
          insight_type?: string
          organization_id?: string
          process_id?: string
          simulation_run_id?: string | null
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_analysis_run_id_organization_id_fkey"
            columns: ["analysis_run_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "insights_process_id_organization_id_fkey"
            columns: ["process_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "insights_simulation_run_id_organization_id_fkey"
            columns: ["simulation_run_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "simulation_runs"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      process_events: {
        Row: {
          activity: string
          case_id: string
          cost: number | null
          created_at: string
          dataset_id: string
          event_index: number
          event_time: string
          id: number
          lifecycle: string | null
          metadata: Json
          organization_id: string
          process_id: string
          resource: string | null
          status: string | null
        }
        Insert: {
          activity: string
          case_id: string
          cost?: number | null
          created_at?: string
          dataset_id: string
          event_index: number
          event_time: string
          id?: never
          lifecycle?: string | null
          metadata?: Json
          organization_id: string
          process_id: string
          resource?: string | null
          status?: string | null
        }
        Update: {
          activity?: string
          case_id?: string
          cost?: number | null
          created_at?: string
          dataset_id?: string
          event_index?: number
          event_time?: string
          id?: never
          lifecycle?: string | null
          metadata?: Json
          organization_id?: string
          process_id?: string
          resource?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_events_dataset_id_organization_id_fkey"
            columns: ["dataset_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "process_events_process_id_organization_id_fkey"
            columns: ["process_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      process_models: {
        Row: {
          analysis_run_id: string
          created_at: string
          dataset_id: string
          graph: Json
          id: string
          metrics: Json
          model_version: string
          organization_id: string
          process_id: string
          variants: Json
        }
        Insert: {
          analysis_run_id: string
          created_at?: string
          dataset_id: string
          graph?: Json
          id?: string
          metrics?: Json
          model_version?: string
          organization_id: string
          process_id: string
          variants?: Json
        }
        Update: {
          analysis_run_id?: string
          created_at?: string
          dataset_id?: string
          graph?: Json
          id?: string
          metrics?: Json
          model_version?: string
          organization_id?: string
          process_id?: string
          variants?: Json
        }
        Relationships: [
          {
            foreignKeyName: "process_models_analysis_run_id_organization_id_fkey"
            columns: ["analysis_run_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "process_models_dataset_id_organization_id_fkey"
            columns: ["dataset_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "process_models_process_id_organization_id_fkey"
            columns: ["process_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      processes: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_results: {
        Row: {
          baseline_metrics: Json
          created_at: string
          deltas: Json
          id: string
          impact_summary: Json
          organization_id: string
          process_id: string
          simulated_metrics: Json
          simulation_run_id: string
        }
        Insert: {
          baseline_metrics?: Json
          created_at?: string
          deltas?: Json
          id?: string
          impact_summary?: Json
          organization_id: string
          process_id: string
          simulated_metrics?: Json
          simulation_run_id: string
        }
        Update: {
          baseline_metrics?: Json
          created_at?: string
          deltas?: Json
          id?: string
          impact_summary?: Json
          organization_id?: string
          process_id?: string
          simulated_metrics?: Json
          simulation_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_results_process_id_organization_id_fkey"
            columns: ["process_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "simulation_results_simulation_run_id_organization_id_fkey"
            columns: ["simulation_run_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "simulation_runs"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      simulation_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          error_message: string | null
          id: string
          iterations: number
          organization_id: string
          process_id: string
          random_seed: number | null
          scenario_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          error_message?: string | null
          id?: string
          iterations?: number
          organization_id: string
          process_id: string
          random_seed?: number | null
          scenario_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          error_message?: string | null
          id?: string
          iterations?: number
          organization_id?: string
          process_id?: string
          random_seed?: number | null
          scenario_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_runs_process_id_organization_id_fkey"
            columns: ["process_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "simulation_runs_scenario_id_organization_id_fkey"
            columns: ["scenario_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "simulation_scenarios"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      simulation_scenarios: {
        Row: {
          baseline_analysis_run_id: string
          config: Json
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          organization_id: string
          process_id: string
          updated_at: string
        }
        Insert: {
          baseline_analysis_run_id: string
          config?: Json
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          process_id: string
          updated_at?: string
        }
        Update: {
          baseline_analysis_run_id?: string
          config?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          process_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_scenarios_baseline_analysis_run_id_organization_fkey"
            columns: ["baseline_analysis_run_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "simulation_scenarios_process_id_organization_id_fkey"
            columns: ["process_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action_details: Json | null
          action_type: Database["public"]["Enums"]["action_type"]
          id: string
          signage_spot_id: string | null
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          action_details?: Json | null
          action_type: Database["public"]["Enums"]["action_type"]
          id?: string
          signage_spot_id?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          action_details?: Json | null
          action_type?: Database["public"]["Enums"]["action_type"]
          id?: string
          signage_spot_id?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_signage_spot_id_fkey"
            columns: ["signage_spot_id"]
            isOneToOne: false
            referencedRelation: "signage_spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_settings: {
        Row: {
          alert_triggers: Json | null
          alert_type: string
          created_at: string | null
          email_recipients: string[] | null
          enabled: boolean | null
          id: string
          slack_webhook_url: string | null
          updated_at: string | null
        }
        Insert: {
          alert_triggers?: Json | null
          alert_type: string
          created_at?: string | null
          email_recipients?: string[] | null
          enabled?: boolean | null
          id?: string
          slack_webhook_url?: string | null
          updated_at?: string | null
        }
        Update: {
          alert_triggers?: Json | null
          alert_type?: string
          created_at?: string | null
          email_recipients?: string[] | null
          enabled?: boolean | null
          id?: string
          slack_webhook_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      approval_history: {
        Row: {
          comments: string | null
          created_at: string | null
          id: string
          photo_id: string | null
          previous_status: Database["public"]["Enums"]["approval_status"] | null
          reviewed_at: string | null
          reviewed_by: string | null
          signage_spot_id: string | null
          status: Database["public"]["Enums"]["approval_status"]
        }
        Insert: {
          comments?: string | null
          created_at?: string | null
          id?: string
          photo_id?: string | null
          previous_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          signage_spot_id?: string | null
          status: Database["public"]["Enums"]["approval_status"]
        }
        Update: {
          comments?: string | null
          created_at?: string | null
          id?: string
          photo_id?: string | null
          previous_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          signage_spot_id?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Relationships: [
          {
            foreignKeyName: "approval_history_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photo_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_history_signage_spot_id_fkey"
            columns: ["signage_spot_id"]
            isOneToOne: false
            referencedRelation: "signage_spots"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          template_config: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          template_config: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          template_config?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          budget_allocated: number | null
          budget_notes: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          name: string
          start_date: string | null
        }
        Insert: {
          budget_allocated?: number | null
          budget_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          start_date?: string | null
        }
        Update: {
          budget_allocated?: number | null
          budget_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          applies_to_categories: string[] | null
          applies_to_venues: string[] | null
          created_at: string | null
          created_by: string | null
          field_label: string
          field_name: string
          field_options: Json | null
          field_order: number | null
          field_type: Database["public"]["Enums"]["field_type"]
          id: string
          is_required: boolean | null
          is_visible: boolean | null
        }
        Insert: {
          applies_to_categories?: string[] | null
          applies_to_venues?: string[] | null
          created_at?: string | null
          created_by?: string | null
          field_label: string
          field_name: string
          field_options?: Json | null
          field_order?: number | null
          field_type: Database["public"]["Enums"]["field_type"]
          id?: string
          is_required?: boolean | null
          is_visible?: boolean | null
        }
        Update: {
          applies_to_categories?: string[] | null
          applies_to_venues?: string[] | null
          created_at?: string | null
          created_by?: string | null
          field_label?: string
          field_name?: string
          field_options?: Json | null
          field_order?: number | null
          field_type?: Database["public"]["Enums"]["field_type"]
          id?: string
          is_required?: boolean | null
          is_visible?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_history: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"] | null
          caption: string | null
          id: string
          image_type: Database["public"]["Enums"]["image_type"] | null
          image_url: string
          signage_spot_id: string
          upload_date: string | null
          uploaded_by: string | null
        }
        Insert: {
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          caption?: string | null
          id?: string
          image_type?: Database["public"]["Enums"]["image_type"] | null
          image_url: string
          signage_spot_id: string
          upload_date?: string | null
          uploaded_by?: string | null
        }
        Update: {
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          caption?: string | null
          id?: string
          image_type?: Database["public"]["Enums"]["image_type"] | null
          image_url?: string
          signage_spot_id?: string
          upload_date?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photo_history_signage_spot_id_fkey"
            columns: ["signage_spot_id"]
            isOneToOne: false
            referencedRelation: "signage_spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_history_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      signage_campaigns: {
        Row: {
          campaign_id: string
          created_at: string | null
          id: string
          signage_spot_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          id?: string
          signage_spot_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          id?: string
          signage_spot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signage_campaigns_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signage_campaigns_signage_spot_id_fkey"
            columns: ["signage_spot_id"]
            isOneToOne: false
            referencedRelation: "signage_spots"
            referencedColumns: ["id"]
          },
        ]
      }
      signage_custom_values: {
        Row: {
          created_at: string | null
          custom_field_id: string
          id: string
          signage_spot_id: string
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          created_at?: string | null
          custom_field_id: string
          id?: string
          signage_spot_id: string
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          created_at?: string | null
          custom_field_id?: string
          id?: string
          signage_spot_id?: string
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "signage_custom_values_custom_field_id_fkey"
            columns: ["custom_field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signage_custom_values_signage_spot_id_fkey"
            columns: ["signage_spot_id"]
            isOneToOne: false
            referencedRelation: "signage_spots"
            referencedColumns: ["id"]
          },
        ]
      }
      signage_groups: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      signage_spot_groups: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          signage_spot_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          signage_spot_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          signage_spot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signage_spot_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "signage_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signage_spot_groups_signage_spot_id_fkey"
            columns: ["signage_spot_id"]
            isOneToOne: false
            referencedRelation: "signage_spots"
            referencedColumns: ["id"]
          },
        ]
      }
      signage_spots: {
        Row: {
          assigned_user_id: string | null
          budget_notes: string | null
          content_category:
            | Database["public"]["Enums"]["content_category"]
            | null
          created_at: string | null
          created_by: string | null
          creative_brief: string | null
          current_image_url: string | null
          depth_cm: number | null
          expiry_behavior: string | null
          expiry_date: string | null
          height_cm: number | null
          id: string
          install_date: string | null
          installation_cost: number | null
          is_opportunity: boolean | null
          last_update_date: string | null
          legacy_drive_link: string | null
          location_name: string
          material_type: string | null
          mounting_type: string | null
          notes: string | null
          orientation: Database["public"]["Enums"]["orientation_type"] | null
          priority_level: Database["public"]["Enums"]["priority_level"] | null
          production_cost: number | null
          qr_code_data: string | null
          recommendations: string | null
          specs_notes: string | null
          status: Database["public"]["Enums"]["signage_status"] | null
          supplier_vendor: string | null
          tags: string[] | null
          updated_at: string | null
          updated_by: string | null
          venue_id: string
          width_cm: number | null
        }
        Insert: {
          assigned_user_id?: string | null
          budget_notes?: string | null
          content_category?:
            | Database["public"]["Enums"]["content_category"]
            | null
          created_at?: string | null
          created_by?: string | null
          creative_brief?: string | null
          current_image_url?: string | null
          depth_cm?: number | null
          expiry_behavior?: string | null
          expiry_date?: string | null
          height_cm?: number | null
          id?: string
          install_date?: string | null
          installation_cost?: number | null
          is_opportunity?: boolean | null
          last_update_date?: string | null
          legacy_drive_link?: string | null
          location_name: string
          material_type?: string | null
          mounting_type?: string | null
          notes?: string | null
          orientation?: Database["public"]["Enums"]["orientation_type"] | null
          priority_level?: Database["public"]["Enums"]["priority_level"] | null
          production_cost?: number | null
          qr_code_data?: string | null
          recommendations?: string | null
          specs_notes?: string | null
          status?: Database["public"]["Enums"]["signage_status"] | null
          supplier_vendor?: string | null
          tags?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
          venue_id: string
          width_cm?: number | null
        }
        Update: {
          assigned_user_id?: string | null
          budget_notes?: string | null
          content_category?:
            | Database["public"]["Enums"]["content_category"]
            | null
          created_at?: string | null
          created_by?: string | null
          creative_brief?: string | null
          current_image_url?: string | null
          depth_cm?: number | null
          expiry_behavior?: string | null
          expiry_date?: string | null
          height_cm?: number | null
          id?: string
          install_date?: string | null
          installation_cost?: number | null
          is_opportunity?: boolean | null
          last_update_date?: string | null
          legacy_drive_link?: string | null
          location_name?: string
          material_type?: string | null
          mounting_type?: string | null
          notes?: string | null
          orientation?: Database["public"]["Enums"]["orientation_type"] | null
          priority_level?: Database["public"]["Enums"]["priority_level"] | null
          production_cost?: number | null
          qr_code_data?: string | null
          recommendations?: string | null
          specs_notes?: string | null
          status?: Database["public"]["Enums"]["signage_status"] | null
          supplier_vendor?: string | null
          tags?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
          venue_id?: string
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "signage_spots_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signage_spots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signage_spots_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signage_spots_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_campaign_budget: {
        Args: { campaign_id: string }
        Returns: number
      }
      calculate_expiry_date: {
        Args: {
          p_campaign_end_date: string
          p_custom_expiry_date: string
          p_expiry_behavior: string
          p_install_date: string
          p_last_update_date: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      action_type:
        | "created"
        | "updated"
        | "deleted"
        | "status_changed"
        | "image_uploaded"
        | "assigned"
      app_role: "admin" | "manager" | "staff"
      approval_status: "pending" | "approved" | "rejected"
      content_category:
        | "evergreen"
        | "event_based"
        | "seasonal"
        | "partnership"
        | "theming"
        | "marketing"
      field_type:
        | "text"
        | "longtext"
        | "dropdown"
        | "date"
        | "url"
        | "number"
        | "checkbox"
        | "multiselect"
        | "image"
      image_type: "before" | "after" | "current" | "reference" | "planned"
      orientation_type: "portrait" | "landscape" | "square"
      priority_level: "critical" | "high" | "medium" | "low"
      signage_status:
        | "current"
        | "expiring_soon"
        | "overdue"
        | "empty"
        | "planned"
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
      action_type: [
        "created",
        "updated",
        "deleted",
        "status_changed",
        "image_uploaded",
        "assigned",
      ],
      app_role: ["admin", "manager", "staff"],
      approval_status: ["pending", "approved", "rejected"],
      content_category: [
        "evergreen",
        "event_based",
        "seasonal",
        "partnership",
        "theming",
        "marketing",
      ],
      field_type: [
        "text",
        "longtext",
        "dropdown",
        "date",
        "url",
        "number",
        "checkbox",
        "multiselect",
        "image",
      ],
      image_type: ["before", "after", "current", "reference", "planned"],
      orientation_type: ["portrait", "landscape", "square"],
      priority_level: ["critical", "high", "medium", "low"],
      signage_status: [
        "current",
        "expiring_soon",
        "overdue",
        "empty",
        "planned",
      ],
    },
  },
} as const

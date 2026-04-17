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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      agency_settings: {
        Row: {
          agency_document: string | null
          agency_email: string | null
          agency_logo_url: string | null
          agency_name: string
          agency_phone: string | null
          created_at: string
          currency: string
          default_invoice_due_days: number
          default_pix_key: string | null
          default_pix_key_type: string | null
          default_revision_limit: number
          id: string
          invoice_prefix: string
          next_invoice_number: number
          timezone: string
          updated_at: string
          whatsapp_template: string
        }
        Insert: {
          agency_document?: string | null
          agency_email?: string | null
          agency_logo_url?: string | null
          agency_name?: string
          agency_phone?: string | null
          created_at?: string
          currency?: string
          default_invoice_due_days?: number
          default_pix_key?: string | null
          default_pix_key_type?: string | null
          default_revision_limit?: number
          id?: string
          invoice_prefix?: string
          next_invoice_number?: number
          timezone?: string
          updated_at?: string
          whatsapp_template?: string
        }
        Update: {
          agency_document?: string | null
          agency_email?: string | null
          agency_logo_url?: string | null
          agency_name?: string
          agency_phone?: string | null
          created_at?: string
          currency?: string
          default_invoice_due_days?: number
          default_pix_key?: string | null
          default_pix_key_type?: string | null
          default_revision_limit?: number
          id?: string
          invoice_prefix?: string
          next_invoice_number?: number
          timezone?: string
          updated_at?: string
          whatsapp_template?: string
        }
        Relationships: []
      }
      client_access_tokens: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          token: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          token?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_access_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_tags: {
        Row: {
          client_id: string
          tag_id: string
        }
        Insert: {
          client_id: string
          tag_id: string
        }
        Update: {
          client_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_tags_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          avg_response_time: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          profile_type: string | null
          status: Database["public"]["Enums"]["client_status"]
          total_approvals: number | null
          total_revisions: number | null
          updated_at: string
        }
        Insert: {
          avg_response_time?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          profile_type?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          total_approvals?: number | null
          total_revisions?: number | null
          updated_at?: string
        }
        Update: {
          avg_response_time?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          profile_type?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          total_approvals?: number | null
          total_revisions?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          content_version_id: string
          created_at: string
          id: string
          text: string
          user_id: string
        }
        Insert: {
          content_version_id: string
          created_at?: string
          id?: string
          text: string
          user_id: string
        }
        Update: {
          content_version_id?: string
          created_at?: string
          id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_content_version_id_fkey"
            columns: ["content_version_id"]
            isOneToOne: false
            referencedRelation: "content_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      content_tags: {
        Row: {
          content_id: string
          tag_id: string
        }
        Insert: {
          content_id: string
          tag_id: string
        }
        Update: {
          content_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_tags_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      content_versions: {
        Row: {
          content_id: string
          created_at: string
          created_by: string | null
          file_url: string | null
          id: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["content_status"]
          version_number: number
        }
        Insert: {
          content_id: string
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          version_number?: number
        }
        Update: {
          content_id?: string
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_versions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
        ]
      }
      contents: {
        Row: {
          assigned_to: string | null
          checklist: Json | null
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string | null
          id: string
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string
          revision_count: number | null
          revision_limit: number | null
          status: Database["public"]["Enums"]["content_status"]
          title: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          checklist?: Json | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id: string
          revision_count?: number | null
          revision_limit?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          type?: Database["public"]["Enums"]["content_type"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          checklist?: Json | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string
          revision_count?: number | null
          revision_limit?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          type?: Database["public"]["Enums"]["content_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_tags: {
        Row: {
          expense_id: string
          tag_id: string
        }
        Insert: {
          expense_id: string
          tag_id: string
        }
        Update: {
          expense_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_tags_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          attachment_url: string | null
          category: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          financial_type: Database["public"]["Enums"]["financial_type"]
          id: string
          is_recurring_active: boolean
          notes: string | null
          parent_expense_id: string | null
          project_id: string | null
          recurrence: Database["public"]["Enums"]["recurrence_type"]
          recurrence_day: number | null
          recurrence_end: string | null
          status: Database["public"]["Enums"]["expense_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          attachment_url?: string | null
          category?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date: string
          financial_type?: Database["public"]["Enums"]["financial_type"]
          id?: string
          is_recurring_active?: boolean
          notes?: string | null
          parent_expense_id?: string | null
          project_id?: string | null
          recurrence?: Database["public"]["Enums"]["recurrence_type"]
          recurrence_day?: number | null
          recurrence_end?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          category?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string
          financial_type?: Database["public"]["Enums"]["financial_type"]
          id?: string
          is_recurring_active?: boolean
          notes?: string | null
          parent_expense_id?: string | null
          project_id?: string | null
          recurrence?: Database["public"]["Enums"]["recurrence_type"]
          recurrence_day?: number | null
          recurrence_end?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_parent_expense_id_fkey"
            columns: ["parent_expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_tags: {
        Row: {
          invoice_id: string
          tag_id: string
        }
        Insert: {
          invoice_id: string
          tag_id: string
        }
        Update: {
          invoice_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_tags_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          created_by: string | null
          due_date: string
          financial_type: Database["public"]["Enums"]["financial_type"]
          id: string
          is_recurring_active: boolean
          notes: string | null
          paid_at: string | null
          parent_invoice_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          project_id: string | null
          quote_id: string | null
          recurrence: Database["public"]["Enums"]["recurrence_type"]
          recurrence_day: number | null
          recurrence_end: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id: string
          created_at?: string
          created_by?: string | null
          due_date: string
          financial_type?: Database["public"]["Enums"]["financial_type"]
          id?: string
          is_recurring_active?: boolean
          notes?: string | null
          paid_at?: string | null
          parent_invoice_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          project_id?: string | null
          quote_id?: string | null
          recurrence?: Database["public"]["Enums"]["recurrence_type"]
          recurrence_day?: number | null
          recurrence_end?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string
          financial_type?: Database["public"]["Enums"]["financial_type"]
          id?: string
          is_recurring_active?: boolean
          notes?: string | null
          paid_at?: string | null
          parent_invoice_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          project_id?: string | null
          quote_id?: string | null
          recurrence?: Database["public"]["Enums"]["recurrence_type"]
          recurrence_day?: number | null
          recurrence_end?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_parent_invoice_id_fkey"
            columns: ["parent_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_income: {
        Row: {
          amount: number
          attachment_url: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          id: string
          is_recurring_active: boolean
          notes: string | null
          parent_income_id: string | null
          recurrence: Database["public"]["Enums"]["recurrence_type"]
          recurrence_day: number | null
          recurrence_end: string | null
          status: Database["public"]["Enums"]["expense_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          attachment_url?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date: string
          id?: string
          is_recurring_active?: boolean
          notes?: string | null
          parent_income_id?: string | null
          recurrence?: Database["public"]["Enums"]["recurrence_type"]
          recurrence_day?: number | null
          recurrence_end?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string
          id?: string
          is_recurring_active?: boolean
          notes?: string | null
          parent_income_id?: string | null
          recurrence?: Database["public"]["Enums"]["recurrence_type"]
          recurrence_day?: number | null
          recurrence_end?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_income_parent_income_id_fkey"
            columns: ["parent_income_id"]
            isOneToOne: false
            referencedRelation: "personal_income"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_tags: {
        Row: {
          project_id: string
          tag_id: string
        }
        Insert: {
          project_id: string
          tag_id: string
        }
        Update: {
          project_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string | null
          id: string
          name: string
          priority: Database["public"]["Enums"]["priority_level"]
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          name: string
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          name?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          services: Json
          status: Database["public"]["Enums"]["quote_status"]
          title: string
          total_value: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          services?: Json
          status?: Database["public"]["Enums"]["quote_status"]
          title: string
          total_value?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          services?: Json
          status?: Database["public"]["Enums"]["quote_status"]
          title?: string
          total_value?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "editor" | "viewer"
      client_status: "active" | "inactive" | "prospect"
      content_status:
        | "draft"
        | "in_review"
        | "revision"
        | "approved"
        | "published"
      content_type:
        | "photo"
        | "video"
        | "reels"
        | "stories"
        | "carousel"
        | "cover"
        | "banner"
        | "other"
      expense_status: "pending" | "paid" | "overdue"
      financial_type: "pj" | "pf"
      invoice_status: "pending" | "paid" | "overdue" | "cancelled"
      payment_method:
        | "pix"
        | "bank_transfer"
        | "credit_card"
        | "boleto"
        | "other"
      priority_level: "low" | "medium" | "high" | "urgent"
      project_status:
        | "briefing"
        | "in_progress"
        | "review"
        | "completed"
        | "paused"
        | "cancelled"
      quote_status: "draft" | "sent" | "accepted" | "rejected" | "expired"
      recurrence_type: "one_time" | "recurring"
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
      app_role: ["admin", "manager", "editor", "viewer"],
      client_status: ["active", "inactive", "prospect"],
      content_status: [
        "draft",
        "in_review",
        "revision",
        "approved",
        "published",
      ],
      content_type: [
        "photo",
        "video",
        "reels",
        "stories",
        "carousel",
        "cover",
        "banner",
        "other",
      ],
      expense_status: ["pending", "paid", "overdue"],
      financial_type: ["pj", "pf"],
      invoice_status: ["pending", "paid", "overdue", "cancelled"],
      payment_method: [
        "pix",
        "bank_transfer",
        "credit_card",
        "boleto",
        "other",
      ],
      priority_level: ["low", "medium", "high", "urgent"],
      project_status: [
        "briefing",
        "in_progress",
        "review",
        "completed",
        "paused",
        "cancelled",
      ],
      quote_status: ["draft", "sent", "accepted", "rejected", "expired"],
      recurrence_type: ["one_time", "recurring"],
    },
  },
} as const

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      assistant_conversations: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          quiz_attempt_id: string | null
          session_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          quiz_attempt_id?: string | null
          session_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          quiz_attempt_id?: string | null
          session_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_conversations_quiz_attempt_id_fkey"
            columns: ["quiz_attempt_id"]
            isOneToOne: false
            referencedRelation: "career_quiz_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          sender_type: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          sender_type: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      career_quiz_attempts: {
        Row: {
          created_at: string | null
          id: string
          q1_coding_comfort: number | null
          q10_tool_choice: string | null
          q11_ai_product_interest: number | null
          q12_strategic_influence_interest: number | null
          q13_infrastructure_interest: number | null
          q14_kpi_reporting_interest: number | null
          q2_stat_modeling_interest: number | null
          q3_systems_vs_trends: number | null
          q4_insight_generation: number | null
          q5_stakeholder_communication: number | null
          q6_business_vs_processing: number | null
          q7_system_optimization: number | null
          q8_modeling_patterns: number | null
          q9_business_question_focus: number | null
          result_ai_ml_score: number | null
          result_analytics_score: number | null
          result_business_intelligence_score: number | null
          result_data_engineering_score: number | null
          session_id: string | null
          top_recommended_path: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          q1_coding_comfort?: number | null
          q10_tool_choice?: string | null
          q11_ai_product_interest?: number | null
          q12_strategic_influence_interest?: number | null
          q13_infrastructure_interest?: number | null
          q14_kpi_reporting_interest?: number | null
          q2_stat_modeling_interest?: number | null
          q3_systems_vs_trends?: number | null
          q4_insight_generation?: number | null
          q5_stakeholder_communication?: number | null
          q6_business_vs_processing?: number | null
          q7_system_optimization?: number | null
          q8_modeling_patterns?: number | null
          q9_business_question_focus?: number | null
          result_ai_ml_score?: number | null
          result_analytics_score?: number | null
          result_business_intelligence_score?: number | null
          result_data_engineering_score?: number | null
          session_id?: string | null
          top_recommended_path?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          q1_coding_comfort?: number | null
          q10_tool_choice?: string | null
          q11_ai_product_interest?: number | null
          q12_strategic_influence_interest?: number | null
          q13_infrastructure_interest?: number | null
          q14_kpi_reporting_interest?: number | null
          q2_stat_modeling_interest?: number | null
          q3_systems_vs_trends?: number | null
          q4_insight_generation?: number | null
          q5_stakeholder_communication?: number | null
          q6_business_vs_processing?: number | null
          q7_system_optimization?: number | null
          q8_modeling_patterns?: number | null
          q9_business_question_focus?: number | null
          result_ai_ml_score?: number | null
          result_analytics_score?: number | null
          result_business_intelligence_score?: number | null
          result_data_engineering_score?: number | null
          session_id?: string | null
          top_recommended_path?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          added_at: string | null
          conversation_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          added_at?: string | null
          conversation_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          added_at?: string | null
          conversation_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_conversation_participant_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          archived: boolean | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          is_group: boolean | null
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          archived?: boolean | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_group?: boolean | null
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          archived?: boolean | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_group?: boolean | null
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      course_assignments: {
        Row: {
          course_id: string | null
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_wishlists: {
        Row: {
          course_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_wishlists_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string
          created_at: string | null
          description: string
          duration: string | null
          enrollment_status: string | null
          id: string
          image_url: string | null
          instructor_id: string | null
          level: string
          published: boolean | null
          tags: string[] | null
          thumbnail: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          duration?: string | null
          enrollment_status?: string | null
          id?: string
          image_url?: string | null
          instructor_id?: string | null
          level: string
          published?: boolean | null
          tags?: string[] | null
          thumbnail?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          duration?: string | null
          enrollment_status?: string | null
          id?: string
          image_url?: string | null
          instructor_id?: string | null
          level?: string
          published?: boolean | null
          tags?: string[] | null
          thumbnail?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          completion_status: number | null
          course_id: string | null
          enrolled_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          completion_status?: number | null
          course_id?: string | null
          enrolled_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          completion_status?: number | null
          course_id?: string | null
          enrolled_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          event_id: string | null
          id: string
          registered_at: string | null
          user_id: string | null
        }
        Insert: {
          event_id?: string | null
          id?: string
          registered_at?: string | null
          user_id?: string | null
        }
        Update: {
          event_id?: string | null
          id?: string
          registered_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          calendly_link: string | null
          capacity: number | null
          created_at: string | null
          date: string
          description: string
          end_time: string | null
          format: string
          id: string
          image: string | null
          link: string | null
          location: string | null
          start_time: string | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          calendly_link?: string | null
          capacity?: number | null
          created_at?: string | null
          date: string
          description: string
          end_time?: string | null
          format: string
          id?: string
          image?: string | null
          link?: string | null
          location?: string | null
          start_time?: string | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          calendly_link?: string | null
          capacity?: number | null
          created_at?: string | null
          date?: string
          description?: string
          end_time?: string | null
          format?: string
          id?: string
          image?: string | null
          link?: string | null
          location?: string | null
          start_time?: string | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lessons: {
        Row: {
          content: string
          created_at: string | null
          description: string
          duration: string | null
          id: string
          module_id: string | null
          order_num: number
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          description: string
          duration?: string | null
          id?: string
          module_id?: string | null
          order_num: number
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          description?: string
          duration?: string | null
          id?: string
          module_id?: string | null
          order_num?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_url: string | null
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          read: boolean | null
          sender_id: string | null
        }
        Insert: {
          attachment_url?: string | null
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          read?: boolean | null
          sender_id?: string | null
        }
        Update: {
          attachment_url?: string | null
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          read?: boolean | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      module_content: {
        Row: {
          content: string
          created_at: string | null
          id: string
          module_id: string | null
          position: number
          type: Database["public"]["Enums"]["module_content_type"]
          updated_at: string | null
          uploaded_by: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          module_id?: string | null
          position?: number
          type: Database["public"]["Enums"]["module_content_type"]
          updated_at?: string | null
          uploaded_by: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          module_id?: string | null
          position?: number
          type?: Database["public"]["Enums"]["module_content_type"]
          updated_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_content_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          course_id: string | null
          created_at: string | null
          description: string
          id: string
          title: string
          updated_at: string | null
          week: number
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          title: string
          updated_at?: string | null
          week: number
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          title?: string
          updated_at?: string | null
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      page_visibility: {
        Row: {
          created_at: string | null
          id: string
          page_name: string
          page_path: string
          updated_at: string | null
          visible_to_instructors: boolean
          visible_to_users: boolean
        }
        Insert: {
          created_at?: string | null
          id?: string
          page_name: string
          page_path: string
          updated_at?: string | null
          visible_to_instructors?: boolean
          visible_to_users?: boolean
        }
        Update: {
          created_at?: string | null
          id?: string
          page_name?: string
          page_path?: string
          updated_at?: string | null
          visible_to_instructors?: boolean
          visible_to_users?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          first_name: string | null
          id: string
          last_name: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          id: string
          lesson_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lesson_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lesson_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          thumbnail: string | null
          title: string
          type: string
          updated_at: string | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          thumbnail?: string | null
          title: string
          type: string
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          thumbnail?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      resumes: {
        Row: {
          analysis: Json | null
          career_alignment_score: number | null
          file_path: string
          id: string
          initial_assessment: string | null
          target_role: string | null
          text: string | null
          updated_at: string | null
          uploaded_at: string | null
          user_id: string | null
        }
        Insert: {
          analysis?: Json | null
          career_alignment_score?: number | null
          file_path: string
          id?: string
          initial_assessment?: string | null
          target_role?: string | null
          text?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          user_id?: string | null
        }
        Update: {
          analysis?: Json | null
          career_alignment_score?: number | null
          file_path?: string
          id?: string
          initial_assessment?: string | null
          target_role?: string | null
          text?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      quiz_analytics: {
        Row: {
          ai_ml_recommendations: number | null
          analytics_recommendations: number | null
          bi_recommendations: number | null
          data_engineering_recommendations: number | null
          day: string | null
          total_attempts: number | null
          unique_sessions: number | null
          unique_users: number | null
        }
        Relationships: []
      }
      user_conversations: {
        Row: {
          conversation_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_conversation_participant_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      generate_initial_assistant_message: {
        Args: { quiz_attempt_id: string }
        Returns: string
      }
      get_user_id: {
        Args: { email: string }
        Returns: string
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: string
      }
    }
    Enums: {
      content_type: "text" | "video" | "file" | "quiz" | "assignment"
      module_content_type: "text" | "video" | "image"
      user_role: "admin" | "instructor" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      content_type: ["text", "video", "file", "quiz", "assignment"],
      module_content_type: ["text", "video", "image"],
      user_role: ["admin", "instructor", "user"],
    },
  },
} as const

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
          max_tokens: number | null
          model: string | null
          response: string | null
          sender_type: string
          stream: boolean | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          max_tokens?: number | null
          model?: string | null
          response?: string | null
          sender_type: string
          stream?: boolean | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          max_tokens?: number | null
          model?: string | null
          response?: string | null
          sender_type?: string
          stream?: boolean | null
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
      availability_slots: {
        Row: {
          created_at: string
          id: string
          is_available: boolean
          time_slot: string
          user_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_available?: boolean
          time_slot: string
          user_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          id?: string
          is_available?: boolean
          time_slot?: string
          user_id?: string
          weekday?: number
        }
        Relationships: []
      }
      career_pathway_answers: {
        Row: {
          answer: string
          created_at: string
          id: string
          question: string
          session_id: string
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question: string
          session_id: string
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question?: string
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      career_pathway_results: {
        Row: {
          action_plan: Json | null
          created_at: string
          id: string
          report: Json | null
          session_id: string
          user_id: string
        }
        Insert: {
          action_plan?: Json | null
          created_at?: string
          id?: string
          report?: Json | null
          session_id: string
          user_id: string
        }
        Update: {
          action_plan?: Json | null
          created_at?: string
          id?: string
          report?: Json | null
          session_id?: string
          user_id?: string
        }
        Relationships: []
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
      code_attempts: {
        Row: {
          ai_review: Json | null
          challenge_id: string
          code: string
          created_at: string
          duration: number | null
          id: string
          language: string
          passed_tests: boolean | null
          user_id: string
        }
        Insert: {
          ai_review?: Json | null
          challenge_id: string
          code: string
          created_at?: string
          duration?: number | null
          id?: string
          language: string
          passed_tests?: boolean | null
          user_id: string
        }
        Update: {
          ai_review?: Json | null
          challenge_id?: string
          code?: string
          created_at?: string
          duration?: number | null
          id?: string
          language?: string
          passed_tests?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_attempts_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "code_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      code_challenges: {
        Row: {
          created_at: string
          difficulty: string
          id: string
          prompt: string
          test_cases: Json
          title: string
          topic_tags: string[] | null
        }
        Insert: {
          created_at?: string
          difficulty: string
          id?: string
          prompt: string
          test_cases?: Json
          title: string
          topic_tags?: string[] | null
        }
        Update: {
          created_at?: string
          difficulty?: string
          id?: string
          prompt?: string
          test_cases?: Json
          title?: string
          topic_tags?: string[] | null
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
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "user_conversation_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "user_conversations"
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
      form_submissions: {
        Row: {
          created_at: string
          draft: boolean
          form_id: string | null
          id: string
          submission_data: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          draft?: boolean
          form_id?: string | null
          id?: string
          submission_data: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          draft?: boolean
          form_id?: string | null
          id?: string
          submission_data?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          created_at: string
          deadline: string | null
          description: string | null
          form_data: Json | null
          form_link: string
          form_structure: Json | null
          id: string
          slug: string | null
          status: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          description?: string | null
          form_data?: Json | null
          form_link: string
          form_structure?: Json | null
          id?: string
          slug?: string | null
          status?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          description?: string | null
          form_data?: Json | null
          form_link?: string
          form_structure?: Json | null
          id?: string
          slug?: string | null
          status?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      forums: {
        Row: {
          allow_create_threads: boolean
          allow_email_subscription: boolean
          course_id: string
          created_at: string
          description: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          allow_create_threads?: boolean
          allow_email_subscription?: boolean
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          allow_create_threads?: boolean
          allow_email_subscription?: boolean
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forums_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      job_descriptions: {
        Row: {
          created_at: string
          id: string
          parsed_fields: Json
          raw_text: string
          source_type: string
          source_url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parsed_fields?: Json
          raw_text: string
          source_type: string
          source_url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parsed_fields?: Json
          raw_text?: string
          source_type?: string
          source_url?: string | null
          user_id?: string
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
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "user_conversation_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "user_conversations"
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
      mock_sessions: {
        Row: {
          created_at: string
          id: string
          role1: string
          role2: string
          session_time: string
          status: string
          study_guide_id: string | null
          type: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role1: string
          role2: string
          session_time: string
          status: string
          study_guide_id?: string | null
          type: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role1?: string
          role2?: string
          session_time?: string
          status?: string
          study_guide_id?: string | null
          type?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_sessions_study_guide_id_fkey"
            columns: ["study_guide_id"]
            isOneToOne: false
            referencedRelation: "study_guides"
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
      peer_reviews: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          reviewee_id: string
          reviewer_id: string
          rubric_scores: Json
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          reviewee_id: string
          reviewer_id: string
          rubric_scores?: Json
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          reviewee_id?: string
          reviewer_id?: string
          rubric_scores?: Json
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "peer_reviews_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mock_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio: {
        Row: {
          created_at: string
          current_role: string | null
          hobbies: string | null
          id: string
          interests: string | null
          recommendations: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          current_role?: string | null
          hobbies?: string | null
          id?: string
          interests?: string | null
          recommendations?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          current_role?: string | null
          hobbies?: string | null
          id?: string
          interests?: string | null
          recommendations?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      portfolio_projects: {
        Row: {
          created_at: string | null
          description: string | null
          effort_level: string | null
          id: string
          impact: string | null
          required_skills: string[] | null
          roadmap: Json | null
          status: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          effort_level?: string | null
          id?: string
          impact?: string | null
          required_skills?: string[] | null
          roadmap?: Json | null
          status?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          effort_level?: string | null
          id?: string
          impact?: string | null
          required_skills?: string[] | null
          roadmap?: Json | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          thread_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          thread_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          thread_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          first_name: string | null
          id: string
          last_name: string | null
          notification_settings: Json | null
          preferences: Json | null
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
          notification_settings?: Json | null
          preferences?: Json | null
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
          notification_settings?: Json | null
          preferences?: Json | null
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
      project_status: {
        Row: {
          project_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          project_id: string
          status: string
          updated_at?: string | null
        }
        Update: {
          project_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_status_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "portfolio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          career_area: string | null
          category: string
          created_at: string | null
          created_at_est: string | null
          created_by: string | null
          deadline: string | null
          favorite_count: number | null
          full_text: string | null
          id: string
          in_reply_to_screen_name: string | null
          lang: string | null
          linkedin_url: string | null
          predicted_career_labels: string | null
          predicted_resource_labels: string | null
          resource_link: string | null
          resource_type: string | null
          retweet_count: number | null
          source: string | null
          tweet_id: string | null
          tweet_likes: number | null
          tweet_retweets: number | null
          tweet_url: string | null
          updated_at: string | null
          user_mentions: Json | null
        }
        Insert: {
          career_area?: string | null
          category?: string
          created_at?: string | null
          created_at_est?: string | null
          created_by?: string | null
          deadline?: string | null
          favorite_count?: number | null
          full_text?: string | null
          id?: string
          in_reply_to_screen_name?: string | null
          lang?: string | null
          linkedin_url?: string | null
          predicted_career_labels?: string | null
          predicted_resource_labels?: string | null
          resource_link?: string | null
          resource_type?: string | null
          retweet_count?: number | null
          source?: string | null
          tweet_id?: string | null
          tweet_likes?: number | null
          tweet_retweets?: number | null
          tweet_url?: string | null
          updated_at?: string | null
          user_mentions?: Json | null
        }
        Update: {
          career_area?: string | null
          category?: string
          created_at?: string | null
          created_at_est?: string | null
          created_by?: string | null
          deadline?: string | null
          favorite_count?: number | null
          full_text?: string | null
          id?: string
          in_reply_to_screen_name?: string | null
          lang?: string | null
          linkedin_url?: string | null
          predicted_career_labels?: string | null
          predicted_resource_labels?: string | null
          resource_link?: string | null
          resource_type?: string | null
          retweet_count?: number | null
          source?: string | null
          tweet_id?: string | null
          tweet_likes?: number | null
          tweet_retweets?: number | null
          tweet_url?: string | null
          updated_at?: string | null
          user_mentions?: Json | null
        }
        Relationships: []
      }
      resumes: {
        Row: {
          analysis: Json | null
          analysis_complete: boolean | null
          analyzed_at: string | null
          career_alignment_score: number | null
          career_goals: string | null
          enhanced_analysis: Json | null
          fallback_analysis: Json | null
          file_path: string
          id: string
          improvements_complete: boolean | null
          resume_roast: string | null
          sentences: Json | null
          sentences_updated_at: string | null
          target_role: string | null
          text: string | null
          updated_at: string | null
          uploaded_at: string | null
          user_id: string | null
        }
        Insert: {
          analysis?: Json | null
          analysis_complete?: boolean | null
          analyzed_at?: string | null
          career_alignment_score?: number | null
          career_goals?: string | null
          enhanced_analysis?: Json | null
          fallback_analysis?: Json | null
          file_path: string
          id?: string
          improvements_complete?: boolean | null
          resume_roast?: string | null
          sentences?: Json | null
          sentences_updated_at?: string | null
          target_role?: string | null
          text?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          user_id?: string | null
        }
        Update: {
          analysis?: Json | null
          analysis_complete?: boolean | null
          analyzed_at?: string | null
          career_alignment_score?: number | null
          career_goals?: string | null
          enhanced_analysis?: Json | null
          fallback_analysis?: Json | null
          file_path?: string
          id?: string
          improvements_complete?: boolean | null
          resume_roast?: string | null
          sentences?: Json | null
          sentences_updated_at?: string | null
          target_role?: string | null
          text?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      star_responses: {
        Row: {
          action: string | null
          ai_feedback: Json | null
          id: string
          question_id: string
          result: string | null
          situation: string | null
          submitted_at: string
          task: string | null
          user_id: string
        }
        Insert: {
          action?: string | null
          ai_feedback?: Json | null
          id?: string
          question_id: string
          result?: string | null
          situation?: string | null
          submitted_at?: string
          task?: string | null
          user_id: string
        }
        Update: {
          action?: string | null
          ai_feedback?: Json | null
          id?: string
          question_id?: string
          result?: string | null
          situation?: string | null
          submitted_at?: string
          task?: string | null
          user_id?: string
        }
        Relationships: []
      }
      study_guides: {
        Row: {
          competencies: Json
          created_at: string
          id: string
          job_description_id: string
          questions: Json
          technical_checklist: Json
          user_id: string
        }
        Insert: {
          competencies?: Json
          created_at?: string
          id?: string
          job_description_id: string
          questions?: Json
          technical_checklist?: Json
          user_id: string
        }
        Update: {
          competencies?: Json
          created_at?: string
          id?: string
          job_description_id?: string
          questions?: Json
          technical_checklist?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_guides_job_description_id_fkey"
            columns: ["job_description_id"]
            isOneToOne: false
            referencedRelation: "job_descriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_drafts: {
        Row: {
          form_data: Json
          form_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          form_data: Json
          form_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          form_data?: Json
          form_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_drafts_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_read_status: {
        Row: {
          id: string
          last_read_at: string
          thread_id: string
          user_id: string
        }
        Insert: {
          id?: string
          last_read_at?: string
          thread_id: string
          user_id: string
        }
        Update: {
          id?: string
          last_read_at?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_read_status_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_subscriptions: {
        Row: {
          created_at: string
          forum_id: string | null
          id: string
          thread_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          forum_id?: string | null
          id?: string
          thread_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          forum_id?: string | null
          id?: string
          thread_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_subscriptions_forum_id_fkey"
            columns: ["forum_id"]
            isOneToOne: false
            referencedRelation: "forums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_subscriptions_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          created_at: string
          forum_id: string
          id: string
          is_locked: boolean
          is_pinned: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          forum_id: string
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          forum_id?: string
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "threads_forum_id_fkey"
            columns: ["forum_id"]
            isOneToOne: false
            referencedRelation: "forums"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          created_at: string
          feedback_category: string | null
          feedback_text: string | null
          id: string
          is_useful: boolean
          page_path: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          feedback_category?: string | null
          feedback_text?: string | null
          id?: string
          is_useful: boolean
          page_path: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          feedback_category?: string | null
          feedback_text?: string | null
          id?: string
          is_useful?: boolean
          page_path?: string
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
      user_conversation_view: {
        Row: {
          archived: boolean | null
          created_at: string | null
          created_by: string | null
          id: string | null
          is_group: boolean | null
          subject: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_conversation_participant_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_conversations: {
        Row: {
          archived: boolean | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string | null
          is_group: boolean | null
          subject: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      delete_all_user_resumes: {
        Args: { user_id_param: string }
        Returns: undefined
      }
      delete_resume_records: {
        Args: { user_id_param: string; problem_id_param: string }
        Returns: undefined
      }
      generate_initial_assistant_message: {
        Args: { quiz_attempt_id: string }
        Returns: string
      }
      get_user_conversations: {
        Args: { user_id_param: string }
        Returns: {
          id: string
          subject: string
          is_group: boolean
          archived: boolean
          created_at: string
          updated_at: string
          created_by: string
          participants: Json
        }[]
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

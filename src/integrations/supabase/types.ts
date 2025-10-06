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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string | null
          id: string
          justification: string | null
          target_record_id: string | null
          target_table: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string | null
          id?: string
          justification?: string | null
          target_record_id?: string | null
          target_table?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string | null
          id?: string
          justification?: string | null
          target_record_id?: string | null
          target_table?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      assesment_rubric: {
        Row: {
          assessment_area: string
          created_at: string | null
          criteria_description: string
          id: string
          performance_level: string
          score: number
          updated_at: string | null
        }
        Insert: {
          assessment_area: string
          created_at?: string | null
          criteria_description: string
          id?: string
          performance_level: string
          score: number
          updated_at?: string | null
        }
        Update: {
          assessment_area?: string
          created_at?: string | null
          criteria_description?: string
          id?: string
          performance_level?: string
          score?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_assessment_rubric_area"
            columns: ["assessment_area"]
            isOneToOne: false
            referencedRelation: "assessment_areas"
            referencedColumns: ["name"]
          },
        ]
      }
      assessment_areas: {
        Row: {
          created_at: string | null
          definition: string
          key_focus_areas: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          definition: string
          key_focus_areas: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          definition?: string
          key_focus_areas?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      assessment_questions: {
        Row: {
          assessment_area: string
          created_at: string | null
          id: string
          question_id: string
          question_text: string
          question_type: string | null
          updated_at: string | null
        }
        Insert: {
          assessment_area: string
          created_at?: string | null
          id?: string
          question_id?: string
          question_text: string
          question_type?: string | null
          updated_at?: string | null
        }
        Update: {
          assessment_area?: string
          created_at?: string | null
          id?: string
          question_id?: string
          question_text?: string
          question_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_assessment_area"
            columns: ["assessment_area"]
            isOneToOne: false
            referencedRelation: "assessment_areas"
            referencedColumns: ["name"]
          },
        ]
      }
      assessment_sessions: {
        Row: {
          end_time: string | null
          id: string
          overall_score: number | null
          session_name: string | null
          start_time: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          end_time?: string | null
          id?: string
          overall_score?: number | null
          session_name?: string | null
          start_time?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          end_time?: string | null
          id?: string
          overall_score?: number | null
          session_name?: string | null
          start_time?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      assignment_progress: {
        Row: {
          completed: boolean | null
          content_block_id: string
          created_at: string | null
          feedback: string | null
          grade: number | null
          id: string
          submission_data: Json | null
          submitted_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          content_block_id: string
          created_at?: string | null
          feedback?: string | null
          grade?: number | null
          id?: string
          submission_data?: Json | null
          submitted_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          content_block_id?: string
          created_at?: string | null
          feedback?: string | null
          grade?: number | null
          id?: string
          submission_data?: Json | null
          submitted_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      assignment_rubrics: {
        Row: {
          assignment_id: string
          created_at: string | null
          id: string
          rubric_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string | null
          id?: string
          rubric_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string | null
          id?: string
          rubric_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_rubrics_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_rubrics_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          assignment_id: string
          attempt: number | null
          body: string | null
          created_at: string | null
          excused: boolean | null
          grade: number | null
          graded_at: string | null
          grader_comments: string | null
          id: string
          late: boolean | null
          missing: boolean | null
          score: number | null
          submission_type: string | null
          submitted_at: string | null
          updated_at: string | null
          url: string | null
          user_id: string
          workflow_state: string | null
        }
        Insert: {
          assignment_id: string
          attempt?: number | null
          body?: string | null
          created_at?: string | null
          excused?: boolean | null
          grade?: number | null
          graded_at?: string | null
          grader_comments?: string | null
          id?: string
          late?: boolean | null
          missing?: boolean | null
          score?: number | null
          submission_type?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          url?: string | null
          user_id: string
          workflow_state?: string | null
        }
        Update: {
          assignment_id?: string
          attempt?: number | null
          body?: string | null
          created_at?: string | null
          excused?: boolean | null
          grade?: number | null
          graded_at?: string | null
          grader_comments?: string | null
          id?: string
          late?: boolean | null
          missing?: boolean | null
          score?: number | null
          submission_type?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          url?: string | null
          user_id?: string
          workflow_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          content: string | null
          content_item_id: string | null
          course_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          instructions: string | null
          is_published: boolean | null
          module_id: string | null
          points: number | null
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          content_item_id?: string | null
          course_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          is_published?: boolean | null
          module_id?: string | null
          points?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          content_item_id?: string | null
          course_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          is_published?: boolean | null
          module_id?: string | null
          points?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
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
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      blog_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      blog_post_tags: {
        Row: {
          blog_post_id: string | null
          created_at: string | null
          id: string
          tag_name: string
        }
        Insert: {
          blog_post_id?: string | null
          created_at?: string | null
          id?: string
          tag_name: string
        }
        Update: {
          blog_post_id?: string | null
          created_at?: string | null
          id?: string
          tag_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_tags_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_views: {
        Row: {
          created_at: string | null
          id: string
          post_id: string | null
          post_slug: string
          view_date: string | null
          view_duration: number | null
          visitor_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          post_slug: string
          view_date?: string | null
          view_duration?: number | null
          visitor_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          post_slug?: string
          view_date?: string | null
          view_duration?: number | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string
          category_id: string | null
          content: string
          created_at: string | null
          excerpt: string
          featured: boolean | null
          id: string
          image_url: string | null
          published_at: string | null
          read_time: number | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          author_id: string
          category_id?: string | null
          content: string
          created_at?: string | null
          excerpt: string
          featured?: boolean | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          read_time?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          author_id?: string
          category_id?: string | null
          content?: string
          created_at?: string | null
          excerpt?: string
          featured?: boolean | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          read_time?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_blog_posts_category"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_settings: {
        Row: {
          allow_comments: boolean | null
          auto_generate_excerpts: boolean | null
          blog_description: string | null
          blog_title: string
          blog_url: string | null
          created_at: string | null
          default_meta_description: string | null
          default_meta_keywords: string | null
          default_meta_title: string | null
          default_post_status: string | null
          email_notifications: boolean | null
          enable_analytics: boolean | null
          google_analytics_id: string | null
          google_tag_manager_id: string | null
          id: string
          moderate_comments: boolean | null
          notification_email: string | null
          posts_per_page: number | null
          series_description: string | null
          series_featured: boolean | null
          series_title: string | null
          series_url: string | null
          site_favicon_url: string | null
          site_logo_url: string | null
          site_meta_description: string | null
          site_meta_keywords: string | null
          site_meta_title: string | null
          social_sharing: boolean | null
          updated_at: string | null
        }
        Insert: {
          allow_comments?: boolean | null
          auto_generate_excerpts?: boolean | null
          blog_description?: string | null
          blog_title?: string
          blog_url?: string | null
          created_at?: string | null
          default_meta_description?: string | null
          default_meta_keywords?: string | null
          default_meta_title?: string | null
          default_post_status?: string | null
          email_notifications?: boolean | null
          enable_analytics?: boolean | null
          google_analytics_id?: string | null
          google_tag_manager_id?: string | null
          id?: string
          moderate_comments?: boolean | null
          notification_email?: string | null
          posts_per_page?: number | null
          series_description?: string | null
          series_featured?: boolean | null
          series_title?: string | null
          series_url?: string | null
          site_favicon_url?: string | null
          site_logo_url?: string | null
          site_meta_description?: string | null
          site_meta_keywords?: string | null
          site_meta_title?: string | null
          social_sharing?: boolean | null
          updated_at?: string | null
        }
        Update: {
          allow_comments?: boolean | null
          auto_generate_excerpts?: boolean | null
          blog_description?: string | null
          blog_title?: string
          blog_url?: string | null
          created_at?: string | null
          default_meta_description?: string | null
          default_meta_keywords?: string | null
          default_meta_title?: string | null
          default_post_status?: string | null
          email_notifications?: boolean | null
          enable_analytics?: boolean | null
          google_analytics_id?: string | null
          google_tag_manager_id?: string | null
          id?: string
          moderate_comments?: boolean | null
          notification_email?: string | null
          posts_per_page?: number | null
          series_description?: string | null
          series_featured?: boolean | null
          series_title?: string | null
          series_url?: string | null
          site_favicon_url?: string | null
          site_logo_url?: string | null
          site_meta_description?: string | null
          site_meta_keywords?: string | null
          site_meta_title?: string | null
          social_sharing?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      career_pathway_answers: {
        Row: {
          answer: string
          created_at: string
          id: string
          is_reset: boolean | null
          question: string
          session_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          is_reset?: boolean | null
          question: string
          session_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          is_reset?: boolean | null
          question?: string
          session_id?: string
          updated_at?: string | null
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
      certificates: {
        Row: {
          certificate_data: Json
          certificate_type: string
          course_id: string
          id: string
          issued_at: string | null
          user_id: string
          verification_code: string
        }
        Insert: {
          certificate_data?: Json
          certificate_type?: string
          course_id: string
          id?: string
          issued_at?: string | null
          user_id: string
          verification_code: string
        }
        Update: {
          certificate_data?: Json
          certificate_type?: string
          course_id?: string
          id?: string
          issued_at?: string | null
          user_id?: string
          verification_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
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
      content_item_progressions: {
        Row: {
          content_item_id: string
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
          workflow_state: string | null
        }
        Insert: {
          content_item_id: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
          workflow_state?: string | null
        }
        Update: {
          content_item_id?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
          workflow_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_item_progressions_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          content: string | null
          course_id: string
          created_at: string | null
          created_by: string | null
          id: string
          module_id: string | null
          position: number
          published: boolean | null
          settings: Json | null
          title: string
          type: Database["public"]["Enums"]["content_item_type"]
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          course_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          module_id?: string | null
          position?: number
          published?: boolean | null
          settings?: Json | null
          title: string
          type: Database["public"]["Enums"]["content_item_type"]
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          course_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          module_id?: string | null
          position?: number
          published?: boolean | null
          settings?: Json | null
          title?: string
          type?: Database["public"]["Enums"]["content_item_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_items_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          added_at: string | null
          archived: boolean | null
          conversation_id: string | null
          deleted_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          added_at?: string | null
          archived?: boolean | null
          conversation_id?: string | null
          deleted_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          added_at?: string | null
          archived?: boolean | null
          conversation_id?: string | null
          deleted_at?: string | null
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
      course_instructors: {
        Row: {
          course_id: string | null
          created_at: string | null
          id: string
          role: string | null
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          id?: string
          role?: string | null
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_instructors_course_id_fkey"
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
          duration: number | null
          enrollment_count: number | null
          enrollment_status: string | null
          id: string
          image_url: string | null
          instructor_id: string | null
          level: string
          published: boolean | null
          status: string | null
          tags: string[] | null
          thumbnail: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          duration?: number | null
          enrollment_count?: number | null
          enrollment_status?: string | null
          id?: string
          image_url?: string | null
          instructor_id?: string | null
          level: string
          published?: boolean | null
          status?: string | null
          tags?: string[] | null
          thumbnail?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          duration?: number | null
          enrollment_count?: number | null
          enrollment_status?: string | null
          id?: string
          image_url?: string | null
          instructor_id?: string | null
          level?: string
          published?: boolean | null
          status?: string | null
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
      debug_token_attempts: {
        Row: {
          attempt_time: string
          id: string
          ip_address: unknown | null
          success: boolean
          user_id: string | null
        }
        Insert: {
          attempt_time?: string
          id?: string
          ip_address?: unknown | null
          success?: boolean
          user_id?: string | null
        }
        Update: {
          attempt_time?: string
          id?: string
          ip_address?: unknown | null
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
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
          {
            foreignKeyName: "fk_event_registrations_event_id"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_registrations_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          featured: boolean
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
          featured?: boolean
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
          featured?: boolean
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
      lesson_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          completion_percentage: number | null
          id: string
          last_accessed_at: string | null
          lesson_id: string
          started_at: string | null
          time_spent: number | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          completion_percentage?: number | null
          id?: string
          last_accessed_at?: string | null
          lesson_id: string
          started_at?: string | null
          time_spent?: number | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          completion_percentage?: number | null
          id?: string
          last_accessed_at?: string | null
          lesson_id?: string
          started_at?: string | null
          time_spent?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          completion_criteria: Json | null
          completion_required: boolean | null
          content: string
          content_blocks_count: number | null
          created_at: string | null
          description: string
          duration: string | null
          estimated_duration: number | null
          id: string
          module_id: string | null
          order_num: number
          title: string
          updated_at: string | null
        }
        Insert: {
          completion_criteria?: Json | null
          completion_required?: boolean | null
          content: string
          content_blocks_count?: number | null
          created_at?: string | null
          description: string
          duration?: string | null
          estimated_duration?: number | null
          id?: string
          module_id?: string | null
          order_num: number
          title: string
          updated_at?: string | null
        }
        Update: {
          completion_criteria?: Json | null
          completion_required?: boolean | null
          content?: string
          content_blocks_count?: number | null
          created_at?: string | null
          description?: string
          duration?: string | null
          estimated_duration?: number | null
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
      linkedin_posts: {
        Row: {
          author_display_name: string | null
          author_username: string
          comment_count: number | null
          content: string
          created_at: string
          id: string
          like_count: number | null
          media_urls: string[] | null
          post_id: string
          post_url: string | null
          posted_at: string
          scraped_at: string
          share_count: number | null
          updated_at: string
        }
        Insert: {
          author_display_name?: string | null
          author_username?: string
          comment_count?: number | null
          content: string
          created_at?: string
          id?: string
          like_count?: number | null
          media_urls?: string[] | null
          post_id: string
          post_url?: string | null
          posted_at: string
          scraped_at?: string
          share_count?: number | null
          updated_at?: string
        }
        Update: {
          author_display_name?: string | null
          author_username?: string
          comment_count?: number | null
          content?: string
          created_at?: string
          id?: string
          like_count?: number | null
          media_urls?: string[] | null
          post_id?: string
          post_url?: string | null
          posted_at?: string
          scraped_at?: string
          share_count?: number | null
          updated_at?: string
        }
        Relationships: []
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
          block_type: string | null
          completion_required: boolean | null
          content: string
          created_at: string | null
          duration: number | null
          file_path: string | null
          file_size: number | null
          file_type: string | null
          id: string
          is_interactive: boolean | null
          metadata: Json | null
          module_id: string | null
          position: number
          thumbnail_url: string | null
          type: Database["public"]["Enums"]["module_content_type"]
          updated_at: string | null
          uploaded_by: string
        }
        Insert: {
          block_type?: string | null
          completion_required?: boolean | null
          content: string
          created_at?: string | null
          duration?: number | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_interactive?: boolean | null
          metadata?: Json | null
          module_id?: string | null
          position?: number
          thumbnail_url?: string | null
          type: Database["public"]["Enums"]["module_content_type"]
          updated_at?: string | null
          uploaded_by: string
        }
        Update: {
          block_type?: string | null
          completion_required?: boolean | null
          content?: string
          created_at?: string | null
          duration?: number | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_interactive?: boolean | null
          metadata?: Json | null
          module_id?: string | null
          position?: number
          thumbnail_url?: string | null
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
      module_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          completion_percentage: number | null
          id: string
          last_accessed_at: string | null
          module_id: string
          started_at: string | null
          time_spent: number | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          completion_percentage?: number | null
          id?: string
          last_accessed_at?: string | null
          module_id: string
          started_at?: string | null
          time_spent?: number | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          completion_percentage?: number | null
          id?: string
          last_accessed_at?: string | null
          module_id?: string
          started_at?: string | null
          time_spent?: number | null
          user_id?: string
        }
        Relationships: []
      }
      module_progressions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_position: number | null
          id: string
          module_id: string
          updated_at: string | null
          user_id: string
          workflow_state: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_position?: number | null
          id?: string
          module_id: string
          updated_at?: string | null
          user_id: string
          workflow_state?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_position?: number | null
          id?: string
          module_id?: string
          updated_at?: string | null
          user_id?: string
          workflow_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_progressions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          completion_requirements: Json | null
          course_id: string | null
          created_at: string | null
          description: string
          id: string
          position: number
          prerequisite_module_ids: string[] | null
          publish_final_grade: boolean | null
          published: boolean | null
          requirements: Json | null
          title: string
          updated_at: string | null
          week: number
        }
        Insert: {
          completion_requirements?: Json | null
          course_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          position: number
          prerequisite_module_ids?: string[] | null
          publish_final_grade?: boolean | null
          published?: boolean | null
          requirements?: Json | null
          title: string
          updated_at?: string | null
          week: number
        }
        Update: {
          completion_requirements?: Json | null
          course_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          position?: number
          prerequisite_module_ids?: string[] | null
          publish_final_grade?: boolean | null
          published?: boolean | null
          requirements?: Json | null
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
      portfolio_page_projects: {
        Row: {
          custom_description: string | null
          display_order: number | null
          id: string
          portfolio_page_id: string | null
          project_id: string | null
        }
        Insert: {
          custom_description?: string | null
          display_order?: number | null
          id?: string
          portfolio_page_id?: string | null
          project_id?: string | null
        }
        Update: {
          custom_description?: string | null
          display_order?: number | null
          id?: string
          portfolio_page_id?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_page_projects_portfolio_page_id_fkey"
            columns: ["portfolio_page_id"]
            isOneToOne: false
            referencedRelation: "portfolio_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_page_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_pages: {
        Row: {
          created_at: string | null
          custom_url: string | null
          description: string | null
          id: string
          is_public: boolean | null
          layout: string | null
          profile_data: Json | null
          theme: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          custom_url?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          layout?: string | null
          profile_data?: Json | null
          theme?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          custom_url?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          layout?: string | null
          profile_data?: Json | null
          theme?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      portfolio_projects: {
        Row: {
          created_at: string | null
          description: string | null
          effort_level: string | null
          github_url: string | null
          id: string
          impact: string | null
          live_url: string | null
          project_images: string[] | null
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
          github_url?: string | null
          id?: string
          impact?: string | null
          live_url?: string | null
          project_images?: string[] | null
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
          github_url?: string | null
          id?: string
          impact?: string | null
          live_url?: string | null
          project_images?: string[] | null
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
          roles: string[] | null
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
          roles?: string[] | null
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
          roles?: string[] | null
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
      question_bank_categories: {
        Row: {
          bank_id: string
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          bank_id: string
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          bank_id?: string
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_categories_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "question_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "question_bank_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank_questions: {
        Row: {
          bank_id: string
          correct_answer: Json | null
          created_at: string | null
          difficulty_level: string | null
          explanation: string | null
          feedback: Json | null
          id: string
          metadata: Json | null
          options: Json | null
          points: number | null
          question_text: string
          question_type: string
          rich_content: Json | null
          success_rate: number | null
          topic_tags: string[] | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          bank_id: string
          correct_answer?: Json | null
          created_at?: string | null
          difficulty_level?: string | null
          explanation?: string | null
          feedback?: Json | null
          id?: string
          metadata?: Json | null
          options?: Json | null
          points?: number | null
          question_text: string
          question_type: string
          rich_content?: Json | null
          success_rate?: number | null
          topic_tags?: string[] | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          bank_id?: string
          correct_answer?: Json | null
          created_at?: string | null
          difficulty_level?: string | null
          explanation?: string | null
          feedback?: Json | null
          id?: string
          metadata?: Json | null
          options?: Json | null
          points?: number | null
          question_text?: string
          question_type?: string
          rich_content?: Json | null
          success_rate?: number | null
          topic_tags?: string[] | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_questions_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "question_banks"
            referencedColumns: ["id"]
          },
        ]
      }
      question_banks: {
        Row: {
          course_id: string
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_shared: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_shared?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_shared?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_banks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_banks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      question_category_links: {
        Row: {
          category_id: string
          question_id: string
        }
        Insert: {
          category_id: string
          question_id: string
        }
        Update: {
          category_id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_category_links_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "question_bank_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_category_links_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question_bank_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempt_questions: {
        Row: {
          attempt_id: string
          created_at: string | null
          id: string
          is_correct: boolean | null
          points_earned: number | null
          question_id: string
          question_order: number
          student_answer: Json | null
          time_spent: number | null
        }
        Insert: {
          attempt_id: string
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          question_id: string
          question_order: number
          student_answer?: Json | null
          time_spent?: number | null
        }
        Update: {
          attempt_id?: string
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          question_id?: string
          question_order?: number
          student_answer?: Json | null
          time_spent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempt_questions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempt_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question_bank_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json
          completed_at: string | null
          created_at: string | null
          id: string
          quiz_id: string
          score: number
          time_taken: number | null
          user_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          created_at?: string | null
          id?: string
          quiz_id: string
          score: number
          time_taken?: number | null
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          created_at?: string | null
          id?: string
          quiz_id?: string
          score?: number
          time_taken?: number | null
          user_id?: string
        }
        Relationships: []
      }
      quiz_question_pools: {
        Row: {
          bank_id: string
          category_id: string | null
          created_at: string | null
          difficulty_filter: string | null
          id: string
          number_of_questions: number
          points_per_question: number | null
          position: number
          quiz_id: string
          topic_tags_filter: string[] | null
        }
        Insert: {
          bank_id: string
          category_id?: string | null
          created_at?: string | null
          difficulty_filter?: string | null
          id?: string
          number_of_questions: number
          points_per_question?: number | null
          position: number
          quiz_id: string
          topic_tags_filter?: string[] | null
        }
        Update: {
          bank_id?: string
          category_id?: string | null
          created_at?: string | null
          difficulty_filter?: string | null
          id?: string
          number_of_questions?: number
          points_per_question?: number | null
          position?: number
          quiz_id?: string
          topic_tags_filter?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_question_pools_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "question_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_question_pools_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "question_bank_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_question_pools_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_answer: Json | null
          created_at: string | null
          explanation: string | null
          feedback: string | null
          id: string
          options: Json | null
          points: number | null
          position: number
          question_text: string
          question_type: string
          quiz_id: string
        }
        Insert: {
          correct_answer?: Json | null
          created_at?: string | null
          explanation?: string | null
          feedback?: string | null
          id?: string
          options?: Json | null
          points?: number | null
          position?: number
          question_text: string
          question_type?: string
          quiz_id: string
        }
        Update: {
          correct_answer?: Json | null
          created_at?: string | null
          explanation?: string | null
          feedback?: string | null
          id?: string
          options?: Json | null
          points?: number | null
          position?: number
          question_text?: string
          question_type?: string
          quiz_id?: string
        }
        Relationships: []
      }
      quiz_submissions: {
        Row: {
          attempt: number | null
          created_at: string | null
          end_at: string | null
          extra_attempts: number | null
          extra_time: number | null
          finished_at: string | null
          id: string
          kept_score: number | null
          manually_unlocked: boolean | null
          quiz_id: string
          score: number | null
          started_at: string | null
          submission_id: string | null
          time_spent: number | null
          updated_at: string | null
          user_id: string
          workflow_state: string | null
        }
        Insert: {
          attempt?: number | null
          created_at?: string | null
          end_at?: string | null
          extra_attempts?: number | null
          extra_time?: number | null
          finished_at?: string | null
          id?: string
          kept_score?: number | null
          manually_unlocked?: boolean | null
          quiz_id: string
          score?: number | null
          started_at?: string | null
          submission_id?: string | null
          time_spent?: number | null
          updated_at?: string | null
          user_id: string
          workflow_state?: string | null
        }
        Update: {
          attempt?: number | null
          created_at?: string | null
          end_at?: string | null
          extra_attempts?: number | null
          extra_time?: number | null
          finished_at?: string | null
          id?: string
          kept_score?: number | null
          manually_unlocked?: boolean | null
          quiz_id?: string
          score?: number | null
          started_at?: string | null
          submission_id?: string | null
          time_spent?: number | null
          updated_at?: string | null
          user_id?: string
          workflow_state?: string | null
        }
        Relationships: []
      }
      quizzes: {
        Row: {
          allowed_attempts: number | null
          content_item_id: string
          created_at: string | null
          description: string | null
          due_at: string | null
          id: string
          lock_at: string | null
          module_id: string | null
          points_possible: number | null
          quiz_type: string | null
          show_correct_answers: boolean | null
          shuffle_answers: boolean | null
          shuffle_questions: boolean | null
          time_limit: number | null
          title: string
          unlock_at: string | null
          updated_at: string | null
        }
        Insert: {
          allowed_attempts?: number | null
          content_item_id: string
          created_at?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          lock_at?: string | null
          module_id?: string | null
          points_possible?: number | null
          quiz_type?: string | null
          show_correct_answers?: boolean | null
          shuffle_answers?: boolean | null
          shuffle_questions?: boolean | null
          time_limit?: number | null
          title: string
          unlock_at?: string | null
          updated_at?: string | null
        }
        Update: {
          allowed_attempts?: number | null
          content_item_id?: string
          created_at?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          lock_at?: string | null
          module_id?: string | null
          points_possible?: number | null
          quiz_type?: string | null
          show_correct_answers?: boolean | null
          shuffle_answers?: boolean | null
          shuffle_questions?: boolean | null
          time_limit?: number | null
          title?: string
          unlock_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
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
      rubric_criteria: {
        Row: {
          created_at: string | null
          criterion: string
          description: string | null
          id: string
          order_index: number | null
          points: number
          rubric_id: string
        }
        Insert: {
          created_at?: string | null
          criterion: string
          description?: string | null
          id?: string
          order_index?: number | null
          points?: number
          rubric_id: string
        }
        Update: {
          created_at?: string | null
          criterion?: string
          description?: string | null
          id?: string
          order_index?: number | null
          points?: number
          rubric_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rubric_criteria_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      rubrics: {
        Row: {
          course_id: string
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          points_possible: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          points_possible?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          points_possible?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rubrics_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      scrape_metadata: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string | null
          description: string
          event_type: string
          id: string
          ip_address: unknown | null
          metadata: Json | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          event_type: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          event_type?: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      star_responses: {
        Row: {
          action: string | null
          ai_feedback: Json | null
          assessment_area: string | null
          id: string
          is_assessment_question: boolean | null
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
          assessment_area?: string | null
          id?: string
          is_assessment_question?: boolean | null
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
          assessment_area?: string | null
          id?: string
          is_assessment_question?: boolean | null
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
          assessment_areas: Json | null
          competencies: Json
          created_at: string
          id: string
          job_description_id: string
          leadership_areas: Json | null
          questions: Json
          technical_checklist: Json
          user_id: string
        }
        Insert: {
          assessment_areas?: Json | null
          competencies?: Json
          created_at?: string
          id?: string
          job_description_id: string
          leadership_areas?: Json | null
          questions?: Json
          technical_checklist?: Json
          user_id: string
        }
        Update: {
          assessment_areas?: Json | null
          competencies?: Json
          created_at?: string
          id?: string
          job_description_id?: string
          leadership_areas?: Json | null
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
      tweets: {
        Row: {
          author_display_name: string | null
          author_username: string
          content: string
          created_at: string
          id: string
          like_count: number | null
          quote_count: number | null
          reply_count: number | null
          retweet_count: number | null
          scraped_at: string
          tweet_id: string
          tweeted_at: string
          updated_at: string
        }
        Insert: {
          author_display_name?: string | null
          author_username: string
          content: string
          created_at?: string
          id?: string
          like_count?: number | null
          quote_count?: number | null
          reply_count?: number | null
          retweet_count?: number | null
          scraped_at?: string
          tweet_id: string
          tweeted_at: string
          updated_at?: string
        }
        Update: {
          author_display_name?: string | null
          author_username?: string
          content?: string
          created_at?: string
          id?: string
          like_count?: number | null
          quote_count?: number | null
          reply_count?: number | null
          retweet_count?: number | null
          scraped_at?: string
          tweet_id?: string
          tweeted_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_assessments: {
        Row: {
          assessment_area: string
          assessment_date: string | null
          assessor_notes: string | null
          id: string
          performance_level: string | null
          question_id: string
          response: string | null
          score: number | null
          user_id: string
        }
        Insert: {
          assessment_area: string
          assessment_date?: string | null
          assessor_notes?: string | null
          id?: string
          performance_level?: string | null
          question_id: string
          response?: string | null
          score?: number | null
          user_id: string
        }
        Update: {
          assessment_area?: string
          assessment_date?: string | null
          assessor_notes?: string | null
          id?: string
          performance_level?: string | null
          question_id?: string
          response?: string | null
          score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_assessments_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "assessment_questions"
            referencedColumns: ["question_id"]
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
      user_roles: {
        Row: {
          granted_at: string | null
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
      calculate_lesson_completion: {
        Args: { lesson_id_param: string; user_id_param: string }
        Returns: {
          completed: boolean
          completed_blocks: number
          completion_percentage: number
          total_blocks: number
        }[]
      }
      clean_old_security_events: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      delete_all_user_resumes: {
        Args: { user_id_param: string }
        Returns: undefined
      }
      delete_resume_records: {
        Args: { problem_id_param: string; user_id_param: string }
        Returns: undefined
      }
      find_one_on_one_conversation: {
        Args: { user1_id: string; user2_id: string }
        Returns: {
          conversation_id: string
        }[]
      }
      generate_initial_assistant_message: {
        Args: { quiz_attempt_id: string }
        Returns: string
      }
      get_blog_post_with_tags: {
        Args: { post_slug: string }
        Returns: {
          author_id: string
          category_name: string
          content: string
          created_at: string
          excerpt: string
          featured: boolean
          id: string
          image_url: string
          published_at: string
          read_time: number
          seo_description: string
          seo_title: string
          slug: string
          status: string
          tags: string[]
          title: string
          updated_at: string
          view_count: number
        }[]
      }
      get_course_stats: {
        Args: { course_id_param: string }
        Returns: {
          completion_rate: number
          enrollment_count: number
        }[]
      }
      get_user_conversations: {
        Args: { user_id_param: string }
        Returns: {
          archived: boolean
          created_at: string
          created_by: string
          id: string
          is_group: boolean
          participants: Json
          subject: string
          updated_at: string
        }[]
      }
      get_user_conversations_secure: {
        Args: { user_id_param: string }
        Returns: {
          archived: boolean
          created_at: string
          created_by: string
          id: string
          is_group: boolean
          subject: string
          updated_at: string
          user_id: string
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
      get_user_roles: {
        Args: { user_id_param: string }
        Returns: string[]
      }
      get_user_roles_new: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_admin_access: {
        Args: { user_id_param: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { conversation_id_param: string; user_id_param: string }
        Returns: boolean
      }
      is_course_instructor: {
        Args: { course_id_param: string; user_id_param: string }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_new_values?: Json
          p_old_values?: Json
          p_record_id?: string
          p_table_name: string
          p_user_id: string
        }
        Returns: undefined
      }
      log_security_event: {
        Args: {
          p_description: string
          p_event_type: string
          p_metadata?: Json
          p_severity: string
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "student" | "instructor" | "admin"
      content_item_type:
        | "page"
        | "assignment"
        | "quiz"
        | "discussion"
        | "external_url"
        | "external_tool"
      content_type: "text" | "video" | "file" | "quiz" | "assignment"
      module_content_type: "text" | "video" | "image"
      user_role: "admin" | "instructor" | "user"
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
      app_role: ["student", "instructor", "admin"],
      content_item_type: [
        "page",
        "assignment",
        "quiz",
        "discussion",
        "external_url",
        "external_tool",
      ],
      content_type: ["text", "video", "file", "quiz", "assignment"],
      module_content_type: ["text", "video", "image"],
      user_role: ["admin", "instructor", "user"],
    },
  },
} as const

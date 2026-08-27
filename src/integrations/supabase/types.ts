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
      action_plan_progress: {
        Row: {
          completed: boolean
          id: string
          milestone_index: number
          milestone_text: string
          timeframe: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          id?: string
          milestone_index: number
          milestone_text?: string
          timeframe: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          id?: string
          milestone_index?: number
          milestone_text?: string
          timeframe?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
          rubric_scores: Json | null
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
          rubric_scores?: Json | null
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
          rubric_scores?: Json | null
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
          {
            foreignKeyName: "assignment_submissions_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          allowed_file_extensions: string[] | null
          anonymous_grading: boolean | null
          content: string | null
          content_item_id: string | null
          course_id: string
          created_at: string
          description: string | null
          due_date: string | null
          grading_type: string | null
          id: string
          instructions: string | null
          is_published: boolean | null
          late_policy: Json | null
          max_attempts: number | null
          module_id: string | null
          peer_review_due_date: string | null
          peer_review_enabled: boolean | null
          points: number | null
          submission_types: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          allowed_file_extensions?: string[] | null
          anonymous_grading?: boolean | null
          content?: string | null
          content_item_id?: string | null
          course_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          grading_type?: string | null
          id?: string
          instructions?: string | null
          is_published?: boolean | null
          late_policy?: Json | null
          max_attempts?: number | null
          module_id?: string | null
          peer_review_due_date?: string | null
          peer_review_enabled?: boolean | null
          points?: number | null
          submission_types?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          allowed_file_extensions?: string[] | null
          anonymous_grading?: boolean | null
          content?: string | null
          content_item_id?: string | null
          course_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          grading_type?: string | null
          id?: string
          instructions?: string | null
          is_published?: boolean | null
          late_policy?: Json | null
          max_attempts?: number | null
          module_id?: string | null
          peer_review_due_date?: string | null
          peer_review_enabled?: boolean | null
          points?: number | null
          submission_types?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: true
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "course_statistics"
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
          ip_address: unknown
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
          ip_address?: unknown
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
          ip_address?: unknown
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
      blog_analytics: {
        Row: {
          avg_time_on_page: string | null
          blog_post_id: string | null
          bounce_rate: number | null
          created_at: string | null
          date: string
          id: string
          referrer_data: Json | null
          unique_visitors: number | null
          views: number | null
        }
        Insert: {
          avg_time_on_page?: string | null
          blog_post_id?: string | null
          bounce_rate?: number | null
          created_at?: string | null
          date: string
          id?: string
          referrer_data?: Json | null
          unique_visitors?: number | null
          views?: number | null
        }
        Update: {
          avg_time_on_page?: string | null
          blog_post_id?: string | null
          bounce_rate?: number | null
          created_at?: string | null
          date?: string
          id?: string
          referrer_data?: Json | null
          unique_visitors?: number | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_analytics_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
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
      blog_comments: {
        Row: {
          author_id: string | null
          blog_post_id: string | null
          content: string
          created_at: string | null
          id: string
          is_approved: boolean | null
          is_spam: boolean | null
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          blog_post_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          is_spam?: boolean | null
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          blog_post_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          is_spam?: boolean | null
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_comments_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "blog_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_media: {
        Row: {
          alt_text: string | null
          author_id: string | null
          caption: string | null
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          height: number | null
          id: string
          metadata: Json | null
          updated_at: string | null
          url: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          author_id?: string | null
          caption?: string | null
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          height?: number | null
          id?: string
          metadata?: Json | null
          updated_at?: string | null
          url: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          author_id?: string | null
          caption?: string | null
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          height?: number | null
          id?: string
          metadata?: Json | null
          updated_at?: string | null
          url?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_media_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_tags: {
        Row: {
          blog_post_id: string | null
          created_at: string | null
          id: string
          tag_id: string | null
          tag_name: string
        }
        Insert: {
          blog_post_id?: string | null
          created_at?: string | null
          id?: string
          tag_id?: string | null
          tag_name: string
        }
        Update: {
          blog_post_id?: string | null
          created_at?: string | null
          id?: string
          tag_id?: string | null
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
          {
            foreignKeyName: "blog_post_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "blog_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_versions: {
        Row: {
          blog_post_id: string | null
          content: string
          created_at: string | null
          created_by: string | null
          excerpt: string | null
          id: string
          title: string
          version_number: number
        }
        Insert: {
          blog_post_id?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          excerpt?: string | null
          id?: string
          title: string
          version_number: number
        }
        Update: {
          blog_post_id?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          excerpt?: string | null
          id?: string
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_versions_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_post_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          allow_comments: boolean | null
          author_id: string
          category_id: string | null
          content: string
          created_at: string | null
          custom_slug: string | null
          excerpt: string
          featured: boolean | null
          id: string
          image_url: string | null
          is_featured: boolean | null
          likes_count: number | null
          meta_description: string | null
          meta_keywords: string | null
          meta_title: string | null
          og_image: string | null
          published_at: string | null
          read_time: number | null
          reading_time: number | null
          scheduled_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string | null
          title: string
          updated_at: string | null
          view_count: number | null
          views_count: number | null
        }
        Insert: {
          allow_comments?: boolean | null
          author_id: string
          category_id?: string | null
          content: string
          created_at?: string | null
          custom_slug?: string | null
          excerpt: string
          featured?: boolean | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          likes_count?: number | null
          meta_description?: string | null
          meta_keywords?: string | null
          meta_title?: string | null
          og_image?: string | null
          published_at?: string | null
          read_time?: number | null
          reading_time?: number | null
          scheduled_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string | null
          title: string
          updated_at?: string | null
          view_count?: number | null
          views_count?: number | null
        }
        Update: {
          allow_comments?: boolean | null
          author_id?: string
          category_id?: string | null
          content?: string
          created_at?: string | null
          custom_slug?: string | null
          excerpt?: string
          featured?: boolean | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          likes_count?: number | null
          meta_description?: string | null
          meta_keywords?: string | null
          meta_title?: string | null
          og_image?: string | null
          published_at?: string | null
          read_time?: number | null
          reading_time?: number | null
          scheduled_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_profiles_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
      blog_tags: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      bls_occupations: {
        Row: {
          annual_mean: number | null
          employment: number | null
          median: number | null
          occupation_title: string
          pct10: number | null
          pct25: number | null
          pct75: number | null
          pct90: number | null
          reference_period: string
          retrieved_at: string
          soc_code: string
          source: string
          source_name: string
          source_url: string
          updated_at: string
        }
        Insert: {
          annual_mean?: number | null
          employment?: number | null
          median?: number | null
          occupation_title: string
          pct10?: number | null
          pct25?: number | null
          pct75?: number | null
          pct90?: number | null
          reference_period?: string
          retrieved_at?: string
          soc_code: string
          source?: string
          source_name?: string
          source_url?: string
          updated_at?: string
        }
        Update: {
          annual_mean?: number | null
          employment?: number | null
          median?: number | null
          occupation_title?: string
          pct10?: number | null
          pct25?: number | null
          pct75?: number | null
          pct90?: number | null
          reference_period?: string
          retrieved_at?: string
          soc_code?: string
          source?: string
          source_name?: string
          source_url?: string
          updated_at?: string
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
          self_reported_experience: string | null
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
          self_reported_experience?: string | null
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
          self_reported_experience?: string | null
          session_id?: string | null
          top_recommended_path?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      career_roles: {
        Row: {
          category: string
          created_at: string
          id: string
          mapping_note: string | null
          requested_title: string | null
          slug: string
          soc_code: string
          source: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          mapping_note?: string | null
          requested_title?: string | null
          slug: string
          soc_code: string
          source?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          mapping_note?: string | null
          requested_title?: string | null
          slug?: string
          soc_code?: string
          source?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_roles_soc_code_fkey"
            columns: ["soc_code"]
            isOneToOne: false
            referencedRelation: "bls_occupations"
            referencedColumns: ["soc_code"]
          },
          {
            foreignKeyName: "career_roles_soc_code_fkey"
            columns: ["soc_code"]
            isOneToOne: false
            referencedRelation: "career_role_wages"
            referencedColumns: ["soc_code"]
          },
        ]
      }
      certificate_verification_attempts: {
        Row: {
          attempted_at: string
          code: string | null
          found: boolean
          id: string
          ip_hash: string
        }
        Insert: {
          attempted_at?: string
          code?: string | null
          found?: boolean
          id?: string
          ip_hash: string
        }
        Update: {
          attempted_at?: string
          code?: string | null
          found?: boolean
          id?: string
          ip_hash?: string
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
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          compare_mode: string
          constraints: Json
          created_at: string
          description: string | null
          detail: string | null
          difficulty: string
          example: string | null
          function_name: string
          hints: Json
          id: string
          language: string
          prompt: string
          runtime: string
          starter_code: string | null
          test_cases: Json
          title: string
          topic_tags: string[] | null
        }
        Insert: {
          compare_mode?: string
          constraints?: Json
          created_at?: string
          description?: string | null
          detail?: string | null
          difficulty: string
          example?: string | null
          function_name?: string
          hints?: Json
          id?: string
          language?: string
          prompt: string
          runtime?: string
          starter_code?: string | null
          test_cases?: Json
          title: string
          topic_tags?: string[] | null
        }
        Update: {
          compare_mode?: string
          constraints?: Json
          created_at?: string
          description?: string | null
          detail?: string | null
          difficulty?: string
          example?: string | null
          function_name?: string
          hints?: Json
          id?: string
          language?: string
          prompt?: string
          runtime?: string
          starter_code?: string | null
          test_cases?: Json
          title?: string
          topic_tags?: string[] | null
        }
        Relationships: []
      }
      content_discussion_upvotes: {
        Row: {
          created_at: string | null
          discussion_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          discussion_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          discussion_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_discussion_upvotes_discussion_id_fkey"
            columns: ["discussion_id"]
            isOneToOne: false
            referencedRelation: "content_discussions"
            referencedColumns: ["id"]
          },
        ]
      }
      content_discussions: {
        Row: {
          comment_text: string
          comment_type: string | null
          content_item_id: string
          created_at: string | null
          edited_at: string | null
          endorsed_at: string | null
          endorsed_by: string | null
          id: string
          instructor_endorsed: boolean | null
          is_edited: boolean | null
          is_hidden: boolean | null
          is_pinned: boolean | null
          is_resolved: boolean | null
          parent_comment_id: string | null
          thread_position: number | null
          timestamp_seconds: number | null
          updated_at: string | null
          upvote_count: number | null
          user_id: string
        }
        Insert: {
          comment_text: string
          comment_type?: string | null
          content_item_id: string
          created_at?: string | null
          edited_at?: string | null
          endorsed_at?: string | null
          endorsed_by?: string | null
          id?: string
          instructor_endorsed?: boolean | null
          is_edited?: boolean | null
          is_hidden?: boolean | null
          is_pinned?: boolean | null
          is_resolved?: boolean | null
          parent_comment_id?: string | null
          thread_position?: number | null
          timestamp_seconds?: number | null
          updated_at?: string | null
          upvote_count?: number | null
          user_id: string
        }
        Update: {
          comment_text?: string
          comment_type?: string | null
          content_item_id?: string
          created_at?: string | null
          edited_at?: string | null
          endorsed_at?: string | null
          endorsed_by?: string | null
          id?: string
          instructor_endorsed?: boolean | null
          is_edited?: boolean | null
          is_hidden?: boolean | null
          is_pinned?: boolean | null
          is_resolved?: boolean | null
          parent_comment_id?: string | null
          thread_position?: number | null
          timestamp_seconds?: number | null
          updated_at?: string | null
          upvote_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_discussions_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_discussions_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "content_discussions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_discussions_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
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
      content_progress: {
        Row: {
          created_at: string | null
          id: string
          last_accessed: string | null
          lesson_id: string
          progress_percentage: number | null
          time_spent: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_accessed?: string | null
          lesson_id: string
          progress_percentage?: number | null
          time_spent?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_accessed?: string | null
          lesson_id?: string
          progress_percentage?: number | null
          time_spent?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          course_id: string | null
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
          course_id?: string | null
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
          course_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_group?: boolean | null
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_announcements: {
        Row: {
          author_id: string | null
          content: string | null
          course_id: string
          created_at: string
          created_by: string | null
          id: string
          is_pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content?: string | null
          course_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string | null
          course_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_announcements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_announcements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_assignments_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_feedback: {
        Row: {
          category: string
          course_id: string | null
          created_at: string
          id: string
          message: string
          path: string
          screenshot_url: string | null
          status: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          category?: string
          course_id?: string | null
          created_at?: string
          id?: string
          message: string
          path: string
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          category?: string
          course_id?: string | null
          created_at?: string
          id?: string
          message?: string
          path?: string
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_feedback_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_feedback_course_id_fkey"
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
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_instructors_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_instructors_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_material_files: {
        Row: {
          bucket: string
          course_id: string
          created_at: string
          folder_id: string | null
          id: string
          mime_type: string | null
          name: string
          size_bytes: number | null
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          bucket?: string
          course_id: string
          created_at?: string
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          bucket?: string
          course_id?: string
          created_at?: string
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_material_files_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_material_files_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_material_files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "course_material_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      course_material_folders: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_material_folders_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_material_folders_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_material_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "course_material_folders"
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
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_wishlists_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      coursera_courses: {
        Row: {
          created_at: string
          curator_note: string | null
          description: string | null
          enrolled: number | null
          estimated_hours: number | null
          format: string
          is_featured: boolean
          languages: string[]
          last_fetched_at: string | null
          last_http_status: number | null
          last_verified_at: string | null
          level: string
          partner: string
          primary_subjects: string[]
          rating: number | null
          reviews: number | null
          skills: string[]
          slug: string
          status: string
          subjects: string[]
          title: string
          top_reviews: Json
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          curator_note?: string | null
          description?: string | null
          enrolled?: number | null
          estimated_hours?: number | null
          format: string
          is_featured?: boolean
          languages?: string[]
          last_fetched_at?: string | null
          last_http_status?: number | null
          last_verified_at?: string | null
          level?: string
          partner: string
          primary_subjects?: string[]
          rating?: number | null
          reviews?: number | null
          skills?: string[]
          slug: string
          status?: string
          subjects?: string[]
          title: string
          top_reviews?: Json
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          curator_note?: string | null
          description?: string | null
          enrolled?: number | null
          estimated_hours?: number | null
          format?: string
          is_featured?: boolean
          languages?: string[]
          last_fetched_at?: string | null
          last_http_status?: number | null
          last_verified_at?: string | null
          level?: string
          partner?: string
          primary_subjects?: string[]
          rating?: number | null
          reviews?: number | null
          skills?: string[]
          slug?: string
          status?: string
          subjects?: string[]
          title?: string
          top_reviews?: Json
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      coursera_crawl_queue: {
        Row: {
          attempts: number
          enqueued_at: string
          last_error: string | null
          processed_at: string | null
          slug: string
          source: string
          state: string
          url: string
        }
        Insert: {
          attempts?: number
          enqueued_at?: string
          last_error?: string | null
          processed_at?: string | null
          slug: string
          source?: string
          state?: string
          url: string
        }
        Update: {
          attempts?: number
          enqueued_at?: string
          last_error?: string | null
          processed_at?: string | null
          slug?: string
          source?: string
          state?: string
          url?: string
        }
        Relationships: []
      }
      coursera_subject_keywords: {
        Row: {
          keyword: string
          subject: string
        }
        Insert: {
          keyword: string
          subject: string
        }
        Update: {
          keyword?: string
          subject?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          category: string
          created_at: string | null
          description: string
          difficulty_level:
            | Database["public"]["Enums"]["course_difficulty"]
            | null
          duration: number | null
          enrollment_count: number | null
          enrollment_status: string | null
          estimated_hours: number | null
          id: string
          image_url: string | null
          instructor_id: string | null
          level: string
          published: boolean | null
          settings: Json
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
          difficulty_level?:
            | Database["public"]["Enums"]["course_difficulty"]
            | null
          duration?: number | null
          enrollment_count?: number | null
          enrollment_status?: string | null
          estimated_hours?: number | null
          id?: string
          image_url?: string | null
          instructor_id?: string | null
          level: string
          published?: boolean | null
          settings?: Json
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
          difficulty_level?:
            | Database["public"]["Enums"]["course_difficulty"]
            | null
          duration?: number | null
          enrollment_count?: number | null
          enrollment_status?: string | null
          estimated_hours?: number | null
          id?: string
          image_url?: string | null
          instructor_id?: string | null
          level?: string
          published?: boolean | null
          settings?: Json
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
      cron_job_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          job_name: string
          response_data: Json | null
          success: boolean
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_name: string
          response_data?: Json | null
          success: boolean
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_name?: string
          response_data?: Json | null
          success?: boolean
        }
        Relationships: []
      }
      debug_token_attempts: {
        Row: {
          attempt_time: string
          id: string
          ip_address: unknown
          success: boolean
          user_id: string | null
        }
        Insert: {
          attempt_time?: string
          id?: string
          ip_address?: unknown
          success?: boolean
          user_id?: string | null
        }
        Update: {
          attempt_time?: string
          id?: string
          ip_address?: unknown
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          calendar_feed_token: string
          completion_status: number | null
          course_id: string | null
          enrolled_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          calendar_feed_token?: string
          completion_status?: number | null
          course_id?: string | null
          enrolled_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          calendar_feed_token?: string
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
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
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
          course_id: string | null
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
          zoom_meeting_id: number | null
          zoom_recurrence: Json | null
          zoom_start_url: string | null
        }
        Insert: {
          calendly_link?: string | null
          capacity?: number | null
          course_id?: string | null
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
          zoom_meeting_id?: number | null
          zoom_recurrence?: Json | null
          zoom_start_url?: string | null
        }
        Update: {
          calendly_link?: string | null
          capacity?: number | null
          course_id?: string | null
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
          zoom_meeting_id?: number | null
          zoom_recurrence?: Json | null
          zoom_start_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forums_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_change_notifications: {
        Row: {
          course_id: string
          created_at: string | null
          delivery_method: string[] | null
          grade_history_id: string
          id: string
          is_read: boolean | null
          message: string | null
          notification_type: string
          read_at: string | null
          student_id: string
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          delivery_method?: string[] | null
          grade_history_id: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          notification_type: string
          read_at?: string | null
          student_id: string
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          delivery_method?: string[] | null
          grade_history_id?: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          notification_type?: string
          read_at?: string | null
          student_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_change_notifications_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_change_notifications_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_change_notifications_grade_history_id_fkey"
            columns: ["grade_history_id"]
            isOneToOne: false
            referencedRelation: "grade_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_change_notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_history: {
        Row: {
          assignment_id: string | null
          change_reason: string | null
          change_type: string
          changed_at: string | null
          changed_by: string
          course_id: string
          created_at: string | null
          grade_id: string
          grading_method: string | null
          id: string
          new_comments: string | null
          new_letter_grade: string | null
          new_percentage: number | null
          new_points_earned: number | null
          new_points_possible: number | null
          previous_comments: string | null
          previous_letter_grade: string | null
          previous_percentage: number | null
          previous_points_earned: number | null
          previous_points_possible: number | null
          quiz_id: string | null
          rubric_data: Json | null
          student_id: string
          submission_id: string | null
        }
        Insert: {
          assignment_id?: string | null
          change_reason?: string | null
          change_type: string
          changed_at?: string | null
          changed_by: string
          course_id: string
          created_at?: string | null
          grade_id: string
          grading_method?: string | null
          id?: string
          new_comments?: string | null
          new_letter_grade?: string | null
          new_percentage?: number | null
          new_points_earned?: number | null
          new_points_possible?: number | null
          previous_comments?: string | null
          previous_letter_grade?: string | null
          previous_percentage?: number | null
          previous_points_earned?: number | null
          previous_points_possible?: number | null
          quiz_id?: string | null
          rubric_data?: Json | null
          student_id: string
          submission_id?: string | null
        }
        Update: {
          assignment_id?: string | null
          change_reason?: string | null
          change_type?: string
          changed_at?: string | null
          changed_by?: string
          course_id?: string
          created_at?: string | null
          grade_id?: string
          grading_method?: string | null
          id?: string
          new_comments?: string | null
          new_letter_grade?: string | null
          new_percentage?: number | null
          new_points_earned?: number | null
          new_points_possible?: number | null
          previous_comments?: string | null
          previous_letter_grade?: string | null
          previous_percentage?: number | null
          previous_points_earned?: number | null
          previous_points_possible?: number | null
          quiz_id?: string | null
          rubric_data?: Json | null
          student_id?: string
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grade_history_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_history_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_history_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_history_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_history_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          assignment_id: string | null
          comments: string | null
          course_id: string
          created_at: string | null
          grade_type: string
          graded_by: string | null
          id: string
          letter_grade: string | null
          percentage: number | null
          points_earned: number | null
          points_possible: number | null
          quiz_id: string | null
          student_id: string
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          assignment_id?: string | null
          comments?: string | null
          course_id: string
          created_at?: string | null
          grade_type: string
          graded_by?: string | null
          id?: string
          letter_grade?: string | null
          percentage?: number | null
          points_earned?: number | null
          points_possible?: number | null
          quiz_id?: string | null
          student_id: string
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          assignment_id?: string | null
          comments?: string | null
          course_id?: string
          created_at?: string | null
          grade_type?: string
          graded_by?: string | null
          id?: string
          letter_grade?: string | null
          percentage?: number | null
          points_earned?: number | null
          points_possible?: number | null
          quiz_id?: string | null
          student_id?: string
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grades_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grading_sessions: {
        Row: {
          assignment_id: string | null
          batch_changes: Json | null
          course_id: string
          created_at: string | null
          ended_at: string | null
          grader_id: string
          grading_criteria: Json | null
          grading_method: string | null
          id: string
          quiz_id: string | null
          session_type: string
          started_at: string | null
          submissions_graded: number | null
          total_submissions: number | null
        }
        Insert: {
          assignment_id?: string | null
          batch_changes?: Json | null
          course_id: string
          created_at?: string | null
          ended_at?: string | null
          grader_id: string
          grading_criteria?: Json | null
          grading_method?: string | null
          id?: string
          quiz_id?: string | null
          session_type: string
          started_at?: string | null
          submissions_graded?: number | null
          total_submissions?: number | null
        }
        Update: {
          assignment_id?: string | null
          batch_changes?: Json | null
          course_id?: string
          created_at?: string | null
          ended_at?: string | null
          grader_id?: string
          grading_criteria?: Json | null
          grading_method?: string | null
          id?: string
          quiz_id?: string | null
          session_type?: string
          started_at?: string | null
          submissions_graded?: number | null
          total_submissions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grading_sessions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grading_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grading_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grading_sessions_grader_id_fkey"
            columns: ["grader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grading_sessions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
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
      lesson_completion_requirements: {
        Row: {
          created_at: string | null
          id: string
          lesson_id: string
          requirement_data: Json | null
          requirement_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lesson_id: string
          requirement_data?: Json | null
          requirement_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lesson_id?: string
          requirement_data?: Json | null
          requirement_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_completion_requirements_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_completions: {
        Row: {
          completed_at: string | null
          completion_method: string | null
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completion_method?: string | null
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completion_method?: string | null
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_completions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          end_time: string | null
          id: string
          meeting_id: string | null
          meeting_url: string | null
          role1: string
          role2: string
          session_time: string
          start_url: string | null
          status: string
          study_guide_id: string | null
          type: string
          user1_id: string
          user2_id: string
          video_platform: string | null
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          id?: string
          meeting_id?: string | null
          meeting_url?: string | null
          role1: string
          role2: string
          session_time: string
          start_url?: string | null
          status: string
          study_guide_id?: string | null
          type: string
          user1_id: string
          user2_id: string
          video_platform?: string | null
        }
        Update: {
          created_at?: string
          end_time?: string | null
          id?: string
          meeting_id?: string | null
          meeting_url?: string | null
          role1?: string
          role2?: string
          session_time?: string
          start_url?: string | null
          status?: string
          study_guide_id?: string | null
          type?: string
          user1_id?: string
          user2_id?: string
          video_platform?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mock_sessions_study_guide_id_fkey"
            columns: ["study_guide_id"]
            isOneToOne: false
            referencedRelation: "study_guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_sessions_user1_id_profiles_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_sessions_user2_id_profiles_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          description?: string
          id?: string
          position: number
          prerequisite_module_ids?: string[] | null
          publish_final_grade?: boolean | null
          published?: boolean | null
          requirements?: Json | null
          title: string
          updated_at?: string | null
          week?: number
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
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      no_show_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reported_user_id: string
          reporter_id: string
          session_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reported_user_id: string
          reporter_id: string
          session_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "no_show_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mock_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_email_log: {
        Row: {
          created_at: string
          error: string | null
          id: string
          notification_id: string | null
          provider_message_id: string | null
          recipient: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          notification_id?: string | null
          provider_message_id?: string | null
          recipient?: string | null
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          notification_id?: string | null
          provider_message_id?: string | null
          recipient?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          course_id: string | null
          created_at: string
          email_digest_sent_at: string | null
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          email_digest_sent_at?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          email_digest_sent_at?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_course_id_fkey"
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
      progress_snapshots: {
        Row: {
          completion_percentage: number
          course_id: string
          created_at: string
          id: string
          snapshot_date: string
          user_id: string
        }
        Insert: {
          completion_percentage?: number
          course_id: string
          created_at?: string
          id?: string
          snapshot_date?: string
          user_id: string
        }
        Update: {
          completion_percentage?: number
          course_id?: string
          created_at?: string
          id?: string
          snapshot_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_snapshots_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_snapshots_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
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
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
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
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
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
          answers: Json | null
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
          answers?: Json | null
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
          answers?: Json | null
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
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_submission_answers: {
        Row: {
          answer_data: Json
          correct: boolean | null
          created_at: string | null
          id: string
          points: number | null
          quiz_question_id: string
          quiz_submission_id: string
          updated_at: string | null
        }
        Insert: {
          answer_data: Json
          correct?: boolean | null
          created_at?: string | null
          id?: string
          points?: number | null
          quiz_question_id: string
          quiz_submission_id: string
          updated_at?: string | null
        }
        Update: {
          answer_data?: Json
          correct?: boolean | null
          created_at?: string | null
          id?: string
          points?: number | null
          quiz_question_id?: string
          quiz_submission_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_submission_answers_quiz_question_id_fkey"
            columns: ["quiz_question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_submission_answers_quiz_submission_id_fkey"
            columns: ["quiz_submission_id"]
            isOneToOne: false
            referencedRelation: "quiz_submissions"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "quiz_submissions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
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
            isOneToOne: true
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
          description: string | null
          id: string
          levels: Json
          order_index: number | null
          points: number
          rubric_id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          levels?: Json
          order_index?: number | null
          points?: number
          rubric_id: string
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          levels?: Json
          order_index?: number | null
          points?: number
          rubric_id?: string
          title?: string
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
            referencedRelation: "course_statistics"
            referencedColumns: ["id"]
          },
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
          ip_address: unknown
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
          ip_address?: unknown
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
          ip_address?: unknown
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
      submission_attachments: {
        Row: {
          content_type: string | null
          created_at: string | null
          filename: string
          id: string
          size: number | null
          submission_id: string
          url: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string | null
          filename: string
          id?: string
          size?: number | null
          submission_id: string
          url: string
        }
        Update: {
          content_type?: string | null
          created_at?: string | null
          filename?: string
          id?: string
          size?: number | null
          submission_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_attachments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "assignment_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          assignment_id: string | null
          attachment_id: string | null
          course_id: string | null
          created_at: string
          details: Json
          filename: string | null
          id: string
          module_id: string | null
          student_id: string | null
          submission_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          assignment_id?: string | null
          attachment_id?: string | null
          course_id?: string | null
          created_at?: string
          details?: Json
          filename?: string | null
          id?: string
          module_id?: string | null
          student_id?: string | null
          submission_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          assignment_id?: string | null
          attachment_id?: string | null
          course_id?: string | null
          created_at?: string
          details?: Json
          filename?: string | null
          id?: string
          module_id?: string | null
          student_id?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_audit_events_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "assignment_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_comments: {
        Row: {
          attachments: Json | null
          author_id: string
          author_type: string
          comment_text: string
          comment_type: string
          created_at: string | null
          deleted_at: string | null
          edit_history: Json | null
          id: string
          is_draft: boolean | null
          is_edited: boolean | null
          is_private: boolean | null
          parent_comment_id: string | null
          rich_content: Json | null
          submission_id: string
          submission_type: string
          thread_position: number | null
          updated_at: string | null
        }
        Insert: {
          attachments?: Json | null
          author_id: string
          author_type: string
          comment_text: string
          comment_type: string
          created_at?: string | null
          deleted_at?: string | null
          edit_history?: Json | null
          id?: string
          is_draft?: boolean | null
          is_edited?: boolean | null
          is_private?: boolean | null
          parent_comment_id?: string | null
          rich_content?: Json | null
          submission_id: string
          submission_type: string
          thread_position?: number | null
          updated_at?: string | null
        }
        Update: {
          attachments?: Json | null
          author_id?: string
          author_type?: string
          comment_text?: string
          comment_type?: string
          created_at?: string | null
          deleted_at?: string | null
          edit_history?: Json | null
          id?: string
          is_draft?: boolean | null
          is_edited?: boolean | null
          is_private?: boolean | null
          parent_comment_id?: string | null
          rich_content?: Json | null
          submission_id?: string
          submission_type?: string
          thread_position?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submission_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "submission_comments"
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
      video_analytics: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          completion_percentage: number | null
          content_item_id: string
          created_at: string | null
          first_watched_at: string | null
          id: string
          last_position: number | null
          last_watched_at: string | null
          pause_count: number | null
          play_count: number | null
          playback_speed: number | null
          seek_count: number | null
          updated_at: string | null
          user_id: string
          video_duration: number | null
          watch_time: number | null
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          completion_percentage?: number | null
          content_item_id: string
          created_at?: string | null
          first_watched_at?: string | null
          id?: string
          last_position?: number | null
          last_watched_at?: string | null
          pause_count?: number | null
          play_count?: number | null
          playback_speed?: number | null
          seek_count?: number | null
          updated_at?: string | null
          user_id: string
          video_duration?: number | null
          watch_time?: number | null
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          completion_percentage?: number | null
          content_item_id?: string
          created_at?: string | null
          first_watched_at?: string | null
          id?: string
          last_position?: number | null
          last_watched_at?: string | null
          pause_count?: number | null
          play_count?: number | null
          playback_speed?: number | null
          seek_count?: number | null
          updated_at?: string | null
          user_id?: string
          video_duration?: number | null
          watch_time?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_analytics_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_analytics_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      audit_db_columns: {
        Row: {
          column_name: string | null
          table_name: string | null
        }
        Relationships: []
      }
      audit_db_functions: {
        Row: {
          args: string | null
          name: string | null
        }
        Relationships: []
      }
      career_role_wages: {
        Row: {
          annual_mean: number | null
          category: string | null
          employment: number | null
          mapping_note: string | null
          median: number | null
          occupation_title: string | null
          pct10: number | null
          pct25: number | null
          pct75: number | null
          pct90: number | null
          reference_period: string | null
          slug: string | null
          soc_code: string | null
          source: string | null
          source_name: string | null
          source_url: string | null
          title: string | null
        }
        Relationships: []
      }
      course_statistics: {
        Row: {
          assignment_count: number | null
          difficulty_level:
            | Database["public"]["Enums"]["course_difficulty"]
            | null
          enrollment_count: number | null
          enrollment_status: string | null
          estimated_hours: number | null
          id: string | null
          lesson_count: number | null
          module_count: number | null
          published: boolean | null
          status: string | null
          title: string | null
        }
        Relationships: []
      }
      coursera_crawl_progress: {
        Row: {
          newest_processed_at: string | null
          oldest_enqueued_at: string | null
          source: string | null
          state: string | null
          urls: number | null
        }
        Relationships: []
      }
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
      admin_user_role_counts: {
        Args: never
        Returns: {
          admins: number
          instructors: number
          students: number
          total: number
        }[]
      }
      audit_invariants: {
        Args: never
        Returns: {
          check_name: string
          violations: number
          why: string
        }[]
      }
      blog_post_authors: {
        Args: never
        Returns: {
          display_name: string
          id: string
        }[]
      }
      calculate_course_difficulty: {
        Args: { course_id_param: string }
        Returns: Database["public"]["Enums"]["course_difficulty"]
      }
      calculate_course_hours: {
        Args: { course_id_param: string }
        Returns: number
      }
      calculate_lesson_completion: {
        Args: { lesson_id_param: string; user_id_param: string }
        Returns: {
          completed: boolean
          completed_blocks: number
          completion_percentage: number
          total_blocks: number
        }[]
      }
      can_access_assignment: {
        Args: { assignment_id: string; viewer_id: string }
        Returns: boolean
      }
      can_access_content_item: {
        Args: { content_item_id: string; viewer_id: string }
        Returns: boolean
      }
      can_access_course_materials: {
        Args: { _course: string; _user: string }
        Returns: boolean
      }
      can_access_module: {
        Args: { module_id: string; viewer_id: string }
        Returns: boolean
      }
      can_access_quiz: {
        Args: { quiz_id: string; viewer_id: string }
        Returns: boolean
      }
      can_access_quiz_question: {
        Args: { question_id: string; viewer_id: string }
        Returns: boolean
      }
      can_access_submission: {
        Args: { submission_id: string; viewer_id: string }
        Returns: boolean
      }
      can_manage_content_item: {
        Args: { target_content_item_id: string; viewer_id: string }
        Returns: boolean
      }
      can_manage_course_content: {
        Args: { target_course_id: string; viewer_id: string }
        Returns: boolean
      }
      can_manage_course_materials: {
        Args: { _course: string; _user: string }
        Returns: boolean
      }
      can_manage_quiz: {
        Args: { target_quiz_id: string; viewer_id: string }
        Returns: boolean
      }
      can_view_profile: {
        Args: { profile_id: string; viewer_id: string }
        Returns: boolean
      }
      check_course_completion: {
        Args: { p_course_id: string; p_student_id: string }
        Returns: boolean
      }
      clean_old_security_events: { Args: never; Returns: undefined }
      course_contacts: {
        Args: { p_course_id: string }
        Returns: {
          avatar_url: string
          first_name: string
          id: string
          last_name: string
          role: string
        }[]
      }
      course_roster_stats: {
        Args: never
        Returns: {
          avg_progress: number
          course_id: string
          enrolled: number
        }[]
      }
      coursera_call_refresh: {
        Args: { p_action: string; p_batch?: number }
        Returns: number
      }
      coursera_kick_refresh: { Args: never; Returns: number }
      coursera_kw_pattern: { Args: { p_keyword: string }; Returns: string }
      coursera_verify_refresh_secret: {
        Args: { p_secret: string }
        Returns: boolean
      }
      courses_shared_by_users: {
        Args: { p_user_ids: string[] }
        Returns: {
          course_id: string
        }[]
      }
      delete_all_user_resumes: {
        Args: { user_id_param: string }
        Returns: undefined
      }
      delete_resume_records: {
        Args: { problem_id_param: string; user_id_param: string }
        Returns: undefined
      }
      finalize_quiz_submission: {
        Args: { p_score: number; p_submission_id: string; p_time_spent: number }
        Returns: Json
      }
      find_available_peers: {
        Args: { p_time_slot: string; p_weekday: number }
        Returns: {
          user_id: string
        }[]
      }
      find_one_on_one_conversation: {
        Args: { user1_id: string; user2_id: string }
        Returns: {
          conversation_id: string
        }[]
      }
      form_submission_counts: {
        Args: never
        Returns: {
          form_id: string
          submission_count: number
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
      get_courses_by_difficulty: {
        Args: { diff_level: Database["public"]["Enums"]["course_difficulty"] }
        Returns: {
          description: string
          difficulty_level: Database["public"]["Enums"]["course_difficulty"]
          enrollment_count: number
          estimated_hours: number
          id: string
          title: string
        }[]
      }
      get_most_discussed_content: {
        Args: { course_id_param: string; limit_count?: number }
        Returns: {
          content_item_id: string
          content_title: string
          discussion_count: number
          endorsed_count: number
          unresolved_count: number
        }[]
      }
      get_my_calendar_feed_token: {
        Args: { p_course_id: string }
        Returns: string
      }
      get_popular_posts: {
        Args: { days_back?: number; limit_count?: number }
        Returns: {
          id: string
          likes_count: number
          published_at: string
          slug: string
          title: string
          views_count: number
        }[]
      }
      get_quiz_questions_for_authoring: {
        Args: { p_quiz_id: string }
        Returns: {
          answers: Json | null
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
        }[]
        SetofOptions: {
          from: "*"
          to: "quiz_questions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_quiz_questions_for_taking: {
        Args: { p_quiz_id: string }
        Returns: {
          answers: Json
          explanation: string
          id: string
          points: number
          position: number
          question_text: string
          question_type: string
          quiz_id: string
        }[]
      }
      get_related_posts: {
        Args: { limit_count?: number; post_id: string }
        Returns: {
          excerpt: string
          featured_image: string
          id: string
          published_at: string
          similarity_score: number
          slug: string
          title: string
        }[]
      }
      get_student_video_progress: {
        Args: { course_id_param: string; student_id: string }
        Returns: {
          average_completion_percentage: number
          completed_videos: number
          total_videos: number
          total_watch_time_minutes: number
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
      get_user_id: { Args: { email: string }; Returns: string }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_admin_access: { Args: { user_id_param: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_blog_post_view: {
        Args: { p_post_id: string }
        Returns: undefined
      }
      increment_blog_views: { Args: { post_id: string }; Returns: undefined }
      is_conversation_participant: {
        Args: { conversation_id_param: string; user_id_param: string }
        Returns: boolean
      }
      is_course_instructor: {
        Args: { course_id_param: string; user_id_param: string }
        Returns: boolean
      }
      is_grading_staff: { Args: never; Returns: boolean }
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
      log_submission_file_access: {
        Args: {
          p_action: string
          p_attachment_id?: string
          p_filename?: string
          p_submission_id: string
        }
        Returns: string
      }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: number
      }
      notification_digest_dispatch: { Args: never; Returns: number }
      notification_email_probe: { Args: never; Returns: Json }
      notification_email_secret: { Args: never; Returns: string }
      open_course_thread: {
        Args: { p_course_id: string; p_other_user_id: string }
        Returns: string
      }
      platform_stats: {
        Args: never
        Returns: {
          avg_completion: number
          community_members: number
          published_courses: number
        }[]
      }
      rate_limit_certificate_verify: {
        Args: { p_code: string; p_found: boolean; p_ip_hash: string }
        Returns: {
          attempts_last_minute: number
          rate_limited: boolean
        }[]
      }
      reorder_content_items: {
        Args: { p_item_ids: string[]; p_module_id: string }
        Returns: undefined
      }
      reorder_modules: {
        Args: { p_course_id: string; p_module_ids: string[] }
        Returns: undefined
      }
      replace_availability: {
        Args: { p_slots: Json }
        Returns: undefined
      }
      resolve_calendar_feed_token: {
        Args: { p_course_id: string; p_token: string }
        Returns: string
      }
      rotate_my_calendar_feed_token: {
        Args: { p_course_id: string }
        Returns: string
      }
      search_admin_users: {
        Args: {
          p_limit: number
          p_offset: number
          p_role: string
          p_search: string
        }
        Returns: {
          avatar_url: string
          created_at: string
          first_name: string
          id: string
          last_name: string
          roles: Database["public"]["Enums"]["app_role"][]
          total_count: number
        }[]
      }
      search_form_submissions: {
        Args: {
          p_form_id: string
          p_limit: number
          p_offset: number
          p_search: string
        }
        Returns: {
          created_at: string
          first_name: string
          form_id: string
          id: string
          last_name: string
          submission_data: Json
          total_count: number
          user_id: string
        }[]
      }
      snapshot_enrollment_progress: { Args: never; Returns: undefined }
      start_quiz_attempt: {
        Args: { p_quiz_id: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "quiz_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submission_audit_context: {
        Args: { p_submission_id: string }
        Returns: {
          assignment_id: string
          course_id: string
          module_id: string
          student_id: string
        }[]
      }
      track_blog_view: {
        Args: { post_id: string; referrer_url?: string; view_date: string }
        Returns: undefined
      }
      update_user_roles: {
        Args: { new_roles: string[]; target_user_id: string }
        Returns: undefined
      }
      verify_certificate: {
        Args: { p_code: string }
        Returns: {
          certificate_data: Json
          certificate_type: string
          course_category: string
          course_duration: string
          course_id: string
          course_level: string
          course_title: string
          issued_at: string
          student_name: string
          verification_code: string
        }[]
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
      course_difficulty: "beginner" | "intermediate" | "advanced"
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
      course_difficulty: ["beginner", "intermediate", "advanced"],
      module_content_type: ["text", "video", "image"],
      user_role: ["admin", "instructor", "user"],
    },
  },
} as const

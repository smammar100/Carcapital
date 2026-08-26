// Generated from the live Supabase project via the MCP generate_typescript_types tool.
// Regenerate after every migration. Do not edit by hand.

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
      activity_log: {
        Row: {
          action_type: string
          company_id: string
          created_at: string
          description: string
          id: string
          metadata: Json
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          action_type: string
          company_id: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          action_type?: string
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          customer_email: string
          customer_name: string
          customer_phone: string
          date: string
          id: string
          lead_id: string | null
          notifications_sent: Json
          outcome: string
          special_requirements: string | null
          status: string
          time: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          customer_email: string
          customer_name: string
          customer_phone: string
          date: string
          id?: string
          lead_id?: string | null
          notifications_sent?: Json
          outcome: string
          special_requirements?: string | null
          status: string
          time: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          date?: string
          id?: string
          lead_id?: string | null
          notifications_sent?: Json
          outcome?: string
          special_requirements?: string | null
          status?: string
          time?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string
          created_at: string
          id: string
          logo_url: string | null
          name: string
          next_cc_inv_seq: number
          next_purchase_invoice_seq: number
          next_refund_invoice_seq: number
          next_sale_invoice_seq: number
          next_stock_seq: number
          stock_id_prefix: string
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          next_cc_inv_seq?: number
          next_purchase_invoice_seq?: number
          next_refund_invoice_seq?: number
          next_sale_invoice_seq?: number
          next_stock_seq?: number
          stock_id_prefix: string
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          next_cc_inv_seq?: number
          next_purchase_invoice_seq?: number
          next_refund_invoice_seq?: number
          next_sale_invoice_seq?: number
          next_stock_seq?: number
          stock_id_prefix?: string
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address_lines: string[]
          company_id: string
          company_name: string | null
          created_at: string
          email: string | null
          first_name: string
          home_phone: string | null
          id: string
          last_name: string
          marketing_consent: boolean
          mobile_phone: string | null
          notes: string | null
          postcode: string | null
          source_origin: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          address_lines?: string[]
          company_id: string
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          home_phone?: string | null
          id?: string
          last_name: string
          marketing_consent?: boolean
          mobile_phone?: string | null
          notes?: string | null
          postcode?: string | null
          source_origin?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          address_lines?: string[]
          company_id?: string
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          home_phone?: string | null
          id?: string
          last_name?: string
          marketing_consent?: boolean
          mobile_phone?: string | null
          notes?: string | null
          postcode?: string | null
          source_origin?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_partners: {
        Row: {
          active: boolean
          company_id: string
          company_name: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          company_name?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          company_name?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dealer_partners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      team_join_links: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          default_role: string
          expires_at: string
          id: string
          max_uses: number | null
          revoked_at: string | null
          token: string
          used_count: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          default_role?: string
          expires_at?: string
          id?: string
          max_uses?: number | null
          revoked_at?: string | null
          token: string
          used_count?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          default_role?: string
          expires_at?: string
          id?: string
          max_uses?: number | null
          revoked_at?: string | null
          token?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_join_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      enquiries: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          finance_interest: boolean
          id: string
          lost_reason: string | null
          next_action_due_at: string | null
          notes: string | null
          salesperson_id: string
          source: string
          status: string
          type: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          finance_interest?: boolean
          id?: string
          lost_reason?: string | null
          next_action_due_at?: string | null
          notes?: string | null
          salesperson_id: string
          source: string
          status: string
          type: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          finance_interest?: boolean
          id?: string
          lost_reason?: string | null
          next_action_due_at?: string | null
          notes?: string | null
          salesperson_id?: string
          source?: string
          status?: string
          type?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enquiries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      enquiry_history: {
        Row: {
          actor_id: string
          created_at: string
          enquiry_id: string
          from_status: string | null
          id: string
          note: string | null
          to_status: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          enquiry_id: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          enquiry_id?: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "enquiry_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiry_history_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "enquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_checks: {
        Row: {
          action_required: string | null
          carried_out_by: string
          carried_out_date: string
          check_item: string
          check_number: number
          created_at: string
          id: string
          status: string
          vehicle_id: string
        }
        Insert: {
          action_required?: string | null
          carried_out_by: string
          carried_out_date: string
          check_item: string
          check_number: number
          created_at?: string
          id?: string
          status: string
          vehicle_id: string
        }
        Update: {
          action_required?: string | null
          carried_out_by?: string
          carried_out_date?: string
          check_item?: string
          check_number?: number
          created_at?: string
          id?: string
          status?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_checks_carried_out_by_fkey"
            columns: ["carried_out_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_checks_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_notes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          addon_category: string | null
          addon_type: string | null
          created_at: string
          description: string
          id: string
          invoice_id: string
          item_type: string | null
          line_type: string
          quantity: number
          sort_order: number
          subtotal: number
          unit_price: number
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          addon_category?: string | null
          addon_type?: string | null
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          item_type?: string | null
          line_type: string
          quantity?: number
          sort_order?: number
          subtotal?: number
          unit_price?: number
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          addon_category?: string | null
          addon_type?: string | null
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          item_type?: string | null
          line_type?: string
          quantity?: number
          sort_order?: number
          subtotal?: number
          unit_price?: number
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          balance_due: number
          balance_due_by: string | null
          created_at: string
          deposit_amount: number
          deposit_method: string | null
          finance_amount: number
          finance_provider: string | null
          id: string
          invoice_id: string
        }
        Insert: {
          balance_due?: number
          balance_due_by?: string | null
          created_at?: string
          deposit_amount?: number
          deposit_method?: string | null
          finance_amount?: number
          finance_provider?: string | null
          id?: string
          invoice_id: string
        }
        Update: {
          balance_due?: number
          balance_due_by?: string | null
          created_at?: string
          deposit_amount?: number
          deposit_method?: string | null
          finance_amount?: number
          finance_provider?: string | null
          id?: string
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_receipts: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          id: string
          invoice_id: string
          method: string | null
          notes: string | null
          paid_on: string
          recorded_by: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          id?: string
          invoice_id: string
          method?: string | null
          notes?: string | null
          paid_on?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string | null
          notes?: string | null
          paid_on?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          addons_total: number
          attachment_url: string | null
          balance_due: number
          balance_due_by: string | null
          buyer_postcode: string | null
          created_by: string | null
          custom_note: string | null
          deposit_amount: number
          deposit_method: string | null
          deposit_received_date: string | null
          discount: number
          dor_date: string | null
          finance_amount: number
          finance_provider: string | null
          grand_total_incl_addons: number
          include_id_requirement_note: boolean
          include_service_history_note: boolean
          include_unit_stocking_note: boolean
          issued_at: string | null
          non_warranty_disclaimer_accepted: boolean
          paid_addons_total: number
          pre_delivery_check: Json | null
          present_mileage: number | null
          sale_id: string | null
          sales_price: number
          warranty: Json | null
          buyer_address: string | null
          buyer_email: string | null
          buyer_name: string | null
          buyer_phone: string | null
          company_id: string
          created_at: string
          discount_total: number
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          party_email: string | null
          party_name: string
          party_phone: string | null
          related_invoice_id: string | null
          related_return_id: string | null
          status: string
          subtotal: number
          total: number
          type: string
          updated_at: string
          vat_amount: number
          vat_scheme: string
          vehicle_id: string | null
        }
        Insert: {
          addons_total?: number
          attachment_url?: string | null
          balance_due?: number
          balance_due_by?: string | null
          buyer_postcode?: string | null
          created_by?: string | null
          custom_note?: string | null
          deposit_amount?: number
          deposit_method?: string | null
          deposit_received_date?: string | null
          discount?: number
          dor_date?: string | null
          finance_amount?: number
          finance_provider?: string | null
          grand_total_incl_addons?: number
          include_id_requirement_note?: boolean
          include_service_history_note?: boolean
          include_unit_stocking_note?: boolean
          issued_at?: string | null
          non_warranty_disclaimer_accepted?: boolean
          paid_addons_total?: number
          pre_delivery_check?: Json | null
          present_mileage?: number | null
          sale_id?: string | null
          sales_price?: number
          warranty?: Json | null
          buyer_address?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          company_id: string
          created_at?: string
          discount_total?: number
          due_date?: string | null
          id?: string
          invoice_date: string
          invoice_number: string
          notes?: string | null
          party_email?: string | null
          party_name: string
          party_phone?: string | null
          related_invoice_id?: string | null
          related_return_id?: string | null
          status: string
          subtotal?: number
          total?: number
          type: string
          updated_at?: string
          vat_amount?: number
          vat_scheme: string
          vehicle_id?: string | null
        }
        Update: {
          addons_total?: number
          attachment_url?: string | null
          balance_due?: number
          balance_due_by?: string | null
          buyer_postcode?: string | null
          created_by?: string | null
          custom_note?: string | null
          deposit_amount?: number
          deposit_method?: string | null
          deposit_received_date?: string | null
          discount?: number
          dor_date?: string | null
          finance_amount?: number
          finance_provider?: string | null
          grand_total_incl_addons?: number
          include_id_requirement_note?: boolean
          include_service_history_note?: boolean
          include_unit_stocking_note?: boolean
          issued_at?: string | null
          non_warranty_disclaimer_accepted?: boolean
          paid_addons_total?: number
          pre_delivery_check?: Json | null
          present_mileage?: number | null
          sale_id?: string | null
          sales_price?: number
          warranty?: Json | null
          buyer_address?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          company_id?: string
          created_at?: string
          discount_total?: number
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          party_email?: string | null
          party_name?: string
          party_phone?: string | null
          related_invoice_id?: string | null
          related_return_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          type?: string
          updated_at?: string
          vat_amount?: number
          vat_scheme?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_related_invoice_id_fkey"
            columns: ["related_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_related_return_id_fkey"
            columns: ["related_return_id"]
            isOneToOne: false
            referencedRelation: "vehicle_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          appointment_id: string | null
          assigned_to: string
          company_id: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          id: string
          lost_reason: string | null
          notes: string | null
          source: string
          status: string
          updated_at: string
          vehicle_id: string | null
          vehicle_interest: string
        }
        Insert: {
          appointment_id?: string | null
          assigned_to: string
          company_id: string
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          id?: string
          lost_reason?: string | null
          notes?: string | null
          source: string
          status: string
          updated_at?: string
          vehicle_id?: string | null
          vehicle_interest: string
        }
        Update: {
          appointment_id?: string | null
          assigned_to?: string
          company_id?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
          lost_reason?: string | null
          notes?: string | null
          source?: string
          status?: string
          updated_at?: string
          vehicle_id?: string | null
          vehicle_interest?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_leads_appointment"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          at_price_indicator: string
          channels: Json
          company_id: string
          created_at: string
          description: string
          enquiries_count: number
          id: string
          price: number
          published_at: string | null
          special_features: string
          status: string
          title: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          at_price_indicator: string
          channels?: Json
          company_id: string
          created_at?: string
          description: string
          enquiries_count?: number
          id?: string
          price: number
          published_at?: string | null
          special_features?: string
          status: string
          title: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          at_price_indicator?: string
          channels?: Json
          company_id?: string
          created_at?: string
          description?: string
          enquiries_count?: number
          id?: string
          price?: number
          published_at?: string | null
          special_features?: string
          status?: string
          title?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_job_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          job_id: string
          note_type: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          job_id: string
          note_type: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          job_id?: string
          note_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_job_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "maintenance_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_job_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_jobs: {
        Row: {
          actual_cost: number | null
          assigned_to: string | null
          company_id: string
          completed_date: string | null
          created_at: string
          description: string
          due_date: string | null
          estimated_cost: number | null
          estimated_duration_hours: number | null
          id: string
          notes: string | null
          start_date: string | null
          status: string
          updated_at: string
          vehicle_id: string
          vendor_id: string | null
        }
        Insert: {
          actual_cost?: number | null
          assigned_to?: string | null
          company_id: string
          completed_date?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          estimated_cost?: number | null
          estimated_duration_hours?: number | null
          id?: string
          notes?: string | null
          start_date?: string | null
          status: string
          updated_at?: string
          vehicle_id: string
          vendor_id?: string | null
        }
        Update: {
          actual_cost?: number | null
          assigned_to?: string | null
          company_id?: string
          completed_date?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          estimated_cost?: number | null
          estimated_duration_hours?: number | null
          id?: string
          notes?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_jobs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_jobs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          company_id: string
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          company_id: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          behaviour: string
          company_id: string
          created_at: string
          enabled: boolean
          id: string
          is_system: boolean
          label: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          behaviour?: string
          company_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          is_system?: boolean
          label: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          behaviour?: string
          company_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          is_system?: boolean
          label?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_deals: {
        Row: {
          agreed_price: number | null
          collection_date: string | null
          company_id: string
          completion_date: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          deposit_amount: number | null
          deposit_date: string | null
          id: string
          lead_id: string | null
          notes: string | null
          offer_price: number | null
          selling_agent: string
          stage: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          agreed_price?: number | null
          collection_date?: string | null
          company_id: string
          completion_date?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          deposit_amount?: number | null
          deposit_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          offer_price?: number | null
          selling_agent: string
          stage: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          agreed_price?: number | null
          collection_date?: string | null
          company_id?: string
          completion_date?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          deposit_amount?: number | null
          deposit_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          offer_price?: number | null
          selling_agent?: string
          stage?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_deals_selling_agent_fkey"
            columns: ["selling_agent"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_deals_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_items: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          cost: number | null
          created_at: string
          created_by: string
          description: string
          id: string
          serial_number: number
          source: string
          status: string
          vehicle_id: string
          vendor_id: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          cost?: number | null
          created_at?: string
          created_by: string
          description: string
          id?: string
          serial_number: number
          source: string
          status: string
          vehicle_id: string
          vendor_id?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          serial_number?: number
          source?: string
          status?: string
          vehicle_id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "todo_items_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_items_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          capability: string
          granted_at: string
          granted_by: string
          id: string
          user_id: string
        }
        Insert: {
          capability: string
          granted_at?: string
          granted_by: string
          id?: string
          user_id: string
        }
        Update: {
          capability?: string
          granted_at?: string
          granted_by?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          accepted_at: string | null
          active: boolean
          avatar_url: string | null
          company_id: string
          created_at: string
          email: string
          id: string
          invited_at: string | null
          is_super_user: boolean
          last_login_at: string | null
          name: string
          onboarding_completed_at: string | null
          role: string
          roles: string[]
          two_step_enabled: boolean
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          active?: boolean
          avatar_url?: string | null
          company_id: string
          created_at?: string
          email: string
          id: string
          invited_at?: string | null
          is_super_user?: boolean
          last_login_at?: string | null
          name: string
          onboarding_completed_at?: string | null
          role: string
          roles?: string[]
          two_step_enabled?: boolean
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          active?: boolean
          avatar_url?: string | null
          company_id?: string
          created_at?: string
          email?: string
          id?: string
          invited_at?: string | null
          is_super_user?: boolean
          last_login_at?: string | null
          name?: string
          onboarding_completed_at?: string | null
          role?: string
          roles?: string[]
          two_step_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_photos: {
        Row: {
          background_processed: boolean
          composed_url: string | null
          id: string
          order: number
          processed_url: string | null
          selected_background: string | null
          uploaded_at: string
          uploaded_by: string
          url: string
          vehicle_id: string
        }
        Insert: {
          background_processed?: boolean
          composed_url?: string | null
          id?: string
          order?: number
          processed_url?: string | null
          selected_background?: string | null
          uploaded_at?: string
          uploaded_by: string
          url: string
          vehicle_id: string
        }
        Update: {
          background_processed?: boolean
          composed_url?: string | null
          id?: string
          order?: number
          processed_url?: string | null
          selected_background?: string | null
          uploaded_at?: string
          uploaded_by?: string
          url?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_photos_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_returns: {
        Row: {
          company_id: string
          created_at: string
          customer_name: string
          customer_phone: string
          id: string
          original_invoice_id: string | null
          reason: string
          refund_account_number: string | null
          refund_amount: number | null
          refund_bank_account_name: string | null
          refund_bank_name: string | null
          refund_sort_code: string | null
          resolution_notes: string | null
          resolution_path: string
          resolved_at: string | null
          return_date: string
          sale_deal_id: string | null
          status: string
          vehicle_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_name: string
          customer_phone: string
          id?: string
          original_invoice_id?: string | null
          reason: string
          refund_account_number?: string | null
          refund_amount?: number | null
          refund_bank_account_name?: string | null
          refund_bank_name?: string | null
          refund_sort_code?: string | null
          resolution_notes?: string | null
          resolution_path: string
          resolved_at?: string | null
          return_date: string
          sale_deal_id?: string | null
          status: string
          vehicle_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          original_invoice_id?: string | null
          reason?: string
          refund_account_number?: string | null
          refund_amount?: number | null
          refund_bank_account_name?: string | null
          refund_bank_name?: string | null
          refund_sort_code?: string | null
          resolution_notes?: string | null
          resolution_path?: string
          resolved_at?: string | null
          return_date?: string
          sale_deal_id?: string | null
          status?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_returns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_returns_original_invoice_id_fkey"
            columns: ["original_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_returns_sale_deal_id_fkey"
            columns: ["sale_deal_id"]
            isOneToOne: false
            referencedRelation: "sales_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_returns_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          auction_house: string | null
          base_cost: number
          body_type: string
          buyers_fee: number | null
          buying_price: number
          collection_fee: number | null
          colour: string
          company_id: string
          first_registered_date: string | null
          vin: string | null
          created_at: string
          daily_charge_rate: number | null
          date_sold: string | null
          days_in_stock: number
          delivery_fee: number | null
          engine_size_cc: number | null
          finance_provider: string
          fuel_type: string
          gross_earning: number | null
          hero_image_url: string | null
          id: string
          images_count: number
          prep_assigned_to: string | null
          inspection_charge: number | null
          invoice_date: string | null
          landed_cost: number
          late_storage_fee: number | null
          listing_price: number | null
          loading_fee: number | null
          local_or_import: string
          lock_nut: boolean
          make: string
          managed_by: string | null
          mileage: number
          minimum_sale_price: number | null
          model: string
          mot_expiry: string | null
          num_keys: number
          other_charges: number | null
          owned_by: string | null
          purchase_channel: string | null
          received_by: string
          received_date: string
          registration: string
          removed_from_website_at: string | null
          seller_name: string
          seller_phone: string
          selling_agent: string | null
          selling_price: number | null
          service_history: string
          source_type: string
          status: string
          stock_id: string
          stocking_charges: number
          supplier_id: string | null
          tag_number: string | null
          total_buying_price: number
          transmission: string
          unloading_fee: number | null
          updated_at: string
          v5_received: boolean
          value_addition: number
          variant_code: string | null
          variant_name: string | null
          vat_on_buying_price: number
          vehicle_type: string
          warranty_cost: number | null
          year: number
        }
        Insert: {
          auction_house?: string | null
          base_cost?: number
          body_type: string
          buyers_fee?: number | null
          buying_price?: number
          collection_fee?: number | null
          colour: string
          company_id: string
          first_registered_date?: string | null
          vin?: string | null
          created_at?: string
          daily_charge_rate?: number | null
          date_sold?: string | null
          days_in_stock?: number
          delivery_fee?: number | null
          engine_size_cc?: number | null
          finance_provider: string
          fuel_type: string
          gross_earning?: number | null
          hero_image_url?: string | null
          id?: string
          images_count?: number
          prep_assigned_to?: string | null
          inspection_charge?: number | null
          invoice_date?: string | null
          landed_cost?: number
          late_storage_fee?: number | null
          listing_price?: number | null
          loading_fee?: number | null
          local_or_import: string
          lock_nut?: boolean
          make: string
          managed_by?: string | null
          mileage: number
          minimum_sale_price?: number | null
          model: string
          mot_expiry?: string | null
          num_keys?: number
          other_charges?: number | null
          owned_by?: string | null
          purchase_channel?: string | null
          received_by: string
          received_date: string
          registration: string
          removed_from_website_at?: string | null
          seller_name: string
          seller_phone: string
          selling_agent?: string | null
          selling_price?: number | null
          service_history: string
          source_type: string
          status: string
          stock_id: string
          stocking_charges?: number
          supplier_id?: string | null
          tag_number?: string | null
          total_buying_price?: number
          transmission: string
          unloading_fee?: number | null
          updated_at?: string
          v5_received?: boolean
          value_addition?: number
          variant_code?: string | null
          variant_name?: string | null
          vat_on_buying_price?: number
          vehicle_type: string
          warranty_cost?: number | null
          year: number
        }
        Update: {
          auction_house?: string | null
          base_cost?: number
          body_type?: string
          buyers_fee?: number | null
          buying_price?: number
          collection_fee?: number | null
          colour?: string
          company_id?: string
          first_registered_date?: string | null
          vin?: string | null
          created_at?: string
          daily_charge_rate?: number | null
          date_sold?: string | null
          days_in_stock?: number
          delivery_fee?: number | null
          engine_size_cc?: number | null
          finance_provider?: string
          fuel_type?: string
          gross_earning?: number | null
          hero_image_url?: string | null
          id?: string
          images_count?: number
          prep_assigned_to?: string | null
          inspection_charge?: number | null
          invoice_date?: string | null
          landed_cost?: number
          late_storage_fee?: number | null
          listing_price?: number | null
          loading_fee?: number | null
          local_or_import?: string
          lock_nut?: boolean
          make?: string
          managed_by?: string | null
          mileage?: number
          minimum_sale_price?: number | null
          model?: string
          mot_expiry?: string | null
          num_keys?: number
          other_charges?: number | null
          owned_by?: string | null
          purchase_channel?: string | null
          received_by?: string
          received_date?: string
          registration?: string
          removed_from_website_at?: string | null
          seller_name?: string
          seller_phone?: string
          selling_agent?: string | null
          selling_price?: number | null
          service_history?: string
          source_type?: string
          status?: string
          stock_id?: string
          stocking_charges?: number
          supplier_id?: string | null
          tag_number?: string | null
          total_buying_price?: number
          transmission?: string
          unloading_fee?: number | null
          updated_at?: string
          v5_received?: boolean
          value_addition?: number
          variant_code?: string | null
          variant_name?: string | null
          vat_on_buying_price?: number
          vehicle_type?: string
          warranty_cost?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_managed_by_fkey"
            columns: ["managed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "dealer_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          name: string
          phone: string
          speciality: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          name: string
          phone: string
          speciality: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string
          speciality?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      warranties: {
        Row: {
          certificate_generated: boolean
          company_id: string
          cost_to_customer: number
          cost_to_dealership: number
          amount_paid: number | null
          coverage_details: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          end_date: string
          id: string
          invoice_id: string | null
          provider: string | null
          provider_reference: string | null
          purchase_status: string | null
          purchased_at: string | null
          purchased_by: string | null
          sale_deal_id: string | null
          start_date: string
          status: string
          type: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          certificate_generated?: boolean
          company_id: string
          cost_to_customer?: number
          cost_to_dealership?: number
          amount_paid?: number | null
          coverage_details: string
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          end_date: string
          id?: string
          invoice_id?: string | null
          provider?: string | null
          provider_reference?: string | null
          purchase_status?: string | null
          purchased_at?: string | null
          purchased_by?: string | null
          sale_deal_id?: string | null
          start_date: string
          status: string
          type: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          certificate_generated?: boolean
          company_id?: string
          cost_to_customer?: number
          cost_to_dealership?: number
          amount_paid?: number | null
          coverage_details?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          end_date?: string
          id?: string
          invoice_id?: string | null
          provider?: string | null
          provider_reference?: string | null
          purchase_status?: string | null
          purchased_at?: string | null
          purchased_by?: string | null
          sale_deal_id?: string | null
          start_date?: string
          status?: string
          type?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_purchased_by_fkey"
            columns: ["purchased_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_sale_deal_id_fkey"
            columns: ["sale_deal_id"]
            isOneToOne: false
            referencedRelation: "sales_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_claims: {
        Row: {
          actual_cost: number | null
          company_id: string
          created_at: string
          customer_name: string
          estimated_cost: number | null
          id: string
          is_complaint: boolean
          issue_description: string
          resolution: string | null
          resolved_at: string | null
          status: string
          vehicle_id: string
          warranty_id: string
        }
        Insert: {
          actual_cost?: number | null
          company_id: string
          created_at?: string
          customer_name: string
          estimated_cost?: number | null
          id?: string
          is_complaint?: boolean
          issue_description: string
          resolution?: string | null
          resolved_at?: string | null
          status: string
          vehicle_id: string
          warranty_id: string
        }
        Update: {
          actual_cost?: number | null
          company_id?: string
          created_at?: string
          customer_name?: string
          estimated_cost?: number | null
          id?: string
          is_complaint?: boolean
          issue_description?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          vehicle_id?: string
          warranty_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranty_claims_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_claims_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_claims_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_jobs: {
        Row: {
          actual_cost: number | null
          assigned_to: string | null
          company_id: string
          completed_date: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          description: string
          estimated_cost: number | null
          id: string
          notes: string | null
          scheduled_date: string
          scheduled_time: string
          status: string
          updated_at: string
          vehicle_description: string
          vehicle_reg: string
        }
        Insert: {
          actual_cost?: number | null
          assigned_to?: string | null
          company_id: string
          completed_date?: string | null
          created_at?: string
          customer_name: string
          customer_phone: string
          description: string
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          scheduled_date: string
          scheduled_time: string
          status: string
          updated_at?: string
          vehicle_description: string
          vehicle_reg: string
        }
        Update: {
          actual_cost?: number | null
          assigned_to?: string | null
          company_id?: string
          completed_date?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          description?: string
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          scheduled_date?: string
          scheduled_time?: string
          status?: string
          updated_at?: string
          vehicle_description?: string
          vehicle_reg?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_company_id: { Args: never; Returns: string }
      next_cc_invoice_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      next_invoice_number: {
        Args: { p_company_id: string; p_type: string }
        Returns: string
      }
      next_stock_seq: { Args: { p_company_id: string }; Returns: string }
      set_user_permissions: {
        Args: {
          p_capabilities: string[]
          p_granted_by: string
          p_user_id: string
        }
        Returns: undefined
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
    Enums: {},
  },
} as const

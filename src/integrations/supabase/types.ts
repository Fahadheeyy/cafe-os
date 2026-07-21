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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
  public: {
    Tables: {
      businesses: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          id: string
          logo: string | null
          name: string
          parcel_fee: number
          tax_percent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          logo?: string | null
          name: string
          parcel_fee?: number
          tax_percent?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          logo?: string | null
          name?: string
          parcel_fee?: number
          tax_percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          business_id: string
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          expense_date: string
          id: string
          notes: string | null
          purchase_id: string | null
          title: string
        }
        Insert: {
          amount: number
          business_id: string
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          expense_date?: string
          id?: string
          notes?: string | null
          purchase_id?: string | null
          title: string
        }
        Update: {
          amount?: number
          business_id?: string
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          expense_date?: string
          id?: string
          notes?: string | null
          purchase_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      kots: {
        Row: {
          business_id: string | null
          created_at: string | null
          id: string
          kitchen_status: Database["public"]["Enums"]["kitchen_status"] | null
          order_id: string | null
          updated_at: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          id?: string
          kitchen_status?: Database["public"]["Enums"]["kitchen_status"] | null
          order_id?: string | null
          updated_at?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          id?: string
          kitchen_status?: Database["public"]["Enums"]["kitchen_status"] | null
          order_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kots_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          business_id: string
          created_at: string
          id: string
          kind: string
          read_by: string[]
          target_role: Database["public"]["Enums"]["app_role"] | null
          title: string
        }
        Insert: {
          body?: string | null
          business_id: string
          created_at?: string
          id?: string
          kind: string
          read_by?: string[]
          target_role?: Database["public"]["Enums"]["app_role"] | null
          title: string
        }
        Update: {
          body?: string | null
          business_id?: string
          created_at?: string
          id?: string
          kind?: string
          read_by?: string[]
          target_role?: Database["public"]["Enums"]["app_role"] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          business_id: string
          created_at: string
          id: string
          kot_id: string | null
          name: string
          order_id: string
          price: number
          product_id: string | null
          qty: number
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          kot_id?: string | null
          name: string
          order_id: string
          price: number
          product_id?: string | null
          qty: number
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          kot_id?: string | null
          name?: string
          order_id?: string
          price?: number
          product_id?: string | null
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_kot_id_fkey"
            columns: ["kot_id"]
            isOneToOne: false
            referencedRelation: "kots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          business_id: string
          created_at: string
          id: string
          kitchen_status: Database["public"]["Enums"]["kitchen_status"]
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at: string | null
          parcel_fee: number
          payment: Database["public"]["Enums"]["payment_status"]
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          sent_to_kitchen_at: string
          staff_id: string | null
          staff_name: string
          status: Database["public"]["Enums"]["order_status"]
          table_id: string | null
          table_name: string | null
          total: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          kitchen_status?: Database["public"]["Enums"]["kitchen_status"]
          order_type?: Database["public"]["Enums"]["order_type"]
          paid_at?: string | null
          parcel_fee?: number
          payment?: Database["public"]["Enums"]["payment_status"]
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          sent_to_kitchen_at?: string
          staff_id?: string | null
          staff_name?: string
          status?: Database["public"]["Enums"]["order_status"]
          table_id?: string | null
          table_name?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          kitchen_status?: Database["public"]["Enums"]["kitchen_status"]
          order_type?: Database["public"]["Enums"]["order_type"]
          paid_at?: string | null
          parcel_fee?: number
          payment?: Database["public"]["Enums"]["payment_status"]
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          sent_to_kitchen_at?: string
          staff_id?: string | null
          staff_name?: string
          status?: Database["public"]["Enums"]["order_status"]
          table_id?: string | null
          table_name?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available: boolean
          business_id: string
          category: Database["public"]["Enums"]["product_category"]
          created_at: string
          description: string | null
          id: string
          image: string | null
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          available?: boolean
          business_id: string
          category: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string | null
          id?: string
          image?: string | null
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          available?: boolean
          business_id?: string
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string | null
          id?: string
          image?: string | null
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          business_id: string | null
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id?: string | null
          created_at?: string
          email: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_lines: {
        Row: {
          business_id: string
          id: string
          name: string
          purchase_id: string
          quantity: number
          rate: number
          stock_item_id: string | null
          total: number
          unit: Database["public"]["Enums"]["unit_type"]
        }
        Insert: {
          business_id: string
          id?: string
          name: string
          purchase_id: string
          quantity: number
          rate: number
          stock_item_id?: string | null
          total: number
          unit: Database["public"]["Enums"]["unit_type"]
        }
        Update: {
          business_id?: string
          id?: string
          name?: string
          purchase_id?: string
          quantity?: number
          rate?: number
          stock_item_id?: string | null
          total?: number
          unit?: Database["public"]["Enums"]["unit_type"]
        }
        Relationships: [
          {
            foreignKeyName: "purchase_lines_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_lines_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_lines_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          business_id: string
          created_at: string
          id: string
          notes: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          requested_by_id: string | null
          requested_by_name: string
          requested_quantity: number
          status: Database["public"]["Enums"]["request_status"]
          stock_item_id: string
          unit: Database["public"]["Enums"]["unit_type"]
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          requested_by_id?: string | null
          requested_by_name: string
          requested_quantity: number
          status?: Database["public"]["Enums"]["request_status"]
          stock_item_id: string
          unit: Database["public"]["Enums"]["unit_type"]
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          requested_by_id?: string | null
          requested_by_name?: string
          requested_quantity?: number
          status?: Database["public"]["Enums"]["request_status"]
          stock_item_id?: string
          unit?: Database["public"]["Enums"]["unit_type"]
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          business_id: string
          created_at: string
          id: string
          invoice_number: string | null
          purchase_date: string
          subtotal: number
          supplier: string
          tax: number
          total: number
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          invoice_number?: string | null
          purchase_date?: string
          subtotal?: number
          supplier: string
          tax?: number
          total?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          invoice_number?: string | null
          purchase_date?: string
          subtotal?: number
          supplier?: string
          tax?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_tables: {
        Row: {
          business_id: string
          created_at: string
          id: string
          name: string
          status: Database["public"]["Enums"]["table_status"]
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["table_status"]
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["table_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_history: {
        Row: {
          business_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["stock_history_kind"]
          new_balance: number
          note: string | null
          previous_balance: number
          stock_item_id: string
          updated_by_id: string | null
          updated_by_name: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["stock_history_kind"]
          new_balance: number
          note?: string | null
          previous_balance: number
          stock_item_id: string
          updated_by_id?: string | null
          updated_by_name: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["stock_history_kind"]
          new_balance?: number
          note?: string | null
          previous_balance?: number
          stock_item_id?: string
          updated_by_id?: string | null
          updated_by_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_history_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_history_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          business_id: string
          category: Database["public"]["Enums"]["stock_category"]
          created_at: string
          current_balance: number
          id: string
          minimum_balance: number
          name: string
          unit: Database["public"]["Enums"]["unit_type"]
          updated_at: string
        }
        Insert: {
          business_id: string
          category?: Database["public"]["Enums"]["stock_category"]
          created_at?: string
          current_balance?: number
          id?: string
          minimum_balance?: number
          name: string
          unit: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Update: {
          business_id?: string
          category?: Database["public"]["Enums"]["stock_category"]
          created_at?: string
          current_balance?: number
          id?: string
          minimum_balance?: number
          name?: string
          unit?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          business_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_entries: {
        Row: {
          business_id: string
          created_at: string
          estimated_cost: number
          id: string
          notes: string | null
          quantity: number
          reason: Database["public"]["Enums"]["waste_reason"]
          reported_by_id: string | null
          reported_by_name: string
          stock_item_id: string
          unit: Database["public"]["Enums"]["unit_type"]
        }
        Insert: {
          business_id: string
          created_at?: string
          estimated_cost?: number
          id?: string
          notes?: string | null
          quantity: number
          reason: Database["public"]["Enums"]["waste_reason"]
          reported_by_id?: string | null
          reported_by_name: string
          stock_item_id: string
          unit: Database["public"]["Enums"]["unit_type"]
        }
        Update: {
          business_id?: string
          created_at?: string
          estimated_cost?: number
          id?: string
          notes?: string | null
          quantity?: number
          reason?: Database["public"]["Enums"]["waste_reason"]
          reported_by_id?: string | null
          reported_by_name?: string
          stock_item_id?: string
          unit?: Database["public"]["Enums"]["unit_type"]
        }
        Relationships: [
          {
            foreignKeyName: "waste_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_entries_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_order: { Args: { _order_id: string }; Returns: undefined }
      create_business_and_owner: { Args: { _name: string }; Returns: string }
      current_business_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _business_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_owner: { Args: never; Returns: boolean }
      mark_order_paid: {
        Args: {
          _method: Database["public"]["Enums"]["payment_method"]
          _order_id: string
        }
        Returns: undefined
      }
      record_purchase: {
        Args: {
          _invoice_number: string
          _lines: Json
          _purchase_date: string
          _supplier: string
          _tax: number
        }
        Returns: string
      }
      record_waste: {
        Args: {
          _notes?: string
          _quantity: number
          _reason: Database["public"]["Enums"]["waste_reason"]
          _stock_item_id: string
          _unit: Database["public"]["Enums"]["unit_type"]
        }
        Returns: string
      }
      set_stock_balance: {
        Args: { _new_balance: number; _note?: string; _stock_item_id: string }
        Returns: undefined
      }
      upsert_order_with_items:
        | { Args: { _items: Json; _table_id: string }; Returns: string }
        | {
            Args: {
              _items: Json
              _order_id?: string
              _order_type?: Database["public"]["Enums"]["order_type"]
              _parcel_fee?: number
              _table_id: string
            }
            Returns: string
          }
    }
    Enums: {
      app_role: "owner" | "manager" | "staff" | "chef"
      expense_category:
        | "Rent"
        | "Electricity"
        | "Gas"
        | "Salary"
        | "Maintenance"
        | "Cleaning"
        | "Internet"
        | "Purchases"
        | "Miscellaneous"
      kitchen_status: "queued" | "preparing" | "ready" | "served"
      order_status: "pending" | "completed" | "cancelled"
      order_type: "dine_in" | "takeaway"
      payment_method: "upi" | "cash"
      payment_status: "unpaid" | "paid"
      priority_level: "low" | "medium" | "high"
      product_category:
        | "Tea"
        | "Coffee"
        | "Snacks"
        | "Meals"
        | "Juice"
        | "Desserts"
      request_status: "pending" | "approved" | "purchased" | "rejected"
      stock_category:
        | "Dairy"
        | "Beverages"
        | "Bakery"
        | "Produce"
        | "Meat"
        | "Groceries"
        | "Other"
      stock_history_kind: "update" | "purchase" | "waste"
      table_status: "available" | "occupied" | "bill_ready"
      unit_type: "L" | "ml" | "kg" | "g" | "pcs" | "pack"
      waste_reason: "Spillage" | "Expired" | "Burnt" | "Damaged" | "Other"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["owner", "manager", "staff", "chef"],
      expense_category: [
        "Rent",
        "Electricity",
        "Gas",
        "Salary",
        "Maintenance",
        "Cleaning",
        "Internet",
        "Purchases",
        "Miscellaneous",
      ],
      kitchen_status: ["queued", "preparing", "ready", "served"],
      order_status: ["pending", "completed", "cancelled"],
      order_type: ["dine_in", "takeaway"],
      payment_method: ["upi", "cash"],
      payment_status: ["unpaid", "paid"],
      priority_level: ["low", "medium", "high"],
      product_category: [
        "Tea",
        "Coffee",
        "Snacks",
        "Meals",
        "Juice",
        "Desserts",
      ],
      request_status: ["pending", "approved", "purchased", "rejected"],
      stock_category: [
        "Dairy",
        "Beverages",
        "Bakery",
        "Produce",
        "Meat",
        "Groceries",
        "Other",
      ],
      stock_history_kind: ["update", "purchase", "waste"],
      table_status: ["available", "occupied", "bill_ready"],
      unit_type: ["L", "ml", "kg", "g", "pcs", "pack"],
      waste_reason: ["Spillage", "Expired", "Burnt", "Damaged", "Other"],
    },
  },
} as const

import { createClient } from '@supabase/supabase-js';

// Значения из .env, с fallback на публичные данные проекта (anon-ключ предназначен для клиента).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://aedgfvtukqxgtqojpbrn.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZGdmdnR1a3F4Z3Rxb2pwYnJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MDU2ODIsImV4cCI6MjA5NjQ4MTY4Mn0.xTF2KKS0KBlJi17P_0oxzrV9UBXPYXlr4PK5NZ-HUYs';

export const supabase = createClient(url, key);

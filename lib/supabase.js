import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cfhxynulwqzpmwudblzf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmaHh5bnVsd3F6cG13dWRibHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNzk2MTIsImV4cCI6MjA5NDc1NTYxMn0.50C4nzFi5q_1IBvLQBu3taxTSri2D8rL-G67nhnwGEM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
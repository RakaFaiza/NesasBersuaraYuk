// js/supabase.js
const SUPABASE_URL = 'https://bwsvngcgqbtzdttcuzse.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3c3ZuZ2NncWJ0emR0dGN1enNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDU0MDYsImV4cCI6MjA5NDU4MTQwNn0.eb48G5rczrf1rX6T2pfl61804Mf5ZflYdWjj0yOmQFA';

if (typeof supabase === 'undefined' || !supabase.createClient) {
  console.error('Supabase library tidak dimuat! Periksa urutan script di HTML.');
} else {
  window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('Supabase client siap');
}
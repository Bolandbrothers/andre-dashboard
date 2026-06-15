import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url, key);
export const ROW_ID = "andre";

export async function loadState() {
  const { data, error } = await supabase
    .from("dashboard_state")
    .select("data")
    .eq("id", ROW_ID)
    .single();
  if (error) { console.error("load error", error); return {}; }
  return data?.data || {};
}

export async function saveState(state) {
  const { error } = await supabase
    .from("dashboard_state")
    .update({ data: state, updated_at: new Date().toISOString() })
    .eq("id", ROW_ID);
  if (error) console.error("save error", error);
  return !error;
}

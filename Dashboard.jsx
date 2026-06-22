import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { loadState, saveState } from "./supabase.js";

// ── CONSTANTS ────────────────────────────────────────────────────────────────
const Y = "#e8ff47", B = "#47c8ff", O = "#ff6b47", G = "#4ade80", MU = "#6b7494", BR = "#2a2f42", CARD = "#1c2030", BG = "#0d0f14", SURF = "#151820";
const COLOR_MAP = { Y, B, O, G };
const rc = c => COLOR_MAP[c] || c || Y;  // resolve color: letter key -> hex, or passthrough hex

const GOALS = {
  training: { cal: 2250, protein: 190, carbs: 200, fat: 65 },
  rest:      { cal: 1950, protein: 190, carbs: 135, fat: 65 }
};

// Use NZ time so the "today" key matches what Claude writes from chat
const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = iso => { const d = new Date(iso + "T12:00:00"); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };

const TODAY_SEED = {
  type: "training",
  weight: 100,
  foods: [
    { name: "Protein shake - NowWhey (water, 42g)", cal: 156, protein: 22.4, carbs: 10.5, fat: 2.8 },
    { name: "Crumpet + marg + golden syrup", cal: 157, protein: 2.8, carbs: 25, fat: 4.5 },
    { name: "3x work flat white (200ml full fat milk)", cal: 390, protein: 21, carbs: 30, fat: 24 },
    { name: "Brinks Smoked Tandoori Chicken (346g)", cal: 623, protein: 97, carbs: 3, fat: 22 },
    { name: "Musashi Shred & Burn bar (60g)", cal: 215, protein: 20, carbs: 14, fat: 6 },
    { name: "Post-workout shake - NowWhey (30g + 250ml milk)", cal: 282, protein: 32.2, carbs: 14.5, fat: 10.8 },
    { name: "Chickpea & pea curry with white rice", cal: 475, protein: 16, carbs: 79, fat: 8.5 },
  ]
};

// ── GYM DATA ─────────────────────────────────────────────────────────────────
const GYM_BLOCKS = {
  1: {
    upper: [
      { name: "Bench Press",      meta: "Barbell total kg",       weeks: [72.5,75,75,75],    peak: "90kg", color: Y },
      { name: "Incline DB Fly",   meta: "DB per hand kg",         weeks: [15,15,17.5,20],              color: B },
      { name: "Shoulder Press",   meta: "Barbell total kg",       weeks: [40,42.5,42.5,50],            color: O },
      { name: "Lateral Raise",    meta: "DB per hand kg",         weeks: [7,7,7,null],                 color: G },
      { name: "Lat Pulldown",     meta: "Cable kg",               weeks: [60,66,null,60],              color: Y },
      { name: "Preacher Curl",    meta: "kg",                     weeks: [null,32.5,35,null],          color: B },
      { name: "Tricep Pushdown",  meta: "Cable kg",               weeks: [null,null,100,null],         color: O },
    ],
    lower: [
      { name: "Squat",            meta: "Barbell total kg",       weeks: [100,120,130,135],  peak: "140×9 noted", color: Y },
      { name: "RDL",              meta: "Barbell total kg",       weeks: [70,60,80,100],               color: B },
      { name: "Hip Thrust",       meta: "Barbell total kg",       weeks: [60,80,90,100],               color: O },
      { name: "Leg Press",        meta: "Machine kg",             weeks: [null,null,200,240],          color: G },
      { name: "Split Squat",      meta: "Added load kg",          weeks: [0,10,15,17.5],               color: Y },
    ]
  },
  2: {
    upper: [
      { name: "Bench Press",      meta: "Barbell total kg",       weeks: [80,82.5,90,95],              color: Y },
      { name: "Incline DB Fly",   meta: "DB per hand kg",         weeks: [20,20,22.5,30],              color: B },
      { name: "Shoulder Press",   meta: "DB per hand kg",         weeks: [20,22.5,22.5,30],            color: O },
      { name: "Lateral Raise",    meta: "DB per hand kg",         weeks: [6,7,7,8],                    color: G },
      { name: "Cable Row",        meta: "Cable kg",               weeks: [48,54,60,66],                color: Y },
      { name: "Lat Pulldown",     meta: "Cable kg",               weeks: [60,66,66,72],                color: B },
      { name: "Barbell Curl",     meta: "Barbell kg",             weeks: [30,35,35,35],                color: O },
      { name: "Tricep Pushdown",  meta: "Single arm cable kg",    weeks: [40,50,50,null],              color: G },
    ],
    lower: [
      { name: "Squat",            meta: "Reset for depth",        weeks: [80,100,100,100],             color: Y },
      { name: "RDL",              meta: "Barbell total kg",       weeks: [80,100,120,140],             color: B },
      { name: "Good Morning",     meta: "Barbell total kg",       weeks: [30,40,40,40],                color: O },
      { name: "SL Leg Press",     meta: "Machine kg",             weeks: [120,120,120,null],           color: G },
    ]
  },
  3: {
    upper: [
      { name: "Bench Press",      meta: "Wk1: DB 35/hand · Wk2–4: Barbell", weeks: [35,90,95,95],    color: Y },
      { name: "Incline DB",       meta: "DB per hand kg (Wk1&4=fly)",        weeks: [17.5,30,35,20],  color: B },
      { name: "Shoulder Press",   meta: "DB per hand kg",                    weeks: [27.5,25,30,30],  color: O },
      { name: "Lateral Raise",    meta: "DB per hand kg",                    weeks: [9,9,9,10],       color: G },
      { name: "Cable Row",        meta: "Cable kg",                          weeks: [66,66,66,66],    color: Y },
      { name: "Assisted Pull-up", meta: "Counterweight kg (↓ = stronger)",   weeks: [35,null,40,20],  color: B },
      { name: "Barbell Curl",     meta: "Barbell / Cable kg",                weeks: [32.5,42,null,40],color: O },
      { name: "Tricep",           meta: "Cable/Dip assist/OHE",              weeks: [70,25,30,70],    color: G },
    ],
    lower: [
      { name: "Squat",            meta: "Barbell · depth 5×5",               weeks: [120,100,100,100],color: Y },
      { name: "RDL",              meta: "Barbell kg · reset mid-block",       weeks: [120,null,80,null],color: B },
      { name: "Good Morning",     meta: "Barbell total kg",                   weeks: [40,null,40,40],  color: O },
      { name: "SL Leg Press",     meta: "Machine kg · depth focus",           weeks: [80,null,120,null],color: G },
      { name: "Hamstring Curl",   meta: "kg",                                 weeks: [30,null,40,null],color: Y },
    ]
  },
  4: {
    upper: [
      { name: "Bench Press",      meta: "Barbell 5×5 target · Wk1 top single 100×1", weeks: [100,null,null,null], color: Y },
      { name: "Incline DB Press", meta: "DB/hand kg (Wk1 fly 20)",           weeks: [20,null,null,null],  color: B },
      { name: "Shoulder Press",   meta: "DB per hand kg (prev 30)",          weeks: [27.5,null,null,null],color: O },
      { name: "Lateral Raise",    meta: "DB/hand + dropset",                 weeks: [12.5,null,null,null],color: G },
      { name: "Cable Row",        meta: "DB kg (prev 66+10)",                weeks: [40,null,null,null],  color: Y },
      { name: "Assisted Pull-up", meta: "Counterweight kg (↓ = stronger)",    weeks: [15,null,null,null],  color: B },
      { name: "Barbell Curl",     meta: "EZ-bar kg (prev 40)",               weeks: [37.5,null,null,null],color: O },
      { name: "Tricep Pushdown",  meta: "Single-arm cable kg",               weeks: [50,null,null,null],  color: G },
      { name: "Hammer Curl",      meta: "DB per hand kg",                    weeks: [10,null,null,null],  color: Y },
      { name: "Skullcrusher",     meta: "kg",                                weeks: [12.5,null,null,null],color: B },
    ],
    lower: [
      { name: "Squat",            meta: "Barbell 5×5 · planned opener",      weeks: [100,null,null,null], color: Y },
      { name: "RDL",              meta: "Barbell 5×5 · planned opener",      weeks: [100,null,null,null], color: B },
      { name: "Good Morning",     meta: "Barbell kg · planned",              weeks: [40,null,null,null],  color: O },
      { name: "Calf Press",       meta: "Machine kg · NEW (3×15-20)",        weeks: [160,null,null,null], color: G },
      { name: "SL Leg Press",     meta: "Machine kg · planned",              weeks: [120,null,null,null], color: Y },
      { name: "Hamstring Curl",   meta: "Single-leg kg · planned",           weeks: [40,null,null,null],  color: B },
    ]
  }
};

const NORMS = [
  { lift: "Bench (Barbell)", best: 100, bw: "1.00×", thresholds: [70,100,130], color: Y, note: "B4 Wk1 single" },
  { lift: "Squat",           best: 135, bw: "1.35×", thresholds: [90,125,162], color: B, note: "B1 peak" },
  { lift: "RDL",             best: 140, bw: "1.40×", thresholds: [100,140,185],color: O, note: "B2 Wk4" },
  { lift: "Hip Thrust",      best: 100, bw: "1.00×", thresholds: [80,120,160], color: G, note: "B1 Wk4" },
  { lift: "Shoulder Press",  best: 50,  bw: "0.50×", thresholds: [40,58,78],   color: Y, note: "B1 barbell" },
  { lift: "Incline DB /hand",best: 35,  bw: "0.35×", thresholds: [22,34,46],   color: B, note: "B3 Wk3" },
  { lift: "Cable Row",       best: 66,  bw: "0.66×", thresholds: [50,75,102],  color: O, note: "B2/B3" },
];

function getLevel(best, [n, i, a]) {
  if (best >= a) return { label: "Advanced",     pct: 100,                                            color: G };
  if (best >= i) return { label: "Intermediate", pct: Math.round(((best-i)/(a-i))*25+75),            color: B };
  if (best >= n) return { label: "Novice",       pct: Math.round(((best-n)/(i-n))*50+25),            color: Y };
  return               { label: "Beginner",     pct: Math.max(5, Math.round((best/n)*25)),           color: O };
}

// ── STORAGE HELPERS (Supabase) ─────────────────────────────────────────────────
const loadStore = loadState;
const saveStore = saveState;

// ── SUBCOMPONENTS ─────────────────────────────────────────────────────────────

function MacroRing({ label, actual, goal, color }) {
  const pct = Math.min(100, Math.round((actual / goal) * 100));
  const r = 22, circ = 2 * Math.PI * r, dash = (pct / 100) * circ;
  const rem = Math.round(goal - actual);
  return (
    <div style={{ background: CARD, border: `1px solid ${BR}`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
        <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="26" cy="26" r={r} fill="none" stroke={BR} strokeWidth="5" />
          <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, color }}>{pct}%</div>
      </div>
      <div>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: MU, marginBottom: 2 }}>{label}</div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color, lineHeight: 1 }}>{Math.round(actual)}{label === "Calories" ? "" : "g"}</div>
        <div style={{ fontSize: 10, color: MU }}>Goal: {goal}{label === "Calories" ? "" : "g"}</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: rem >= 0 ? MU : O, marginTop: 2 }}>{rem >= 0 ? `${rem}${label === "Calories" ? "" : "g"} left` : `${Math.abs(rem)}${label === "Calories" ? "" : "g"} over`}</div>
      </div>
    </div>
  );
}

function ExerciseCard({ ex }) {
  const vals = ex.weeks.filter(v => v !== null && v !== 0);
  const max = Math.max(...vals, 1);
  return (
    <div style={{ background: CARD, border: `1px solid ${BR}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
        {ex.name}{ex.peak && <span style={{ color: MU, fontSize: 9, fontWeight: 400 }}> (peak: {ex.peak})</span>}
      </div>
      <div style={{ fontSize: 10, color: MU, fontStyle: "italic", marginBottom: 10 }}>{ex.meta}</div>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 56 }}>
        {ex.weeks.map((v, i) => {
          const pct = v !== null ? Math.max(4, Math.round((v / max) * 100)) : 4;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, height: "100%", justifyContent: "flex-end" }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: "#f0f2f8" }}>{v !== null ? v : "—"}</div>
              <div style={{ width: "100%", height: `${pct}%`, borderRadius: "3px 3px 0 0", background: v !== null ? rc(ex.color) : BR, opacity: v !== null ? 1 : 0.25 }} />
              <div style={{ fontSize: 9, color: MU }}>W{i + 1}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [section, setSection] = useState("nutrition");
  const [nutritionTab, setNutritionTab] = useState("today");
  const [gymTab, setGymTab] = useState("overview");
  const [block, setBlock] = useState(4);
  const [store, setStore] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [foodForm, setFoodForm] = useState({ name: "", cal: "", protein: "", carbs: "", fat: "" });
  const [weightInput, setWeightInput] = useState("");
  const [saving, setSaving] = useState(false);

  // Load from persistent storage
  useEffect(() => {
    loadStore().then(data => {
      if (!data[TODAY]) {
        data[TODAY] = TODAY_SEED;
      }
      setStore(data);
      setLoaded(true);
    });
  }, []);

  // Auto-refresh every 30s to pick up changes made from chat
  useEffect(() => {
    const interval = setInterval(() => {
      loadStore().then(data => {
        if (data && Object.keys(data).length > 0) {
          if (!data[TODAY]) data[TODAY] = TODAY_SEED;
          setStore(data);
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const persist = useCallback(async (newStore) => {
    setStore(newStore);
    setSaving(true);
    await saveStore(newStore);
    setSaving(false);
  }, []);

  const today = store[TODAY] || TODAY_SEED;
  const g = GOALS[today.type || "training"];
  const totals = (today.foods || []).reduce((a, f) => ({ cal: a.cal + (f.cal||0), protein: a.protein + (f.protein||0), carbs: a.carbs + (f.carbs||0), fat: a.fat + (f.fat||0) }), { cal: 0, protein: 0, carbs: 0, fat: 0 });
  const burnedToday = (today.activity || []).reduce((a, x) => a + (x.cal || 0), 0);
  const netToday = Math.round(totals.cal - burnedToday);

  function setDayType(type) {
    const next = { ...store, [TODAY]: { ...today, type } };
    persist(next);
  }

  function addFood() {
    if (!foodForm.name.trim()) return;
    const food = { name: foodForm.name.trim(), cal: parseFloat(foodForm.cal)||0, protein: parseFloat(foodForm.protein)||0, carbs: parseFloat(foodForm.carbs)||0, fat: parseFloat(foodForm.fat)||0 };
    const next = { ...store, [TODAY]: { ...today, foods: [...(today.foods||[]), food] } };
    persist(next);
    setFoodForm({ name: "", cal: "", protein: "", carbs: "", fat: "" });
  }

  function deleteFood(i) {
    const foods = [...(today.foods||[])];
    foods.splice(i, 1);
    persist({ ...store, [TODAY]: { ...today, foods } });
  }

  function saveWeight() {
    const w = parseFloat(weightInput);
    if (isNaN(w) || w < 50 || w > 200) return;
    persist({ ...store, [TODAY]: { ...today, weight: w } });
    setWeightInput("");
  }

  // History
  const allDays = Object.keys(store).sort().reverse();
  const thisWeekDays = allDays.filter(k => (new Date() - new Date(k + "T12:00:00")) / 864e5 <= 7);
  const weekAvgCal = thisWeekDays.length ? Math.round(thisWeekDays.reduce((a,k) => a + (store[k].foods||[]).reduce((s,f) => s + (f.cal||0), 0), 0) / thisWeekDays.length) : 0;
  const weekAvgPro = thisWeekDays.length ? Math.round(thisWeekDays.reduce((a,k) => a + (store[k].foods||[]).reduce((s,f) => s + (f.protein||0), 0), 0) / thisWeekDays.length) : 0;
  const weights = allDays.map(k => ({ date: k, w: store[k]?.weight })).filter(x => x.w);
  const latestWeight = weights.length ? weights[0].w : null;
  const progressPct = latestWeight ? Math.max(0, Math.min(100, Math.round(((100 - latestWeight) / 15) * 100))) : 0;

  // Bench chart data
  const benchData = [
    { name:"B1W1",bar:72.5},{name:"B1W2",bar:75},{name:"B1W3",bar:75},{name:"B1W4",bar:75},
    {name:"B2W1",bar:80},{name:"B2W2",bar:82.5},{name:"B2W3",bar:90},{name:"B2W4",bar:95},
    {name:"B3W1",db:35},{name:"B3W2",bar:90},{name:"B3W3",bar:95},{name:"B3W4",bar:95}
  ];
  const squatData = [
    {name:"B1W1",kg:100},{name:"B1W2",kg:120},{name:"B1W3",kg:130},{name:"B1W4",kg:135},
    {name:"B2W1",kg:80},{name:"B2W2",kg:100},{name:"B2W3",kg:100},{name:"B2W4",kg:100},
    {name:"B3W1",kg:120},{name:"B3W2",kg:100},{name:"B3W3",kg:100},{name:"B3W4",kg:100}
  ];
  const blockPeakData = [
    {lift:"Bench",b1:90,b2:95,b3:95},{lift:"Shoulder*",b1:50,b2:30,b3:30},
    {lift:"Incline/hand",b1:20,b2:30,b3:35},{lift:"Squat",b1:135,b2:100,b3:120},
    {lift:"RDL",b1:100,b2:140,b3:120},{lift:"Hip Thrust",b1:100,b2:null,b3:null},
  ];
  const radarData = NORMS.map(n => ({ subject: n.lift, score: Math.min(130, Math.round((n.best / n.thresholds[1]) * 100)), fullMark: 130 }));

  // Gym data: prefer Supabase (live, updates after each session), fall back to hardcoded.
  const gymBlocks = (store.gym && store.gym.blocks) || GYM_BLOCKS;
  const gymNorms = (store.gym && store.gym.norms) || NORMS;
  const gymPeaks = (store.gym && store.gym.peaks) || null;
  const gymRadar = gymNorms.map(n => ({ subject: n.lift, score: Math.min(130, Math.round((n.best / n.thresholds[1]) * 100)), fullMark: 130 }));

  const weightChartData = [...weights].reverse().map(x => ({ date: fmtDate(x.date), weight: x.w }));

  if (!loaded) return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: MU, fontFamily: "'DM Sans', sans-serif" }}>
      Loading...
    </div>
  );

  // ── STYLES ──
  const s = {
    app: { background: BG, minHeight: "100vh", color: "#f0f2f8", fontFamily: "'DM Sans', sans-serif", paddingBottom: 72 },
    header: { padding: "18px 16px 12px", borderBottom: `1px solid ${BR}`, background: SURF, position: "sticky", top: 0, zIndex: 20 },
    h1: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: Y, lineHeight: 1 },
    headerSub: { fontSize: 11, color: MU, textTransform: "uppercase", letterSpacing: 1, marginTop: 2, display: "flex", alignItems: "center", gap: 8 },
    saveDot: { width: 6, height: 6, borderRadius: "50%", background: saving ? O : G },
    subTabs: { display: "flex", background: SURF, borderBottom: `1px solid ${BR}`, marginBottom: 16, overflowX: "auto" },
    subTab: (active) => ({ flexShrink: 0, padding: "11px 16px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: active ? Y : MU, cursor: "pointer", borderBottom: `2px solid ${active ? Y : "transparent"}`, whiteSpace: "nowrap" }),
    card: { background: CARD, border: `1px solid ${BR}`, borderRadius: 12, padding: 16, marginBottom: 12 },
    cardTitle: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 3 },
    cardSub: { fontSize: 11, color: MU, marginBottom: 14 },
    kpiGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 },
    kpi: (color) => ({ background: CARD, border: `1px solid ${BR}`, borderRadius: 12, padding: 14, borderTop: `3px solid ${color}` }),
    kpiLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: MU, marginBottom: 6 },
    kpiVal: (color) => ({ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, lineHeight: 1, color, marginBottom: 3 }),
    kpiSub: { fontSize: 11, color: MU },
    badge: (color, bg) => ({ display: "inline-block", fontSize: 10, padding: "2px 7px", borderRadius: 20, fontWeight: 600, marginTop: 4, color, background: bg }),
    ringsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 },
    input: { background: BG, border: `1px solid ${BR}`, borderRadius: 8, padding: "9px 11px", color: "#f0f2f8", fontFamily: "'DM Sans', sans-serif", fontSize: 12, width: "100%", outline: "none" },
    addBtn: { gridColumn: "1/-1", background: Y, color: "#000", border: "none", borderRadius: 8, padding: 11, fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: 1, width: "100%" },
    togRow: { display: "flex", gap: 6 },
    togBtn: (active) => ({ padding: "5px 11px", borderRadius: 20, fontSize: 10, fontWeight: 600, border: `1px solid ${active ? Y : BR}`, background: active ? Y : CARD, color: active ? "#000" : MU, cursor: "pointer" }),
    bottomNav: { position: "fixed", bottom: 0, left: 0, right: 0, background: SURF, borderTop: `1px solid ${BR}`, display: "flex", zIndex: 20 },
    bnavItem: (active) => ({ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 4px", cursor: "pointer", color: active ? Y : MU, gap: 3 }),
    goalRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid rgba(42,47,66,.5)` },
    blockBtn: (active) => ({ padding: "8px 16px", borderRadius: 8, border: `1px solid ${active ? Y : BR}`, background: active ? Y : CARD, color: active ? "#000" : MU, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: active ? 700 : 500, cursor: "pointer", textTransform: "uppercase", letterSpacing: 1 }),
    exGrid: { display: "grid", gridTemplateColumns: "1fr", gap: 10 },
  };

  const allExercises = [...(gymBlocks[block]?.upper || []), ...(gymBlocks[block]?.lower || [])];

  return (
    <div style={s.app}>
      {/* HEADER */}
      <header style={s.header}>
        <div style={s.h1}>Andre Boland</div>
        <div style={s.headerSub}>
          <div style={s.saveDot} />
          <span>{saving ? "Saving..." : "Synced"} · Cut 100kg→85kg · Block 4 In Progress</span>
        </div>
      </header>

      {/* NUTRITION */}
      {section === "nutrition" && (
        <div style={{ padding: 16 }}>
          <div style={s.subTabs}>
            {["today","history"].map(t => <div key={t} style={s.subTab(nutritionTab===t)} onClick={() => setNutritionTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</div>)}
          </div>

          {nutritionTab === "today" && (
            <>
              {/* Day type + date */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1 }}>{fmtDate(TODAY)}</div>
                <div style={s.togRow}>
                  <button style={s.togBtn(today.type==="training")} onClick={() => setDayType("training")}>Training</button>
                  <button style={s.togBtn(today.type==="rest")} onClick={() => setDayType("rest")}>Rest</button>
                </div>
              </div>

              {/* Macro rings */}
              <div style={s.ringsGrid}>
                <MacroRing label="Calories" actual={totals.cal} goal={g.cal} color={Y} />
                <MacroRing label="Protein"  actual={totals.protein} goal={g.protein} color={B} />
                <MacroRing label="Carbs"    actual={totals.carbs} goal={g.carbs} color={O} />
                <MacroRing label="Fat"      actual={totals.fat} goal={g.fat} color={G} />
              </div>

              {/* Energy balance */}
              <div style={s.card}>
                <div style={s.cardTitle}>Energy Balance</div>
                <div style={s.cardSub}>Calories in vs out · activity pulled from Strava</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div style={{ background: BG, borderRadius: 8, padding: 12, textAlign: "center" }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: Y, lineHeight: 1 }}>{Math.round(totals.cal)}</div>
                    <div style={{ fontSize: 10, color: MU, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 3 }}>Eaten</div>
                  </div>
                  <div style={{ background: BG, borderRadius: 8, padding: 12, textAlign: "center" }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: O, lineHeight: 1 }}>{burnedToday}</div>
                    <div style={{ fontSize: 10, color: MU, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 3 }}>Burned</div>
                  </div>
                  <div style={{ background: BG, borderRadius: 8, padding: 12, textAlign: "center" }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: G, lineHeight: 1 }}>{netToday}</div>
                    <div style={{ fontSize: 10, color: MU, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 3 }}>Net</div>
                  </div>
                </div>
                {(today.activity || []).length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    {(today.activity || []).map((a, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < today.activity.length - 1 ? `1px solid rgba(42,47,66,.4)` : "none", fontSize: 12 }}>
                        <span style={{ color: "#f0f2f8" }}>{a.name}</span>
                        <span style={{ color: O }}>{a.cal} cal</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Food log */}
              <div style={s.card}>
                <div style={s.cardTitle}>Food Log</div>
                {(today.foods||[]).length === 0 && <div style={{ color: MU, fontSize: 12, textAlign: "center", padding: "16px 0" }}>No food logged yet</div>}
                {(today.foods||[]).map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid rgba(42,47,66,.4)`, gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{f.name}</div>
                    <div style={{ fontSize: 10, color: MU, textAlign: "right", lineHeight: 1.5 }}>
                      <div>{f.cal} cal</div>
                      <div>{f.protein}g P · {f.carbs}g C · {f.fat}g F</div>
                    </div>
                    <button onClick={() => deleteFood(i)} style={{ background: "none", border: "none", color: MU, cursor: "pointer", fontSize: 15, padding: "2px 4px" }}>×</button>
                  </div>
                ))}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                  <input style={{ ...s.input, gridColumn: "1/-1" }} placeholder="Food / meal description" value={foodForm.name} onChange={e => setFoodForm(p => ({...p, name: e.target.value}))} />
                  <input style={s.input} placeholder="Calories" type="number" value={foodForm.cal} onChange={e => setFoodForm(p => ({...p, cal: e.target.value}))} />
                  <input style={s.input} placeholder="Protein (g)" type="number" value={foodForm.protein} onChange={e => setFoodForm(p => ({...p, protein: e.target.value}))} />
                  <input style={s.input} placeholder="Carbs (g)" type="number" value={foodForm.carbs} onChange={e => setFoodForm(p => ({...p, carbs: e.target.value}))} />
                  <input style={s.input} placeholder="Fat (g)" type="number" value={foodForm.fat} onChange={e => setFoodForm(p => ({...p, fat: e.target.value}))} />
                  <button style={s.addBtn} onClick={addFood}>+ Add to Log</button>
                </div>
              </div>

              {/* Weight */}
              <div style={s.card}>
                <div style={s.cardTitle}>Morning Weight</div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input style={s.input} placeholder="e.g. 99.5" type="number" step="0.1" value={weightInput} onChange={e => setWeightInput(e.target.value)} />
                  <button onClick={saveWeight} style={{ background: Y, color: "#000", border: "none", borderRadius: 8, padding: "9px 14px", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Save</button>
                </div>
                {today.weight && <div style={{ fontSize: 12, color: G, marginTop: 8 }}>Today: {today.weight}kg</div>}
              </div>
            </>
          )}

          {nutritionTab === "history" && (
            <>
              <div style={s.card}>
                <div style={s.cardTitle}>This Week</div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  {[{v: weekAvgCal, l:"Avg Cal"},{v: `${weekAvgPro}g`, l:"Avg Protein"},{v: thisWeekDays.length, l:"Days"},{v: latestWeight ? `${latestWeight}kg`:"—", l:"Weight"}].map((x,i) => (
                    <div key={i} style={{ flex: 1, background: BG, borderRadius: 8, padding: 9, textAlign: "center" }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: Y, lineHeight: 1 }}>{x.v}</div>
                      <div style={{ fontSize: 9, color: MU, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>{x.l}</div>
                    </div>
                  ))}
                </div>
              </div>
              {allDays.map(k => {
                const d = store[k]; if (!d) return null;
                const t = (d.foods||[]).reduce((a,f) => ({cal:a.cal+(f.cal||0),protein:a.protein+(f.protein||0),carbs:a.carbs+(f.carbs||0),fat:a.fat+(f.fat||0)}),{cal:0,protein:0,carbs:0,fat:0});
                const dg = GOALS[d.type||"training"];
                const calOk = Math.abs(t.cal - dg.cal) < 150;
                const calOver = t.cal > dg.cal + 150;
                const dBurned = (d.activity||[]).reduce((a,x)=>a+(x.cal||0),0);
                const dNet = Math.round(t.cal - dBurned);
                return (
                  <div key={k} style={{ ...s.card, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{fmtDate(k)}{d.weight ? ` · ${d.weight}kg` : ""}</span>
                      <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, textTransform: "uppercase", fontWeight: 600, background: d.type==="training" ? "rgba(232,255,71,.15)" : "rgba(71,200,255,.15)", color: d.type==="training" ? Y : B }}>{d.type||"training"}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                      {[{v:Math.round(t.cal),l:"Cal",c:calOk?G:calOver?O:B},{v:`${Math.round(t.protein)}g`,l:"Protein",c:t.protein>=180?G:B},{v:`${Math.round(t.carbs)}g`,l:"Carbs",c:"#f0f2f8"},{v:`${Math.round(t.fat)}g`,l:"Fat",c:"#f0f2f8"}].map((x,i) => (
                        <div key={i} style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: x.c, lineHeight: 1 }}>{x.v}</div>
                          <div style={{ fontSize: 9, color: MU }}>{x.l}</div>
                        </div>
                      ))}
                    </div>
                    {dBurned > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: `1px solid rgba(42,47,66,.4)`, fontSize: 11 }}>
                        <span style={{ color: MU }}>🔥 Burned <span style={{ color: O, fontWeight: 600 }}>{dBurned}</span></span>
                        <span style={{ color: MU }}>Net <span style={{ color: G, fontWeight: 600 }}>{dNet}</span></span>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* GYM */}
      {section === "gym" && (
        <div style={{ padding: 16 }}>
          <div style={s.subTabs}>
            {["overview","blocks","norms","journey"].map(t => <div key={t} style={s.subTab(gymTab===t)} onClick={() => setGymTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</div>)}
          </div>

          {gymTab === "overview" && (
            <>
              <div style={s.kpiGrid}>
                {(gymPeaks || [
                  {label:"Bench Peak",val:100,unit:"kg",color:"Y",sub:"Barbell · B4 Wk1 single",badge:"Started 72.5kg",badgeColor:"G"},
                  {label:"Squat Peak",val:135,unit:"kg",color:"B",sub:"B1 · Reset B2/3 depth",badge:"140×9 noted",badgeColor:"B"},
                  {label:"RDL Peak",val:140,unit:"kg",color:"O",sub:"B2 Wk4 · 3 reps",badge:"Started 70kg +100%",badgeColor:"G"},
                  {label:"Hip Thrust",val:100,unit:"kg",color:"G",sub:"B1 Wk4 · Leg Press 260kg",badge:"Started 60kg",badgeColor:"G"},
                ]).map((k, i) => (
                  <div key={i} style={s.kpi(rc(k.color))}>
                    <div style={s.kpiLabel}>{k.label}</div>
                    <div style={s.kpiVal(rc(k.color))}>{k.val}<span style={{fontSize:13}}>{k.unit||"kg"}</span></div>
                    <div style={s.kpiSub}>{k.sub}</div>
                    {k.badge && <span style={s.badge(rc(k.badgeColor), `${rc(k.badgeColor)}26`)}>{k.badge}</span>}
                  </div>
                ))}
              </div>
              <div style={s.card}>
                <div style={s.cardTitle}>Peak Load Per Block</div>
                <div style={s.cardSub}>Barbell = total kg · DB = per hand kg · * B1 shoulder = barbell, B2/3 = DB/hand</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={blockPeakData}>
                    <CartesianGrid stroke={BR} />
                    <XAxis dataKey="lift" tick={{fontSize:10,fill:MU}} />
                    <YAxis tick={{fontSize:10,fill:MU}} />
                    <Tooltip contentStyle={{background:CARD,border:`1px solid ${BR}`,borderRadius:8,fontSize:11}} />
                    <Legend wrapperStyle={{fontSize:11}} />
                    <Bar dataKey="b1" name="Block 1" fill="rgba(255,107,71,.8)" radius={[3,3,0,0]} />
                    <Bar dataKey="b2" name="Block 2" fill="rgba(71,200,255,.8)" radius={[3,3,0,0]} />
                    <Bar dataKey="b3" name="Block 3" fill="rgba(232,255,71,.85)" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={s.card}>
                <div style={s.cardTitle}>Bench Press — Full Journey</div>
                <div style={s.cardSub}>Barbell kg · ★ B3W1 = 35kg DB/hand</div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={benchData}>
                    <CartesianGrid stroke={BR} />
                    <XAxis dataKey="name" tick={{fontSize:9,fill:MU}} />
                    <YAxis tick={{fontSize:9,fill:MU}} domain={[60,100]} />
                    <Tooltip contentStyle={{background:CARD,border:`1px solid ${BR}`,borderRadius:8,fontSize:11}} />
                    <Legend wrapperStyle={{fontSize:11}} />
                    <Line type="monotone" dataKey="bar" name="Barbell" stroke={Y} strokeWidth={2} dot={{r:3,fill:Y}} connectNulls={false} />
                    <Line type="monotone" dataKey="db" name="DB/hand" stroke={B} strokeWidth={0} dot={{r:7,fill:B,strokeWidth:2,stroke:"#fff"}} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={s.card}>
                <div style={s.cardTitle}>Squat — Peak vs Depth Reset</div>
                <div style={s.cardSub}>B1 heavy · B2–3 intentional reset for technique</div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={squatData}>
                    <CartesianGrid stroke={BR} />
                    <XAxis dataKey="name" tick={{fontSize:9,fill:MU}} />
                    <YAxis tick={{fontSize:9,fill:MU}} domain={[60,150]} />
                    <Tooltip contentStyle={{background:CARD,border:`1px solid ${BR}`,borderRadius:8,fontSize:11}} />
                    <Line type="monotone" dataKey="kg" name="Squat kg" stroke={B} strokeWidth={2} dot={{r:3,fill:B}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {gymTab === "blocks" && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {[1,2,3,4].map(b => <button key={b} style={s.blockBtn(block===b)} onClick={() => setBlock(b)}>Block {b}</button>)}
              </div>
              <div style={s.exGrid}>
                {allExercises.map((ex, i) => <ExerciseCard key={i} ex={ex} />)}
              </div>
            </>
          )}

          {gymTab === "norms" && (
            <>
              <div style={{...s.card, fontSize:11, color:MU, background:"rgba(232,255,71,.06)", border:"1px solid rgba(232,255,71,.18)"}}>
                ⚠️ <strong style={{color:Y}}>Approximate norms</strong> — Symmetric Strength / ExRx for 100kg male. Verify at symmetricstrength.com.
              </div>
              <div style={s.card}>
                <div style={s.cardTitle}>vs Population Norms</div>
                <div style={s.cardSub}>Male · 35yrs · 100kg · All-time peaks</div>
                {gymNorms.map((n, i) => {
                  const lv = getLevel(n.best, n.thresholds);
                  return (
                    <div key={i} style={{ padding: "10px 0", borderBottom: `1px solid rgba(42,47,66,.4)` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{n.lift}</div>
                          <div style={{ fontSize: 10, color: MU, fontStyle: "italic" }}>{n.note}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: rc(n.color), lineHeight: 1 }}>{n.best}kg</div>
                          <span style={s.badge(lv.color, `${lv.color}22`)}>{lv.label}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 5, background: BR, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${lv.pct}%`, height: "100%", background: lv.color, borderRadius: 3 }} />
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: lv.color, minWidth: 32, textAlign: "right" }}>{lv.pct}%</div>
                      </div>
                      <div style={{ fontSize: 10, color: MU, marginTop: 4 }}>Novice {n.thresholds[0]}kg · Inter. {n.thresholds[1]}kg · Adv. {n.thresholds[2]}kg</div>
                    </div>
                  );
                })}
              </div>
              <div style={s.card}>
                <div style={s.cardTitle}>Strength Radar</div>
                <div style={s.cardSub}>% of intermediate standard</div>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={gymRadar}>
                    <PolarGrid stroke={BR} />
                    <PolarAngleAxis dataKey="subject" tick={{fontSize:9,fill:MU}} />
                    <Radar name="Andre" dataKey="score" stroke={Y} fill={Y} fillOpacity={0.15} />
                    <Tooltip contentStyle={{background:CARD,border:`1px solid ${BR}`,borderRadius:8,fontSize:11}} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {gymTab === "journey" && (
            <div style={s.card}>
              <div style={s.cardTitle}>Block by Block</div>
              {[
                {cls:"b1",col:O,title:"Block 1 — Heavy Foundation (Nov 2024)",body:"Squat 100→135kg (140×9 noted). RDL 70→100kg. Hip Thrust 60→100kg. Leg Press to 260kg. Bench 72.5→90kg. Barbell shoulder press to 50kg. Heavy compound loading — raw strength base."},
                {cls:"b2",col:B,title:"Block 2 — Reset & Upper Peak (Early 2025)",body:"Squat reset to 80–100kg for depth. RDL peaks at 140kg×3. Bench hits 95kg. Shoulder Press switches to DBs (20→30kg/hand). Cable Row 48→66kg. Technique focus alongside upper body volume."},
                {cls:"b3",col:O,title:"Block 3 — Variation & Consolidation (Complete)",body:"Bench varies: DB 35kg/hand Wk1, barbell 95kg Wk3–4. Incline peaks 35kg/hand. Lateral Raise to 10kg. Squat holds 100kg 5×5 depth. Assisted PU assistance halved (35→20kg)."},
                {cls:"b4",col:Y,title:"Block 4 — Strength Focus (In Progress)",body:"Shift to heavy 5×5 on Bench and Squat. Bench opens at 100kg (5×5) off a 95×1 previous. New accessories: Calf Press, Hammer Curls, Skullcrushers for direct arm and calf volume. Conditioning finishers carry over. PT-programmed, just begun."},
              ].map((b,i) => (
                <div key={i} style={{ display: "flex", gap: 14, marginBottom: 20, position: "relative" }}>
                  {i < 3 && <div style={{ position: "absolute", left: 13, top: 28, bottom: -8, width: 1, background: BR }} />}
                  <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, background: `${b.col}22`, border: `1px solid ${b.col}`, zIndex: 1 }}>{i+1}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{b.title}</div>
                    <div style={{ fontSize: 12, color: MU, lineHeight: 1.55 }}>{b.body}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* GOALS */}
      {section === "goals" && (
        <div style={{ padding: 16 }}>
          {/* Weight progress */}
          <div style={s.card}>
            <div style={s.cardTitle}>Cut Progress</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: MU, minWidth: 36 }}>Start</span>
              <div style={{ flex: 1, height: 7, background: BR, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${progressPct}%`, height: "100%", background: `linear-gradient(90deg,${O},${Y})`, borderRadius: 4 }} />
              </div>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: Y, minWidth: 40, textAlign: "right" }}>{progressPct}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: MU, marginBottom: 14 }}>
              <span>100kg</span><span>Target: 85kg</span>
            </div>
            {weights.length === 0 ? (
              <div style={{ color: MU, fontSize: 12, textAlign: "center", padding: "12px 0" }}>Log morning weight on Nutrition tab</div>
            ) : (
              <>
                {weightChartData.length > 1 && (
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={weightChartData}>
                      <CartesianGrid stroke={BR} />
                      <XAxis dataKey="date" tick={{fontSize:9,fill:MU}} />
                      <YAxis tick={{fontSize:9,fill:MU}} domain={['auto','auto']} />
                      <Tooltip contentStyle={{background:CARD,border:`1px solid ${BR}`,borderRadius:8,fontSize:11}} />
                      <Line type="monotone" dataKey="weight" stroke={B} strokeWidth={2} dot={{r:4,fill:B}} name="Weight (kg)" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                {weights.map((x, i) => {
                  const prev = weights[i + 1];
                  const diff = prev ? (x.w - prev.w).toFixed(1) : null;
                  return (
                    <div key={x.date} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid rgba(42,47,66,.4)`, fontSize: 12 }}>
                      <span style={{ color: MU }}>{fmtDate(x.date)}</span>
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, color: B }}>{x.w}kg</span>
                      {diff && <span style={{ fontSize: 10, fontWeight: 600, color: parseFloat(diff) <= 0 ? G : O }}>{parseFloat(diff) <= 0 ? "▼" : "▲"} {Math.abs(diff)}kg</span>}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Targets */}
          {[{title:"Training Day Targets",type:"training"},{title:"Rest Day Targets",type:"rest"}].map(({title,type}) => (
            <div key={type} style={s.card}>
              <div style={s.cardTitle}>{title}</div>
              {[{l:"Calories",v:type==="training"?"2,200–2,300":"1,900–2,000",c:Y},{l:"Protein",v:"180–200g",c:B},{l:"Carbs",v:type==="training"?"180–220g":"120–150g",c:O},{l:"Fat",v:"60–70g",c:G}].map((r,i,arr) => (
                <div key={i} style={{...s.goalRow, borderBottom: i<arr.length-1?`1px solid rgba(42,47,66,.5)`:"none"}}>
                  <span style={{fontSize:12,color:MU}}>{r.l}</span>
                  <span style={{fontFamily:"'Bebas Neue', sans-serif",fontSize:18,color:r.c}}>{r.v}</span>
                </div>
              ))}
            </div>
          ))}

          <div style={s.card}>
            <div style={s.cardTitle}>Cut Summary</div>
            {[{l:"Start Weight",v:"100kg",c:Y},{l:"Target",v:"85kg",c:B},{l:"To Lose",v:"15kg",c:O},{l:"Rate",v:"~0.5kg/wk",c:G},{l:"Est. Duration",v:"~20 weeks",c:Y},{l:"TDEE Training",v:"~2,870 cal",c:B},{l:"TDEE Rest",v:"~2,660 cal",c:O}].map((r,i,arr) => (
              <div key={i} style={{...s.goalRow, borderBottom: i<arr.length-1?`1px solid rgba(42,47,66,.5)`:"none"}}>
                <span style={{fontSize:12,color:MU}}>{r.l}</span>
                <span style={{fontFamily:"'Bebas Neue', sans-serif",fontSize:18,color:r.c}}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BOTTOM NAV */}
      <nav style={s.bottomNav}>
        {[{id:"nutrition",icon:"🍽️",label:"Nutrition"},{id:"gym",icon:"🏋️",label:"Gym"},{id:"goals",icon:"🎯",label:"Goals"}].map(({id,icon,label}) => (
          <div key={id} style={s.bnavItem(section===id)} onClick={() => setSection(id)}>
            <div style={{fontSize:20}}>{icon}</div>
            <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5}}>{label}</div>
          </div>
        ))}
      </nav>
    </div>
  );
}

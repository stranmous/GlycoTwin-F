// ── GlycoTwin M1–M8 API Types & Data Contracts ─────────────────────────────
// Authors: Waqas Zafar & Arsalan Qasim

// ── M4: Auth & Profile ───────────────────────────────────────────────────────
export type UserProfile = {
  user_id?: string;
  age?: number | null;
  bmi?: number | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  diabetes_type?: string | null;
  diabetic_type?: string | null;
  activity_level?: string | null;
  medications?: Array<string | { name: string; dose?: string | null; schedule?: string | null; notes?: string | null }> | null;
  hba1c?: number | null;
  display_name?: string | null;
  preferred_language?: string;
  active_language?: string;
};

export type AuthUserOut = {
  id: string;
  email: string;
  active_language: string;
  display_name?: string | null;
};

export type AuthTokenOut = {
  user: AuthUserOut;
  access_token: string;
  token_type: string;
};

export type UserOut = {
  id: string;
  email: string;
  display_name: string | null;
  age: number | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  diabetes_type: string | null;
  timezone: string | null;
  preferred_language: string;
  active_language?: string;
  consent_accepted_at: string | null;
  medications: {
    id: string;
    name: string;
    dose: string | null;
    schedule: string | null;
    notes: string | null;
  }[];
};

// ── M2: Digital Twin Calibration ─────────────────────────────────────────────
export type CalibratedState = {
  user_id: string;
  phenotype_cluster_id: string;
  baseline_glucose_mg_dl: number;
  estimated_insulin_sensitivity: number;
  carb_absorption_rate_index: number;
  confidence_score: number;
  is_cold_start: boolean;
  estimation_method?: 'demographic_default' | 'data_fitted' | string;
};

export type CalibrationRequest = {
  user_id: string;
  user_profile: {
    user_id?: string;
    age: number;
    bmi: number;
    diabetic_type: string;
  };
  cgm_readings?: Array<{ glucose_mg_dl: number; timestamp?: string }>;
  meal_records?: Array<{ carbs_g: number; eaten_at?: string }>;
};

// ── M3: Physics Predictive Core (RK45 ODE) ───────────────────────────────────
export type GlucosePoint = {
  t_min: number;
  mgdl: number;
};

export type MealInput = {
  carbohydrates_g: number;
  protein_g?: number;
  fat_g?: number;
  glycemic_index?: number;
};

export type PredictionRequest = {
  calibrated_state: CalibratedState;
  meal_input: MealInput;
  current_glucose_mg_dl?: number;
};

export type PostMealTrajectory = {
  user_id?: string;
  meal_id?: string;
  time_minutes: number[];
  glucose_values_mg_dl: number[];
  peak_glucose_mg_dl: number;
  time_to_peak_minutes: number;
  confidence_interval_lower?: number[];
  confidence_interval_upper?: number[];
  model_version: string; // e.g. "v1.0.0-hybrid-ode"
};

export type PredictionOut = {
  id: string;
  meal_id: string;
  curve: GlucosePoint[];
  peak_mgdl: number;
  peak_at_min: number;
  time_above_range_min: number;
  created_at: string;
  model_version?: string;
};

// ── M5: Volumetric Nutrition Scanner ─────────────────────────────────────────
export type DetectedFoodOut = {
  id: string;
  name_en: string;
  name_ur: string | null;
  portion_g: number;
  carbs_g: number;
  kcal: number;
  confidence: number;
  volume_cm3?: number;
};

export type DishSuggestion = {
  food_id: string;
  label: string;
  score: number;
};

export type MealEstimateItem = {
  segment_id: number;
  requested_label?: string | null;
  food_id?: string | null;
  volume_cm3: number;
  density_g_per_ml?: number | null;
  mass_g: number;
  calories_kcal: number;
  carbs_g: number;
  protein_g: number;
  fat_g: number;
  fiber_g: number;
  public_claim_eligible: boolean;
};

export type NutritionEstimateOut = {
  status: 'estimated' | 'rejected';
  reason?: string | null;
  message: string;
  approximate: boolean;
  vision_mode: 'models' | 'fixture';
  dish?: {
    food_id: string;
    label: string;
  } | null;
  dish_suggestions: DishSuggestion[];
  aggregation?: string | null;
  items: MealEstimateItem[];
  total_volume_cm3?: number | null;
  total_mass_g?: number | null;
  calories_kcal?: number | null;
  carbs_g?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  uncertainty_interval_kcal?: [number, number] | null;
  warnings: string[];
  catalog_data_version: string;
  catalog_status: string;
  confidence?: number | null;
  id?: string;
  image_url?: string | null;
};

// ── M1: Ingestion & History ──────────────────────────────────────────────────
export type MealOut = {
  id: string;
  image_url: string | null;
  eaten_at: string;
  meal_type: string | null;
  total_carbs_g: number;
  total_kcal: number;
  confidence: number;
  user_edited: boolean;
  note: string | null;
  detected_foods: DetectedFoodOut[];
  created_at: string;
};

export type ReadingOut = {
  id?: string;
  glucose_mg_dl: number;
  timestamp: string;
  trend?: string;
};

// ── M6: What-If Simulation Hub ───────────────────────────────────────────────
export type SimulationActivity = {
  name: string;
  duration_minutes: number;
  intensity_factor: number;
};

export type SimulationScenario = {
  meal: {
    carbohydrates_g: number;
    protein_g: number;
    fat_g: number;
    glycemic_index: number;
  };
  activity: SimulationActivity;
};

export type SimulationCompareRequest = {
  calibrated_state: CalibratedState;
  baseline_scenario: SimulationScenario;
  counterfactual_scenario: SimulationScenario;
};

export type SimulationCompareOut = {
  baseline_trajectory: PostMealTrajectory;
  counterfactual_trajectory: PostMealTrajectory;
  delta_metrics: {
    delta_peak_glucose_mg_dl: number;
    delta_iauc_mg_dl_min: number;
    delta_tar_min?: number;
  };
};

export type SimulationInputs = {
  portion_scale: number;
  walk_minutes: number;
  intensity: 'light' | 'moderate';
  timing_offset_min: number;
};

export type SimulationOut = {
  id: string;
  meal_id: string;
  inputs: SimulationInputs;
  baseline_curve: GlucosePoint[];
  simulated_curve: GlucosePoint[];
  delta_peak_mgdl: number;
  delta_tar_min: number;
};

// ── M7: Insights & Time-In-Range ─────────────────────────────────────────────
export type TirSummary = {
  in_range_pct: number;
  above_range_pct: number;
  below_range_pct: number;
  sample_count: number;
  mean_mg_dl?: number;
  gmi_pct?: number; // estimated A1c
};

export type SpikeMeal = {
  meal_id: string;
  label: string;
  peak_mgdl: number;
};

export type InsightCard = {
  id: string;
  title_en: string;
  title_ur: string | null;
  body_en: string;
  body_ur: string | null;
  severity: 'info' | 'good' | 'warn';
};

export type InsightsSummary = {
  window: 'today' | '7d' | '30d';
  tir: TirSummary;
  avg_peak_by_meal_type: Record<string, number>;
  top_spike_meals: SpikeMeal[];
  cards: InsightCard[];
};

export type TirCalculationRequest = {
  readings: Array<{ glucose_mg_dl: number; timestamp?: string }>;
  low?: number;
  high?: number;
};

export type TirCalculationOut = {
  in_range_pct: number;
  below_pct: number;
  above_pct: number;
  mean_mg_dl: number;
  gmi_pct: number;
  sample_count: number;
};

// ── M8: AI Coach RAG ─────────────────────────────────────────────────────────
export type MiniChart = {
  kind: 'bar' | 'line' | 'compare';
  series: Record<string, unknown>[];
};

export type CoachQueryRequest = {
  user_id?: string;
  query_text: string;
  language: 'en' | 'ur' | string;
  meal_context?: {
    meal_name: string;
    carbs_g: number;
    meal_id?: string;
  } | null;
  trajectory_summary?: {
    peak_glucose_mg_dl: number;
    time_to_peak_min: number;
    iauc?: number;
  } | null;
};

export type CoachReply = {
  id: string;
  text: string;
  response_text?: string;
  language: string;
  safety_category: 'ok' | 'refused_dosage' | 'refused_diagnosis' | 'refused_emergency' | 'refused_offtopic';
  sources_referenced?: string[];
  safety_passed?: boolean;
  disclaimer_included?: boolean;
  refs?: Record<string, unknown>[];
  mini_chart?: MiniChart | null;
  follow_ups?: string[];
  created_at?: string;
};

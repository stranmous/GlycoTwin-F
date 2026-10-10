export type DetectedFoodOut = {
  id: string;
  name_en: string;
  name_ur: string | null;
  portion_g: number;
  carbs_g: number;
  kcal: number;
  confidence: number;
};

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

export type GlucosePoint = {
  t_min: number;
  mgdl: number;
};

export type PredictionOut = {
  id: string;
  meal_id: string;
  curve: GlucosePoint[];
  peak_mgdl: number;
  peak_at_min: number;
  time_above_range_min: number;
  created_at: string;
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

export type TirSummary = {
  in_range_pct: number;
  above_range_pct: number;
  below_range_pct: number;
  sample_count: number;
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

export type MiniChart = {
  kind: 'bar' | 'line' | 'compare';
  series: Record<string, unknown>[];
};

export type CoachReply = {
  id: string;
  text: string;
  language: string;
  safety_category: 'ok' | 'refused_dosage' | 'refused_diagnosis' | 'refused_emergency';
  refs: Record<string, unknown>[];
  mini_chart: MiniChart | null;
  follow_ups: string[];
  created_at: string;
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
  consent_accepted_at: string | null;
  medications: {
    id: string;
    name: string;
    dose: string | null;
    schedule: string | null;
    notes: string | null;
  }[];
};

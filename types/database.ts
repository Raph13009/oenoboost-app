export type WineRegion = {
  id: string;
  slug: string;
  name_fr: string;
  name_en: string;
  department_count: number | null;
  area_hectares: number | null;
  total_production_hl: number | null;
  main_grapes_fr: string | null;
  main_grapes_en: string | null;
  geojson: unknown | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
  color_hex: string | null;
  map_order: number | null;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type WineSubregion = {
  id: string;
  region_id: string;
  slug: string;
  name_fr: string;
  name_en: string;
  area_hectares: number | null;
  description_fr: string | null;
  description_en: string | null;
  geojson: unknown | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
  map_order: number | null;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Appellation = {
  id: string;
  subregion_id: string;
  slug: string;
  name_fr: string;
  name_en: string;
  area_hectares: number | null;
  producer_count: number | null;
  production_volume_hl: number | null;
  price_range_min_eur: number | null;
  price_range_max_eur: number | null;
  history_fr: string | null;
  history_en: string | null;
  colors_grapes_fr: string | null;
  colors_grapes_en: string | null;
  soils_description_fr: string | null;
  soils_description_en: string | null;
  geojson: unknown | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
  is_premium: boolean;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Favorite = {
  id: string;
  user_id: string;
  content_type: string;
  content_id: string;
  module: string;
  created_at: string;
};

export type Grape = {
  id: string;
  slug: string;
  name_fr: string;
  name_en: string;
  type: "red" | "white" | "rose";
  origin_country: string | null;
  origin_region_fr: string | null;
  origin_region_en: string | null;
  origin_latitude: number | null;
  origin_longitude: number | null;
  history_fr: string | null;
  history_en: string | null;
  crossings_fr: string | null;
  crossings_en: string | null;
  production_regions_fr: string | null;
  production_regions_en: string | null;
  /** English country names where the grape is grown (JSONB array). */
  production_countries: string[] | null;
  viticultural_traits_fr: string | null;
  viticultural_traits_en: string | null;
  tasting_traits_fr: string | null;
  tasting_traits_en: string | null;
  emblematic_wines_fr: string | null;
  emblematic_wines_en: string | null;
  is_premium: boolean;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SoilType = {
  id: string;
  slug: string;
  name_fr: string;
  geological_origin_fr: string | null;
  regions_fr: string | null;
  mineral_composition_fr: string | null;
  wine_influence_fr: string | null;
  photo_url: string | null;
  carousel_order: number | null;
  is_premium: boolean;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type VinificationType = {
  id: string;
  slug: string;
  name_fr: string;
  name_en: string;
  illustration_url: string | null;
  carousel_order: number | null;
  is_premium: boolean;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type VinificationStep = {
  id: string;
  vinification_type_id: string;
  step_order: number;
  icon_url: string | null;
  title_fr: string;
  title_en: string;
  summary_fr: string | null;
  summary_en: string | null;
  detail_fr: string | null;
  detail_en: string | null;
  created_at: string;
  updated_at: string;
};

export type QuizType = "beginner" | "intermediate" | "expert";
export type QuizOptionKey = "a" | "b" | "c" | "d";

export type Quiz = {
  id: string;
  type: QuizType;
  theme: string | null;
  title_fr: string;
  title_en: string;
  description_fr: string | null;
  description_en: string | null;
  question_count: number | null;
  duration_sec: number | null;
  is_premium: boolean;
  status: string;
  created_at: string;
  updated_at: string;
};

export type QuizQuestion = {
  id: string;
  type: QuizType;
  theme: string | null;
  question_fr: string;
  question_en: string;
  option_a_fr: string;
  option_a_en: string;
  option_b_fr: string;
  option_b_en: string;
  option_c_fr: string;
  option_c_en: string;
  option_d_fr: string;
  option_d_en: string;
  correct_option: QuizOptionKey;
  explanation_fr: string | null;
  explanation_en: string | null;
  related_module: string | null;
  scheduled_date: string | null;
  is_premium: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  difficulty: string | null;
};

export type QuizQuestionLink = {
  quiz_id: string;
  question_id: string;
  position: number;
};

export type QuizSession = {
  id: string;
  user_id: string;
  quiz_type: QuizType;
  quiz_id: string;
  total: number;
  score: number | null;
  score_pct: number | null;
  completed_at: string | null;
  xp_awarded: boolean;
  created_at: string;
};

export type QuizSessionInsert = Omit<
  QuizSession,
  "id" | "score" | "score_pct" | "completed_at" | "xp_awarded" | "created_at"
>;

export type QuizAnswer = {
  id: string;
  session_id: string;
  question_id: string;
  selected_option: QuizOptionKey;
  is_correct: boolean;
  answered_at: string;
};

export type QuizAnswerInsert = Omit<QuizAnswer, "id">;

export type DictionaryTerm = {
  id: string;
  slug: string;
  term_fr: string;
  term_en: string;
  definition_fr: string;
  definition_en: string;
  examples_fr: string | null;
  examples_en: string | null;
  etymology_fr: string | null;
  etymology_en: string | null;
  /** Module slugs, e.g. `["vinification","sols"]` */
  related_modules: string[] | null;
  is_word_of_day: boolean;
  is_premium: boolean;
  free_order: number | null;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Ligne `tasting_sheets` (schéma aligné migrations). */
export type TastingSheet = {
  id: string;
  user_id: string;
  eye_color: string | null;
  eye_robe: string | null;
  eye_intensity: string | null;
  eye_tears: string | null;
  eye_notes: string | null;
  nose_first_nose: string | null;
  nose_second_nose: string | null;
  nose_aroma_families: string[] | null;
  nose_intensity: string | null;
  nose_notes: string | null;
  mouth_attack: string | null;
  mouth_mid: string | null;
  mouth_finish: string | null;
  mouth_acidity: number | null;
  mouth_tannins: number | null;
  mouth_alcohol: number | null;
  mouth_sugar: number | null;
  mouth_length_caudalie: number | null;
  mouth_notes: string | null;
  wine_name: string | null;
  vintage: number | null;
  created_at: string;
  updated_at: string;
};

export type TastingSheetInsert = Omit<
  TastingSheet,
  "id" | "user_id" | "created_at" | "updated_at"
>;

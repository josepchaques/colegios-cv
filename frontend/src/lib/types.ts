export interface UserPreferences {
  stem: number;
  sports: number;
  arts: number;
  english: number;
  valencian: number;
  bilingual: number;
  montessori: number;
  traditional: number;
  religion: number;
  inclusion: number;
}

export interface Weights {
  user_fit: number;
  distance: number;
  cost: number;
  quality: number;
  reviews: number;
}

export interface RecommendRequest {
  lat: number;
  lon: number;
  monthly_salary: number;
  school_types?: string[];
  school_levels?: string[];
  preferences: Partial<UserPreferences>;
  weights?: Partial<Weights>;
  max_distance_km: number;
  limit?: number;
}

export interface ScoreBreakdown {
  final: number;
  preference_match: number;
  distance: number;
  affordability: number;
  objective_quality: number;
  review: number;
}

export interface RecommendedSchool {
  id: number;
  name: string;
  code?: string;
  address?: string;
  city?: string;
  district?: string;
  lat: number;
  lon: number;
  school_type: "public" | "concertado" | "private";
  methodology?: string;
  levels: string[];
  monthly_fee_min: number;
  monthly_fee_max: number;
  monthly_fee_avg: number;
  google_rating: number;
  google_review_count: number;
  website?: string;
  logo_url?: string;
  extra_activities: string[];
  scores: ScoreBreakdown;
  explanation: Record<string, string>;
  weaknesses: Record<string, string>;
}

export interface RecommendResponse {
  results: RecommendedSchool[];
  total: number;
  query_profile: Record<string, unknown>;
}

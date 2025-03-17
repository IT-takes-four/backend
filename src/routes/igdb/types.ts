export interface IGDBWebsite {
  id: number;
  type: string | { id: number; type: string };
  url: string;
  trusted: boolean;
}

export interface IGDBGameResponse {
  id: number;
  name: string;
  slug: string;
  created_at?: number;
  first_release_date?: number;
  total_rating?: number;
  summary?: string;
  storyline?: string;
  url?: string;
  cover?: {
    id: number;
    image_id: string;
    width?: number;
    height?: number;
  };
  screenshots?: Array<{
    id: number;
    image_id: string;
    width?: number;
    height?: number;
  }>;
  genres?: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  platforms?: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  game_modes?: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  websites?: IGDBWebsite[];
  involved_companies?: Array<{
    id: number;
    company: {
      id: number;
      name: string;
      slug: string;
    };
  }>;
  game_type?: {
    id: number;
    type: string;
  };
  similar_games?: number[];
  keywords?: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
}

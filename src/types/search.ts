export type SearchResultType = "contact" | "template" | "company";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  icon?: string;
  url?: string;
}

export interface SearchState {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  selectedCategory?: SearchResultType;
}

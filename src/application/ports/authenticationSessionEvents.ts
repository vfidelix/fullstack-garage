export interface AuthenticationSessionEvents {
  subscribe(listener: () => void): () => void;
}

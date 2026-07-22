export type AccessTokenResult
  = | { readonly status: 'available'; readonly accessToken: string }
    | { readonly status: 'unauthenticated' }
    | { readonly status: 'temporary_unavailable' };

export interface AccessTokenProvider {
  getAccessToken(): Promise<AccessTokenResult>;
}

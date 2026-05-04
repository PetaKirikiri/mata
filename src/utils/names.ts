type NamedProfile = {
  display_name?: string | null;
  email?: string | null;
};

export function profileName(profile: NamedProfile | null | undefined, fallback = 'User'): string {
  return profile?.display_name?.trim() || profile?.email?.split('@')[0] || fallback;
}

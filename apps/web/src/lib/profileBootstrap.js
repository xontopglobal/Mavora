export async function ensureProfileRow({ userId, displayName, findProfile, createProfile }) {
  if (!userId || typeof findProfile !== 'function' || typeof createProfile !== 'function') {
    throw new Error('Profile bootstrap requires an authenticated user and data operations.');
  }

  const existing = await findProfile();
  if (existing) return existing;

  try {
    return await createProfile({ id: userId, display_name: displayName || null });
  } catch (error) {
    // Another request or the auth trigger may have inserted the row first.
    if (error?.code !== '23505') throw error;
    const racedProfile = await findProfile();
    if (racedProfile) return racedProfile;
    throw error;
  }
}
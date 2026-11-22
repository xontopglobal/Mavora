// Owns the upload → signed read URL → profile pointer sequence. Once the
// pointer update starts, a client-side error cannot prove that the request
// did not commit, so the new object is deliberately retained on any failure.
export async function uploadAvatarAndSetPointer({
  upload,
  createSignedUrl,
  updatePointer,
  removeObject,
  objectPath
}) {
  const { error: uploadError } = await upload();
  if (uploadError) throw uploadError;

  const { data: signedData, error: signedError } = await createSignedUrl();
  if (signedError) {
    // The pointer update has not started, so this object cannot be referenced
    // by this flow. Cleanup failure is harmless and must not hide the URL error.
    try {
      await removeObject(objectPath);
    } catch {
      // Keep the original signed-URL error; an orphan is safer than a broken link.
    }
    throw signedError;
  }

  const { data, error } = await updatePointer();
  if (error) throw error;

  return { profile: data, signedUrl: signedData.signedUrl };
}

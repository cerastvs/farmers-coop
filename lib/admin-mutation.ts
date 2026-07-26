interface RunAdminMutationOptions {
  request: () => Promise<void>;
  refresh: () => Promise<void>;
  onSuccess: () => void;
  onError: (error: unknown) => void;
}

export async function runAdminMutation({
  request,
  refresh,
  onSuccess,
  onError,
}: RunAdminMutationOptions) {
  try {
    await request();
    onSuccess();
    await refresh();
  } catch (error) {
    onError(error);
    await refresh();
  }
}

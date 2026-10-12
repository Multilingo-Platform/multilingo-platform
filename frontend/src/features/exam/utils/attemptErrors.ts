interface AttemptError {
  code?: unknown;
  response?: { status?: number; data?: { code?: unknown } };
}

export function isVersionConflict(error: unknown): boolean {
  const value = error as AttemptError | null;
  return value?.code === 1601 || value?.response?.data?.code === 1601;
}

export function isHttpConflict(error: unknown): boolean {
  const value = error as AttemptError | null;
  return value?.response?.status === 409 || value?.code === 409 || value?.response?.data?.code === 409;
}

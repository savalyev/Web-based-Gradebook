import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

/** Extracts a human-readable message from an axios error. */
export function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as any)?.error ?? err.message;
  }
  return 'Неизвестная ошибка';
}

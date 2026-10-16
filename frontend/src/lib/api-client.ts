import { API_URL } from './env';

export interface HealthResponse {
  status: string;
  timestamp: string;
  service: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

interface ApiErrorBody {
  success?: boolean;
  message?: string;
  error?: { code?: string };
}

/**
 * Error thrown for any non-2xx API response or network failure. Carries the
 * HTTP status and optional backend error code so callers can react to 401/403/
 * 404/5xx without inspecting raw responses.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const defaultMessageForStatus = (status: number): string => {
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status === 404) return 'The requested resource was not found.';
  if (status >= 500) return 'The server is unavailable. Please try again shortly.';
  return 'Request failed';
};

async function request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiError(0, 'Unable to reach the server. Please check your connection.');
  }

  let body: ApiErrorBody | ApiResponse<T> | null = null;
  try {
    body = (await response.json()) as ApiErrorBody | ApiResponse<T>;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const errorBody = (body ?? {}) as ApiErrorBody;
    throw new ApiError(
      response.status,
      errorBody.message || defaultMessageForStatus(response.status),
      errorBody.error?.code
    );
  }

  return (body ?? { success: true, message: 'OK' }) as ApiResponse<T>;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  department?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export async function checkHealth(): Promise<HealthResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/health`, { cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'Unable to reach the server.');
  }

  if (!response.ok) {
    throw new ApiError(response.status, defaultMessageForStatus(response.status));
  }

  return response.json();
}

export async function register(data: {
  name: string;
  email: string;
  password: string;
  department?: string;
}): Promise<ApiResponse<AuthResponse>> {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function login(data: {
  email: string;
  password: string;
}): Promise<ApiResponse<AuthResponse>> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function getMe(token: string): Promise<ApiResponse<User>> {
  return request<User>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
}

export type DocumentStatus = 'uploaded' | 'processing' | 'processed' | 'failed';
export type DocumentAccessLevel = 'public' | 'restricted';

export interface DocumentRecord {
  id: string;
  name: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  department?: string;
  accessLevel: DocumentAccessLevel;
  allowedDepartments: string[];
  status: DocumentStatus;
  chunkCount: number;
  processingError?: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DocumentListResponse {
  documents: DocumentRecord[];
  pagination: Pagination;
}

export interface SourceCitation {
  documentId: string;
  documentName: string;
  chunkId: string;
  pageNumber?: number;
  sectionTitle?: string;
  excerpt: string;
}

export interface ChatAnswer {
  conversationId: string;
  answer: string;
  sources: SourceCitation[];
}

export async function listDocuments(
  token: string,
  params: { page?: number; limit?: number; status?: DocumentStatus } = {}
): Promise<ApiResponse<DocumentListResponse>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request<DocumentListResponse>(`/documents${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
}

export async function uploadDocument(
  token: string,
  formData: FormData
): Promise<ApiResponse<DocumentRecord>> {
  return request<DocumentRecord>('/documents/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
}

export async function deleteDocument(
  token: string,
  id: string
): Promise<ApiResponse<null>> {
  return request<null>(`/documents/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function askQuestion(
  token: string,
  data: { question: string; conversationId?: string | null }
): Promise<ApiResponse<ChatAnswer>> {
  return request<ChatAnswer>('/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

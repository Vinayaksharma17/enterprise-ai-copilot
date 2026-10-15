import { API_URL } from './env';

export interface HealthResponse {
  status: string;
  timestamp: string;
  service: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
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
  const response = await fetch(`${API_URL}/health`, {
    cache: 'no-store',
  });
  
  if (!response.ok) {
    throw new Error('Health check failed');
  }
  
  return response.json();
}

export async function register(data: {
  name: string;
  email: string;
  password: string;
  department?: string;
}): Promise<ApiResponse<AuthResponse>> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  return response.json();
}

export async function login(data: {
  email: string;
  password: string;
}): Promise<ApiResponse<AuthResponse>> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  return response.json();
}

export async function getMe(token: string): Promise<ApiResponse<User>> {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    cache: 'no-store',
  });
  
  return response.json();
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
  const response = await fetch(`${API_URL}/documents${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  return response.json();
}

export async function uploadDocument(
  token: string,
  formData: FormData
): Promise<ApiResponse<DocumentRecord>> {
  const response = await fetch(`${API_URL}/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  return response.json();
}

export async function deleteDocument(
  token: string,
  id: string
): Promise<ApiResponse<null>> {
  const response = await fetch(`${API_URL}/documents/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.json();
}

export async function askQuestion(
  token: string,
  data: { question: string; conversationId?: string | null }
): Promise<ApiResponse<ChatAnswer>> {
  const response = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return response.json();
}

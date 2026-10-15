'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  deleteDocument,
  DocumentRecord,
  DocumentStatus,
  listDocuments,
  uploadDocument,
  User,
} from '@/lib/api-client';

const statusStyles: Record<DocumentStatus, string> = {
  uploaded: 'bg-gray-100 text-gray-700',
  processing: 'bg-yellow-100 text-yellow-800',
  processed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function DocumentsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [accessLevel, setAccessLevel] = useState<'public' | 'restricted'>('public');
  const [department, setDepartment] = useState('');
  const [allowedDepartments, setAllowedDepartments] = useState('');
  const [uploading, setUploading] = useState(false);

  const loadDocuments = useCallback(async (authToken: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await listDocuments(authToken, { limit: 50 });
      if (response.success && response.data) {
        setDocuments(response.data.documents);
      } else {
        setError(response.message || 'Failed to load documents');
      }
    } catch {
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedToken = sessionStorage.getItem('token');
    const storedUser = sessionStorage.getItem('user');
    if (!storedToken) {
      router.push('/login');
      return;
    }
    setToken(storedToken);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser) as User);
      } catch {
        setUser(null);
      }
    }
    loadDocuments(storedToken);
  }, [router, loadDocuments]);

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !file) {
      setNotice('Please choose a PDF or TXT file to upload.');
      return;
    }

    setUploading(true);
    setNotice('');
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('accessLevel', accessLevel);
    if (department) formData.append('department', department);
    if (accessLevel === 'restricted' && allowedDepartments) {
      formData.append('allowedDepartments', allowedDepartments);
    }

    try {
      const response = await uploadDocument(token, formData);
      if (response.success && response.data) {
        if (response.data.status === 'failed') {
          setNotice(
            `Upload failed during processing: ${response.data.processingError ?? 'unknown error'}`
          );
        } else {
          setNotice(`Uploaded "${response.data.name}" (${response.data.status}).`);
        }
        setFile(null);
        const input = document.getElementById('document-file') as HTMLInputElement | null;
        if (input) input.value = '';
        await loadDocuments(token);
      } else {
        setNotice(response.message || 'Upload failed');
      }
    } catch {
      setNotice('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    setNotice('');
    try {
      const response = await deleteDocument(token, id);
      if (response.success) {
        setNotice('Document deleted.');
        await loadDocuments(token);
      } else {
        setNotice(response.message || 'Failed to delete document');
      }
    } catch {
      setNotice('Failed to delete document');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold text-gray-900">Knowledge Base</h1>
            <nav className="flex gap-4 text-sm text-gray-600">
              <Link href="/documents" className="font-medium text-gray-900">
                Documents
              </Link>
              <Link href="/chat" className="hover:text-gray-900">
                Chat
              </Link>
              <Link href="/profile" className="hover:text-gray-900">
                Profile
              </Link>
            </nav>
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-gray-900">
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        {user?.role === 'admin' && (
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">Upload a document</h2>
            <form className="mt-4 space-y-4" onSubmit={handleUpload}>
              <div>
                <label htmlFor="document-file" className="block text-sm font-medium text-gray-700">
                  File (PDF or TXT, max 10 MB)
                </label>
                <input
                  id="document-file"
                  type="file"
                  accept=".pdf,.txt,application/pdf,text/plain"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="mt-1 block w-full text-sm text-gray-700"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="access-level" className="block text-sm font-medium text-gray-700">
                    Access level
                  </label>
                  <select
                    id="access-level"
                    value={accessLevel}
                    onChange={(e) => setAccessLevel(e.target.value as 'public' | 'restricted')}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="public">public</option>
                    <option value="restricted">restricted</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                    Owning department
                  </label>
                  <input
                    id="department"
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                {accessLevel === 'restricted' && (
                  <div>
                    <label
                      htmlFor="allowed-departments"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Allowed departments
                    </label>
                    <input
                      id="allowed-departments"
                      type="text"
                      placeholder="Comma separated"
                      value={allowedDepartments}
                      onChange={(e) => setAllowedDepartments(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={uploading}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {uploading ? 'Uploading and processing...' : 'Upload'}
              </button>
            </form>
          </section>
        )}

        {notice && (
          <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-800">{notice}</div>
        )}
        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">Available documents</h2>
          </div>

          {loading ? (
            <div className="px-6 py-10 text-center text-sm text-gray-500">Loading documents...</div>
          ) : documents.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-500">
              No documents available yet.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-start justify-between gap-4 px-6 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">{doc.name}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {doc.mimeType} &middot; {formatSize(doc.size)} &middot;{' '}
                      {doc.chunkCount} chunk{doc.chunkCount === 1 ? '' : 's'}
                      {doc.department ? ` · ${doc.department}` : ''}
                    </p>
                    {doc.status === 'failed' && doc.processingError && (
                      <p className="mt-1 text-xs text-red-600">{doc.processingError}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-gray-500">{doc.accessLevel}</span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${statusStyles[doc.status]}`}
                    >
                      {doc.status}
                    </span>
                    {user?.role === 'admin' && (
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

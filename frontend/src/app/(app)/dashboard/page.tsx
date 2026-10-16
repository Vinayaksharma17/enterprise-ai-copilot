'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <p className="text-sm text-gray-500">
        We could not load your profile. Please refresh the page.
      </p>
    );
  }

  const isAdmin = user.role === 'admin';

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {user.name}</h1>
        <p className="mt-2 text-sm text-gray-600">
          You are signed in as{' '}
          <span className="font-medium capitalize text-gray-900">{user.role}</span>
          {user.department ? ` · ${user.department}` : ''}.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/chat"
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-gray-400"
        >
          <h2 className="text-base font-semibold text-gray-900">Ask a question</h2>
          <p className="mt-2 text-sm text-gray-600">
            Get answers grounded in your documents, with source citations.
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-gray-900">
            Start chatting &rarr;
          </span>
        </Link>

        <Link
          href="/documents"
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-gray-400"
        >
          <h2 className="text-base font-semibold text-gray-900">Knowledge base</h2>
          <p className="mt-2 text-sm text-gray-600">
            Browse documents you have access to and their processing status.
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-gray-900">
            View documents &rarr;
          </span>
        </Link>

        <Link
          href="/profile"
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-gray-400"
        >
          <h2 className="text-base font-semibold text-gray-900">Profile</h2>
          <p className="mt-2 text-sm text-gray-600">
            Review your account details, role, and department.
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-gray-900">
            Open profile &rarr;
          </span>
        </Link>
      </section>

      {isAdmin && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Administrator tools</h2>
          <p className="mt-2 text-sm text-gray-600">
            Upload PDF or TXT documents to the knowledge base, set their access level, and
            remove documents. Only administrators can see these controls.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/documents"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
            >
              Upload a document
            </Link>
            <Link
              href="/documents"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 hover:bg-gray-50"
            >
              Manage documents
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

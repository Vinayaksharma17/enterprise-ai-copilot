'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { checkHealth, HealthResponse } from '@/lib/api-client';

type Status = 'loading' | 'connected' | 'unavailable';

export default function Home() {
  const [status, setStatus] = useState<Status>('loading');
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);

  useEffect(() => {
    async function checkBackend() {
      try {
        const data = await checkHealth();
        setHealthData(data);
        setStatus('connected');
      } catch (error) {
        console.error('Backend connectivity check failed:', error);
        setStatus('unavailable');
      }
    }

    checkBackend();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 px-4">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Enterprise AI Knowledge & Support Copilot
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          An enterprise knowledge assistant for document search, AI question answering, and source citations.
          Upload organizational documents, ask natural-language questions, and receive AI-generated answers grounded in retrieved document chunks with source citations.
        </p>
        
        <div className="mt-8 flex justify-center space-x-4">
          <Link href="/login" className="rounded-md bg-gray-900 px-6 py-3 text-white hover:bg-gray-800">
            Sign In
          </Link>
          <Link href="/register" className="rounded-md border border-gray-300 bg-white px-6 py-3 text-gray-900 hover:bg-gray-50">
            Register
          </Link>
        </div>
        
        <div className="mt-10">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Backend Connectivity</h2>
            <div className="mt-4">
              {status === 'loading' && (
                <div className="flex items-center justify-center space-x-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-gray-900"></div>
                  <span className="text-gray-600">Checking connection...</span>
                </div>
              )}
              {status === 'connected' && (
                <div className="flex items-center justify-center space-x-2">
                  <div className="h-4 w-4 rounded-full bg-green-500"></div>
                  <span className="text-green-700">
                    Connected - Service: {healthData?.service}
                  </span>
                </div>
              )}
              {status === 'unavailable' && (
                <div className="flex items-center justify-center space-x-2">
                  <div className="h-4 w-4 rounded-full bg-red-500"></div>
                  <span className="text-red-700">Backend unavailable</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

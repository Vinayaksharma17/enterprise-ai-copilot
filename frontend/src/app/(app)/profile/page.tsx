'use client';

import { useAuth } from '@/lib/auth';

export default function ProfilePage() {
  const { user, loadingUser, error } = useAuth();

  if (loadingUser) {
    return <p className="text-sm text-gray-500">Loading your profile...</p>;
  }

  if (!user) {
    return (
      <p className="text-sm text-gray-500">
        {error || 'Your profile is unavailable right now. Please refresh the page.'}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
      <div className="mt-6 space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label className="text-sm font-medium text-gray-500">Name</label>
          <p className="text-gray-900">{user.name}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-500">Email</label>
          <p className="text-gray-900">{user.email}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-500">Role</label>
          <p className="text-gray-900 capitalize">{user.role}</p>
        </div>
        {user.department && (
          <div>
            <label className="text-sm font-medium text-gray-500">Department</label>
            <p className="text-gray-900">{user.department}</p>
          </div>
        )}
        <div>
          <label className="text-sm font-medium text-gray-500">Status</label>
          <p className="text-gray-900">{user.isActive ? 'Active' : 'Inactive'}</p>
        </div>
      </div>
    </div>
  );
}

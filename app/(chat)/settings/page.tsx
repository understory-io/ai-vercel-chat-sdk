import { auth } from '@/app/(auth)/auth';
import { redirect } from 'next/navigation';
import { ApiKeysManager } from '@/components/api-keys-manager';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="flex items-start justify-center min-h-dvh bg-background py-12 px-4">
      <div className="w-full max-w-2xl flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold dark:text-zinc-50">Settings</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            Manage your API keys for programmatic access
          </p>
        </div>
        <ApiKeysManager />
      </div>
    </div>
  );
}

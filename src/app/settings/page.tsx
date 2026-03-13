'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { PageHeader } from '@/components/ui';
import { useElectionSettings } from '@/lib/hooks';
import { Calendar } from 'lucide-react';

export default function SettingsPage() {
  const { settings, loading, update } = useElectionSettings();
  const [pollingDate, setPollingDate] = useState(settings?.polling_date || '');
  const [countingDate, setCountingDate] = useState(settings?.counting_date || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setPollingDate(settings.polling_date || '');
      setCountingDate(settings.counting_date || '');
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await update(pollingDate || null, countingDate || null);
      setMessage('Election dates saved. All relative activities have been resolved to these dates. Visit Activities or Gantt to see updated schedules.');
    } catch (err) {
      setMessage('Failed to save.');
    }
    setSaving(false);
  };

  return (
    <AppShell>
      <div className="px-8 py-6 max-w-xl">
        <PageHeader
          title="Election Dates"
          subtitle="Set Polling Day and Counting Day. All relative activities (P-2, C-1, etc.) resolve to these dates. When the actual date is announced, change it here and save—relative dates will update accordingly."
        />

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="polling" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Polling Day (P)
                </label>
                <input
                  id="polling"
                  type="date"
                  value={pollingDate}
                  onChange={(e) => setPollingDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  P-2, P-1, P+1, etc. resolve to dates relative to this. Change when actual date is announced.
                </p>
              </div>
              <div>
                <label htmlFor="counting" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Counting Day (C)
                </label>
                <input
                  id="counting"
                  type="date"
                  value={countingDate}
                  onChange={(e) => setCountingDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  C-1, C+1, etc. resolve to dates relative to this. Change when actual date is announced.
                </p>
              </div>
            </div>
          </div>

          {message && (
            <div
              className={`p-4 rounded-lg text-sm ${message.startsWith('Failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-60 transition-colors"
          >
            <Calendar size={18} />
            {saving ? 'Saving...' : 'Save & Resolve Activities'}
          </button>
        </form>
      </div>
    </AppShell>
  );
}

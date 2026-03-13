'use client';

import { useState, useEffect } from 'react';
import type { Cell, CellFormData } from '@/types';

const PRESET_COLORS = [
  '#1E40AF', '#047857', '#B45309', '#7C3AED', '#DC2626',
  '#0891B2', '#4F46E5', '#059669', '#D97706', '#E11D48',
  '#8B5CF6', '#0D9488', '#BE185D',
];

interface CellFormProps {
  cell?: Cell | null;
  onSubmit: (data: CellFormData, id?: string) => Promise<void>;
  onCancel: () => void;
}

export default function CellForm({ cell, onSubmit, onCancel }: CellFormProps) {
  const [form, setForm] = useState<CellFormData>({
    name: '',
    short_code: '',
    description: '',
    head_officer: '',
    contact_phone: '',
    contact_email: '',
    color: '#1E40AF',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cell) {
      setForm({
        name: cell.name,
        short_code: cell.short_code,
        description: cell.description || '',
        head_officer: cell.head_officer || '',
        contact_phone: cell.contact_phone || '',
        contact_email: cell.contact_email || '',
        color: cell.color,
      });
    }
  }, [cell]);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.short_code.trim()) return;
    setSaving(true);
    try {
      await onSubmit(form, cell?.id);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const update = (key: keyof CellFormData, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Cell Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="e.g. General Administration & Coordination"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Short Code *</label>
          <input
            type="text"
            value={form.short_code}
            onChange={(e) => update('short_code', e.target.value.toUpperCase())}
            placeholder="e.g. GAC"
            maxLength={10}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => update('color', c)}
                className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  borderColor: form.color === c ? '#1E293B' : 'transparent',
                }}
              />
            ))}
          </div>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={2}
            placeholder="Brief description of cell responsibilities"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Head Officer</label>
          <input
            type="text"
            value={form.head_officer}
            onChange={(e) => update('head_officer', e.target.value)}
            placeholder="Officer name"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Contact Phone</label>
          <input
            type="text"
            value={form.contact_phone}
            onChange={(e) => update('contact_phone', e.target.value)}
            placeholder="+91 ..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Contact Email</label>
          <input
            type="email"
            value={form.contact_email}
            onChange={(e) => update('contact_email', e.target.value)}
            placeholder="email@example.com"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !form.name.trim() || !form.short_code.trim()}
          className="px-5 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : cell ? 'Update Cell' : 'Create Cell'}
        </button>
      </div>
    </div>
  );
}

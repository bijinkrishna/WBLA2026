'use client';

import AppShell from '@/components/AppShell';
import { PageHeader, Modal, ProgressBar, EmptyState } from '@/components/ui';
import CellForm from '@/components/cells/CellForm';
import { useCells, useCellSummary } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import type { Cell, CellFormData } from '@/types';
import { Plus, Building2, Pencil, Trash2, Users, Mail, Phone } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

export default function CellsPage() {
  const { cells, loading, upsert, remove } = useCells();
  const { summaries } = useCellSummary();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<Cell | null>(null);

  const handleEdit = (cell: Cell) => {
    setEditingCell(cell);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setEditingCell(null);
    setModalOpen(true);
  };

  const handleSubmit = async (data: CellFormData, id?: string) => {
    await upsert(data, id);
    setModalOpen(false);
    setEditingCell(null);
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Remove cell "${name}"? This will archive it (activities preserved).`)) {
      await remove(id);
    }
  };

  const getSummary = (cellId: string) =>
    summaries.find((s) => s.cell_id === cellId);

  return (
    <AppShell>
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-[1400px]">
        <PageHeader
          title="Election Cells"
          subtitle={`${cells.length} cells at District Headquarters, Paschim Medinipur`}
          action={
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors shadow-sm"
            >
              <Plus size={16} />
              Add Cell
            </button>
          }
        />

        {cells.length === 0 && !loading ? (
          <EmptyState
            icon={<Building2 size={48} />}
            title="No cells configured"
            description="Start by adding the 13 election cells at your district headquarters."
            action={
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600"
              >
                Add First Cell
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
            {cells.map((cell) => {
              const summary = getSummary(cell.id);
              return (
                <div
                  key={cell.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden"
                >
                  {/* Color accent bar */}
                  <div className="h-1.5" style={{ backgroundColor: cell.color }} />

                  <div className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: cell.color }}
                        >
                          {cell.short_code.slice(0, 3)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                            {cell.name}
                          </h3>
                          <p className="text-[11px] text-gray-400 mt-0.5">{cell.short_code}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(cell)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(cell.id, cell.name)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Description */}
                    {cell.description && (
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2">{cell.description}</p>
                    )}

                    {/* Officer Info */}
                    {cell.head_officer && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                        <Users size={12} />
                        <span>{cell.head_officer}</span>
                      </div>
                    )}

                    {/* Progress */}
                    {summary && (
                      <div className="mt-3 pt-3 border-t border-gray-50">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                          <span>{summary.total_activities} activities</span>
                          <span className="font-semibold text-gray-700">{summary.avg_progress}%</span>
                        </div>
                        <ProgressBar value={summary.avg_progress} size="sm" showLabel={false} />
                        <div className="flex gap-3 mt-2 text-[11px] text-gray-400">
                          <span>{summary.completed} done</span>
                          <span>{summary.in_progress} active</span>
                          {summary.delayed > 0 && (
                            <span className="text-red-500">{summary.delayed} delayed</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* View Activities */}
                    <Link
                      href={`/activities?cell=${cell.id}`}
                      className="mt-3 block text-center py-2 text-xs font-medium text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"
                    >
                      View Activities →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Modal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditingCell(null); }}
          title={editingCell ? 'Edit Cell' : 'Add New Cell'}
          size="lg"
        >
          <CellForm
            cell={editingCell}
            onSubmit={handleSubmit}
            onCancel={() => { setModalOpen(false); setEditingCell(null); }}
          />
        </Modal>
      </div>
    </AppShell>
  );
}

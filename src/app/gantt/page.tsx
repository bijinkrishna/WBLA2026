'use client';

import { useState, useMemo, useRef } from 'react';
import AppShell from '@/components/AppShell';
import { PageHeader, StatusBadge, ProgressBar } from '@/components/ui';
import { useGanttData, useCells } from '@/lib/hooks';
import { cn, formatDateShort, formatRelativeLabel, STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/utils';
import type { GanttItem } from '@/types';
import {
  GanttChart as GanttIcon,
  ZoomIn,
  ZoomOut,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  differenceInDays,
  addDays,
  startOfWeek,
  endOfWeek,
  format,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  eachWeekOfInterval,
  isToday,
  isSameMonth,
} from 'date-fns';

type ZoomLevel = 'day' | 'week' | 'month';

const ZOOM_CONFIG: Record<ZoomLevel, { dayWidth: number; label: string }> = {
  day: { dayWidth: 32, label: 'Day' },
  week: { dayWidth: 14, label: 'Week' },
  month: { dayWidth: 5, label: 'Month' },
};

const ROW_HEIGHT = 40;

function GanttTooltip({ item, items }: { item: GanttItem; items: GanttItem[] }) {
  const idToTitle = new Map(items.map((i) => [i.id, i.title]));
  const depTitles = (item.depends_on || []).map((id) => idToTitle.get(id) || id).filter(Boolean);
  return (
    <div className="hidden group-hover:block absolute left-0 top-full mt-1 z-30 bg-gray-900 text-white text-[11px] rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
      <p className="font-semibold">{item.title}</p>
      <p className="text-gray-400 mt-0.5">
        {formatDateShort(item.start_date)} → {formatDateShort(item.end_date)} ({item.duration_days}d)
      </p>
      <p className="text-gray-400">
        Progress: {item.progress}% &middot; {STATUS_CONFIG[item.status].label}
      </p>
      {item.schedule_type === 'relative' && item.anchor && item.start_offset_days != null && (
        <p className="text-gray-400 mt-0.5">
          Relative: {formatRelativeLabel(item.anchor, item.start_offset_days, item.end_offset_days ?? undefined)}
        </p>
      )}
      {depTitles.length > 0 && (
        <p className="text-gray-400 mt-0.5">
          Depends on: {depTitles.join(', ')}
        </p>
      )}
    </div>
  );
}
const HEADER_HEIGHT = 56;
const LEFT_PANEL_WIDTH = 320;

export default function GanttPage() {
  const { items, loading } = useGanttData();
  const { cells } = useCells();

  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [cellFilter, setCellFilter] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter
  const filtered = useMemo(() => {
    if (!cellFilter) return items;
    return items.filter((i) => i.cell_id === cellFilter);
  }, [items, cellFilter]);

  // Group by cell
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; code: string; color: string; items: GanttItem[] }>();
    filtered.forEach((item) => {
      if (!map.has(item.cell_id)) {
        map.set(item.cell_id, {
          label: item.cell_name,
          code: item.cell_code,
          color: item.cell_color,
          items: [],
        });
      }
      map.get(item.cell_id)!.items.push(item);
    });
    return Array.from(map.values());
  }, [filtered]);

  // Date range
  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (filtered.length === 0) {
      const now = new Date();
      return {
        minDate: startOfMonth(now),
        maxDate: endOfMonth(addDays(now, 90)),
        totalDays: 120,
      };
    }
    const starts = filtered.map((i) => new Date(i.start_date));
    const ends = filtered.map((i) => new Date(i.end_date));
    const min = startOfWeek(new Date(Math.min(...starts.map((d) => d.getTime()))));
    const max = endOfWeek(new Date(Math.max(...ends.map((d) => d.getTime()))));
    // Add some padding
    const paddedMin = addDays(min, -7);
    const paddedMax = addDays(max, 14);
    return {
      minDate: paddedMin,
      maxDate: paddedMax,
      totalDays: differenceInDays(paddedMax, paddedMin) + 1,
    };
  }, [filtered]);

  const dayWidth = ZOOM_CONFIG[zoom].dayWidth;
  const chartWidth = totalDays * dayWidth;

  // Build month + week headers
  const months = useMemo(
    () => eachMonthOfInterval({ start: minDate, end: maxDate }),
    [minDate, maxDate]
  );

  const weeks = useMemo(
    () => eachWeekOfInterval({ start: minDate, end: maxDate }, { weekStartsOn: 1 }),
    [minDate, maxDate]
  );

  // Today marker position
  const todayOffset = differenceInDays(new Date(), minDate) * dayWidth;
  const todayVisible = todayOffset >= 0 && todayOffset <= chartWidth;

  // Row count
  const totalRows = grouped.reduce((sum, g) => sum + g.items.length + 1, 0);

  // Item positions for dependency arrows (id -> { startX, endX, centerY })
  const itemPositions = useMemo(() => {
    const map = new Map<string, { startX: number; endX: number; centerY: number }>();
    let rowIndex = 0;
    grouped.forEach((group) => {
      rowIndex += 1; // group header row
      group.items.forEach((item) => {
        const startX = differenceInDays(new Date(item.start_date), minDate) * dayWidth;
        const endX = startX + item.duration_days * dayWidth;
        const centerY = rowIndex * ROW_HEIGHT + 20;
        map.set(item.id, { startX, endX, centerY });
        rowIndex += 1;
      });
    });
    return map;
  }, [grouped, minDate, dayWidth]);

  const scrollToToday = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = todayOffset - 400;
    }
  };

  return (
    <AppShell>
      <div className="px-8 py-6">
        <PageHeader
          title="Gantt Chart"
          subtitle="Election activity timeline across all cells"
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={scrollToToday}
                className="px-3 py-2 text-xs font-medium text-brand-500 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors"
              >
                Today
              </button>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() =>
                    setZoom((z) => (z === 'month' ? 'week' : z === 'week' ? 'day' : z))
                  }
                  className="p-2 hover:bg-gray-50 text-gray-500"
                >
                  <ZoomIn size={16} />
                </button>
                <span className="px-2 text-xs font-medium text-gray-600 border-x border-gray-200 py-2">
                  {ZOOM_CONFIG[zoom].label}
                </span>
                <button
                  onClick={() =>
                    setZoom((z) => (z === 'day' ? 'week' : z === 'week' ? 'month' : z))
                  }
                  className="p-2 hover:bg-gray-50 text-gray-500"
                >
                  <ZoomOut size={16} />
                </button>
              </div>
              <select
                value={cellFilter}
                onChange={(e) => setCellFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white"
              >
                <option value="">All Cells</option>
                {cells.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.short_code}
                  </option>
                ))}
              </select>
            </div>
          }
        />

        {/* Gantt Container */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex">
            {/* Left Panel: Labels */}
            <div
              className="flex-shrink-0 border-r border-gray-200 bg-gray-50/50"
              style={{ width: LEFT_PANEL_WIDTH }}
            >
              {/* Header */}
              <div
                className="px-4 flex items-end border-b border-gray-200 bg-gray-50"
                style={{ height: HEADER_HEIGHT }}
              >
                <span className="text-xs font-semibold text-gray-500 pb-2">Activity</span>
              </div>

              {/* Rows */}
              {grouped.map((group) => (
                <div key={group.code}>
                  {/* Group header */}
                  <div
                    className="flex items-center gap-2 px-4 border-b border-gray-100 font-semibold text-xs"
                    style={{ height: ROW_HEIGHT, backgroundColor: group.color + '10' }}
                  >
                    <div
                      className="w-3 h-3 rounded flex-shrink-0"
                      style={{ backgroundColor: group.color }}
                    />
                    <span className="truncate text-gray-800">
                      {group.code} — {group.label}
                    </span>
                  </div>

                  {/* Activity rows */}
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 px-4 border-b border-gray-50 hover:bg-gray-50/50"
                      style={{ height: ROW_HEIGHT, paddingLeft: item.depth ? 32 : 16 }}
                    >
                      <span
                        className={cn(
                          'text-xs truncate',
                          item.depth ? 'text-gray-500' : 'text-gray-700 font-medium'
                        )}
                      >
                        {item.is_milestone ? '◆ ' : ''}
                        {item.title}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Right Panel: Chart */}
            <div className="flex-1 overflow-x-auto gantt-scroll" ref={scrollRef}>
              <div style={{ width: chartWidth, minHeight: totalRows * ROW_HEIGHT + HEADER_HEIGHT }}>
                {/* Timeline Header */}
                <div
                  className="sticky top-0 z-10 bg-white border-b border-gray-200"
                  style={{ height: HEADER_HEIGHT }}
                >
                  {/* Months */}
                  <div className="flex h-1/2 border-b border-gray-100">
                    {months.map((month) => {
                      const monthStart = month < minDate ? minDate : month;
                      const monthEnd = endOfMonth(month) > maxDate ? maxDate : endOfMonth(month);
                      const left = differenceInDays(monthStart, minDate) * dayWidth;
                      const width = (differenceInDays(monthEnd, monthStart) + 1) * dayWidth;
                      return (
                        <div
                          key={month.toISOString()}
                          className="absolute flex items-center justify-center text-[11px] font-semibold text-gray-600 border-r border-gray-100"
                          style={{ left, width, height: HEADER_HEIGHT / 2 }}
                        >
                          {format(month, 'MMMM yyyy')}
                        </div>
                      );
                    })}
                  </div>

                  {/* Weeks or days */}
                  <div className="relative h-1/2">
                    {zoom !== 'month' &&
                      weeks.map((week) => {
                        const wStart = week < minDate ? minDate : week;
                        const wEnd = endOfWeek(week, { weekStartsOn: 1 });
                        const left = differenceInDays(wStart, minDate) * dayWidth;
                        const width = (differenceInDays(wEnd > maxDate ? maxDate : wEnd, wStart) + 1) * dayWidth;
                        return (
                          <div
                            key={week.toISOString()}
                            className="absolute flex items-center justify-center text-[10px] text-gray-400 border-r border-gray-50"
                            style={{ left, width, height: HEADER_HEIGHT / 2 }}
                          >
                            {format(wStart, 'dd MMM')}
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Chart Body */}
                <div className="relative">
                  {/* Dependency arrows overlay */}
                  <svg
                    className="absolute inset-0 pointer-events-none z-10"
                    width={chartWidth}
                    height={totalRows * ROW_HEIGHT}
                  >
                    {filtered
                      .filter((item) => item.depends_on && item.depends_on.length > 0)
                      .flatMap((item) => {
                        const pos = itemPositions.get(item.id);
                        if (!pos) return [];
                        return (item.depends_on || []).map((depId) => {
                          const depPos = itemPositions.get(depId);
                          if (!depPos) return null;
                          const fromX = depPos.endX + 4;
                          const toX = Math.max(pos.startX - 8, fromX + 20);
                          const midX = (fromX + toX) / 2;
                          const path = `M ${fromX} ${depPos.centerY} H ${midX} V ${pos.centerY} H ${toX}`;
                          return (
                            <g key={`${item.id}-${depId}`}>
                              <path
                                d={path}
                                fill="none"
                                stroke="#6366f1"
                                strokeWidth="1.5"
                                strokeDasharray="4 3"
                                opacity="0.7"
                              />
                              <polygon
                                points={`${toX},${pos.centerY} ${toX - 6},${pos.centerY - 4} ${toX - 6},${pos.centerY + 4}`}
                                fill="#6366f1"
                                opacity="0.8"
                              />
                            </g>
                          );
                        });
                      })
                      .filter(Boolean)}
                  </svg>

                  {/* Today line */}
                  {todayVisible && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-20"
                      style={{ left: todayOffset }}
                    >
                      <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-b">
                        TODAY
                      </div>
                    </div>
                  )}

                  {/* Weekend stripes */}
                  {zoom === 'day' &&
                    Array.from({ length: totalDays }).map((_, i) => {
                      const d = addDays(minDate, i);
                      const day = d.getDay();
                      if (day !== 0 && day !== 6) return null;
                      return (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 bg-gray-50/60"
                          style={{ left: i * dayWidth, width: dayWidth }}
                        />
                      );
                    })}

                  {/* Rows */}
                  {grouped.map((group) => (
                    <div key={group.code}>
                      {/* Group header row (empty bar space) */}
                      <div
                        className="border-b border-gray-100"
                        style={{ height: ROW_HEIGHT, backgroundColor: group.color + '08' }}
                      />

                      {/* Activity bars */}
                      {group.items.map((item) => {
                        const startOffset = differenceInDays(new Date(item.start_date), minDate) * dayWidth;
                        const barWidth = item.duration_days * dayWidth;
                        const progressWidth = (item.progress / 100) * barWidth;

                        return (
                          <div
                            key={item.id}
                            className="relative border-b border-gray-50"
                            style={{ height: ROW_HEIGHT }}
                          >
                            {/* Bar container */}
                            <div
                              className="absolute top-[8px] group cursor-pointer"
                              style={{ left: startOffset, width: barWidth }}
                            >
                              {item.is_milestone ? (
                                // Milestone diamond
                                <div className="flex items-center justify-center" style={{ height: 24 }}>
                                  <div
                                    className="w-5 h-5 rotate-45 rounded-sm shadow-sm"
                                    style={{ backgroundColor: group.color }}
                                  />
                                </div>
                              ) : (
                                // Regular bar
                                <div
                                  className="h-6 rounded-md overflow-hidden shadow-sm relative"
                                  style={{ backgroundColor: group.color + '25' }}
                                >
                                  {/* Progress fill */}
                                  <div
                                    className="h-full rounded-md transition-all duration-300"
                                    style={{
                                      width: `${item.progress}%`,
                                      backgroundColor: group.color,
                                      opacity: item.status === 'completed' ? 0.9 : 0.7,
                                    }}
                                  />

                                  {/* Label on bar */}
                                  {barWidth > 60 && (
                                    <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium text-gray-800 truncate">
                                      {item.progress > 50 && (
                                        <span className="text-white mr-1">{item.progress}%</span>
                                      )}
                                    </span>
                                  )}

                                  {/* Delayed indicator */}
                                  {item.status === 'delayed' && (
                                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-red-500 rounded-r" />
                                  )}
                                </div>
                              )}

                              {/* Tooltip */}
                              <GanttTooltip item={item} items={filtered} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

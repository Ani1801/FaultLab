import React, { useState } from 'react';
import type { VolumeOverTimeItem } from '../../types/requestLog';

interface RequestVolumeChartProps {
  volumeData: VolumeOverTimeItem[];
  timeRange: '24h' | '7d' | '30d';
  onTimeRangeChange: (range: '24h' | '7d' | '30d') => void;
  isLoading?: boolean;
}

export const RequestVolumeChart: React.FC<RequestVolumeChartProps> = ({
  volumeData,
  timeRange,
  onTimeRangeChange,
  isLoading,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const maxVolume = Math.max(...volumeData.map((d) => d.count), 1);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
      {/* Header with Title and Range Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-base font-semibold text-white">Request Traffic & Health</h3>
          <p className="text-xs text-slate-400 mt-1">
            Volume distribution over time broken down by successful requests, errors, and faults
          </p>
        </div>

        {/* Time range selector */}
        <div className="inline-flex rounded-lg bg-slate-800/80 p-1 border border-slate-700/60 self-start sm:self-auto">
          {(['24h', '7d', '30d'] as const).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => onTimeRangeChange(range)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                timeRange === range
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Legend */}
      <div className="flex items-center gap-5 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
          <span className="text-slate-400">Normal Requests</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
          <span className="text-slate-400">Errors (4xx/5xx)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
          <span className="text-slate-400">Injected Faults</span>
        </div>
      </div>

      {/* Chart Canvas */}
      {isLoading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      ) : volumeData.length === 0 || maxVolume === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-slate-500">
          <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm">No traffic data recorded in this period</p>
        </div>
      ) : (
        <div className="relative pt-6">
          {/* Hover tooltip */}
          {hoveredIndex !== null && volumeData[hoveredIndex] && (
            <div className="absolute top-0 right-0 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs shadow-xl pointer-events-none z-10 flex items-center gap-3">
              <span className="font-semibold text-white">{volumeData[hoveredIndex].timestamp}</span>
              <span className="text-indigo-400">Total: {volumeData[hoveredIndex].count}</span>
              {volumeData[hoveredIndex].errors > 0 && (
                <span className="text-rose-400">Errors: {volumeData[hoveredIndex].errors}</span>
              )}
              {volumeData[hoveredIndex].faults > 0 && (
                <span className="text-amber-400">Faults: {volumeData[hoveredIndex].faults}</span>
              )}
            </div>
          )}

          {/* Bar Columns Container */}
          <div className="h-44 flex items-end gap-1.5 sm:gap-3 border-b border-slate-800 pb-1">
            {volumeData.map((item, idx) => {
              const heightPercent = item.count > 0 ? Math.max((item.count / maxVolume) * 100, 8) : 0;
              const errorPercent = item.count > 0 ? (item.errors / item.count) * 100 : 0;
              const faultPercent = item.count > 0 ? (item.faults / item.count) * 100 : 0;
              const isHovered = hoveredIndex === idx;

              return (
                <div
                  key={idx}
                  className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Segmented Bar */}
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full max-w-[28px] rounded-t-sm flex flex-col justify-end overflow-hidden transition-all duration-200 ${
                      isHovered ? 'ring-2 ring-indigo-400 opacity-100 scale-105' : 'opacity-85 hover:opacity-100'
                    }`}
                  >
                    {/* Normal slice */}
                    <div className="w-full bg-indigo-500 flex-1" />
                    {/* Error slice */}
                    {errorPercent > 0 && (
                      <div style={{ height: `${errorPercent}%` }} className="w-full bg-rose-500" />
                    )}
                    {/* Fault slice */}
                    {faultPercent > 0 && (
                      <div style={{ height: `${faultPercent}%` }} className="w-full bg-amber-500" />
                    )}
                  </div>

                  {/* Base tick if 0 count */}
                  {item.count === 0 && (
                    <div className="w-full max-w-[28px] h-1 bg-slate-800 rounded-sm" />
                  )}
                </div>
              );
            })}
          </div>

          {/* X Axis labels */}
          <div className="flex justify-between items-center text-[10px] text-slate-500 mt-2 px-1">
            <span>{volumeData[0]?.timestamp || ''}</span>
            {volumeData.length > 2 && (
              <span>{volumeData[Math.floor(volumeData.length / 2)]?.timestamp || ''}</span>
            )}
            <span>{volumeData[volumeData.length - 1]?.timestamp || ''}</span>
          </div>
        </div>
      )}
    </div>
  );
};


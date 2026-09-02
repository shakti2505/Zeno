import React from 'react';
import { PlaceholderSchema, type PlaceholderType } from '@zeno/shared';
import { Sparkles, CheckCircle2, Terminal, Layers } from 'lucide-react';

const sampleKit: PlaceholderType = {
  id: 'zeno-init',
  name: 'Zeno Interview Preparation System'
};

const validationResult = PlaceholderSchema.safeParse(sampleKit);

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
            Z
          </div>
          <span className="font-semibold text-lg tracking-tight">Zeno Prep</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 px-3 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Monorepo Ready
        </div>
      </header>

      {/* Main Hero */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 flex flex-col gap-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-950 text-blue-400 border border-blue-800/60">
            <Sparkles className="w-3.5 h-3.5" />
            Interview Preparation Kits Monorepo
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-white">
            AI-Powered Personalized Interview Prep
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl">
            Asynchronous background pipeline for crawling job descriptions, LLM extraction, deterministic scheduling, and interactive practice kits.
          </p>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Frontend</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-lg font-semibold text-white">React + Vite + Tailwind</div>
            <div className="text-xs text-slate-400 font-mono">Port: 5173 (SWC enabled)</div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Backend</span>
              <Terminal className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-lg font-semibold text-white">Express + TypeScript</div>
            <div className="text-xs text-slate-400 font-mono">Port: 3000 (Mongoose, BullMQ, Redis)</div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Shared Package</span>
              <Layers className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-lg font-semibold text-white">@zeno/shared</div>
            <div className="text-xs text-emerald-400 font-mono">
              {validationResult.success ? '✓ Schema imported successfully' : 'Schema error'}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

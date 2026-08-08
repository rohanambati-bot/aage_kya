import { useState } from 'react'

export default function WhatIfSimulator({ initialProfile = {}, onRecalculate }) {
  const [marks, setMarks] = useState(initialProfile.marks || 75)
  const [budgetLakh, setBudgetLakh] = useState(initialProfile.budgetLakh || 3.0)
  const [selectedState, setSelectedState] = useState(initialProfile.state || 'Karnataka')
  const [stream, setStream] = useState(initialProfile.stream || 'Science (PCM)')

  const handleSimulate = () => {
    if (onRecalculate) {
      onRecalculate({
        marks: Number(marks),
        budgetLakh: Number(budgetLakh),
        budget: Number(budgetLakh) * 100000,
        state: selectedState,
        stream,
      })
    }
  }

  return (
    <div className="glass-card p-6 rounded-3xl border border-sky-400/30 bg-[#141D33]/90 shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-sky-300 bg-sky-500/20 border border-sky-400/30 px-2.5 py-0.5 rounded-full">
            ⚡ Interactive Decision Simulator
          </span>
          <h3 className="text-lg font-black text-white mt-1">What-If Guidance Simulator</h3>
        </div>
        <span className="text-2xl">🧪</span>
      </div>

      <p className="text-xs text-slate-300 mb-6 leading-relaxed">
        Test how your eligible options, score buckets, and scholarships change if your marks or budget change.
      </p>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Slider 1: Marks */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-bold">12th Marks / Score (%):</span>
            <span className="text-sky-300 font-black text-sm">{marks}%</span>
          </div>
          <input
            type="range"
            min="40"
            max="99"
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>40%</span>
            <span>70%</span>
            <span>99%</span>
          </div>
        </div>

        {/* Slider 2: Annual Budget */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-bold">Annual Family Budget:</span>
            <span className="text-emerald-300 font-black text-sm">₹{budgetLakh} Lakh/yr</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="12.0"
            step="0.5"
            value={budgetLakh}
            onChange={(e) => setBudgetLakh(e.target.value)}
            className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>₹0.5L</span>
            <span>₹6.0L</span>
            <span>₹12.0L+</span>
          </div>
        </div>

        {/* Dropdown 3: Stream Selection */}
        <div className="space-y-2">
          <label className="block text-xs text-slate-300 font-bold">Academic Stream:</label>
          <select
            value={stream}
            onChange={(e) => setStream(e.target.value)}
            className="w-full bg-[#0D1424] border border-sky-400/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-300"
          >
            <option value="Science (PCM)">Science (PCM)</option>
            <option value="Science (PCB)">Science (PCB)</option>
            <option value="Commerce">Commerce</option>
            <option value="Arts / Humanities">Arts / Humanities</option>
          </select>
        </div>

        {/* Dropdown 4: State Domicile */}
        <div className="space-y-2">
          <label className="block text-xs text-slate-300 font-bold">State Domicile:</label>
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="w-full bg-[#0D1424] border border-sky-400/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-300"
          >
            <option value="Karnataka">Karnataka</option>
            <option value="Maharashtra">Maharashtra</option>
            <option value="Delhi">Delhi</option>
            <option value="Tamil Nadu">Tamil Nadu</option>
            <option value="Telangana">Telangana</option>
            <option value="Uttar Pradesh">Uttar Pradesh</option>
            <option value="West Bengal">West Bengal</option>
            <option value="Kerala">Kerala</option>
          </select>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSimulate}
          className="btn-primary text-xs py-2.5 px-6 rounded-xl font-black shadow-lg hover:scale-105 transition-transform"
        >
          🔄 Recalculate What-If Scenarios
        </button>
      </div>
    </div>
  )
}

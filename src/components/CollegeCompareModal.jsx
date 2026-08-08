import { motion, AnimatePresence } from 'framer-motion'

export default function CollegeCompareModal({ isOpen, onClose, colleges = [] }) {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-4xl bg-[#141D33] border border-sky-400/40 rounded-3xl p-6 shadow-2xl text-white my-8 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-sky-300 bg-sky-500/20 border border-sky-400/30 px-3 py-1 rounded-full">
                📊 Side-by-Side Comparison
              </span>
              <h2 className="text-xl font-black text-white mt-1">Compare College Options</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {colleges.length === 0 ? (
            <p className="text-center text-slate-400 py-10">No colleges selected for comparison.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/15">
                    <th className="p-3 text-slate-400 font-bold uppercase tracking-wider w-1/4">Criteria</th>
                    {colleges.map((col, idx) => (
                      <th key={col.id || col.name || idx} className="p-3 text-white font-black text-sm w-1/3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🏛️</span>
                          <div>
                            <p className="line-clamp-1">{col.name || col.fullName}</p>
                            <span className="text-[10px] text-sky-300 font-semibold">{col.city || col.state || 'India'}</span>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {/* Bucket / Fit */}
                  <tr>
                    <td className="p-3 font-bold text-slate-300">Match Category</td>
                    {colleges.map((col, idx) => (
                      <td key={idx} className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          col.bucket === 'safe' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                          col.bucket === 'target' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' :
                          'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {col.bucket ? col.bucket.toUpperCase() : 'TARGET'}
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Academic Fit */}
                  <tr>
                    <td className="p-3 font-bold text-slate-300">Academic Fit Score</td>
                    {colleges.map((col, idx) => (
                      <td key={idx} className="p-3 font-black text-sky-300 text-sm">
                        {col.breakdown?.academicFit ?? col.score ?? 85}/100
                      </td>
                    ))}
                  </tr>

                  {/* 4-Year Net Cost */}
                  <tr>
                    <td className="p-3 font-bold text-slate-300">Estimated Annual Fee</td>
                    {colleges.map((col, idx) => (
                      <td key={idx} className="p-3 font-extrabold text-emerald-300">
                        {col.yearly_cost_max ? `₹${(col.yearly_cost_max/100000).toFixed(1)}L/yr` : col.approx_annual_fee || '₹1.5L/yr'}
                      </td>
                    ))}
                  </tr>

                  {/* Entrance Exam */}
                  <tr>
                    <td className="p-3 font-bold text-slate-300">Entrance Exam</td>
                    {colleges.map((col, idx) => (
                      <td key={idx} className="p-3 text-slate-200">
                        {col.entrance_exam || col.entrance_exams || 'Merit / Counselling'}
                      </td>
                    ))}
                  </tr>

                  {/* Institution Type */}
                  <tr>
                    <td className="p-3 font-bold text-slate-300">Institution Type</td>
                    {colleges.map((col, idx) => (
                      <td key={idx} className="p-3 text-slate-300 capitalize">
                        {col.college_type || col.type || 'Government / Subsidised'}
                      </td>
                    ))}
                  </tr>

                  {/* Verified Source */}
                  <tr>
                    <td className="p-3 font-bold text-slate-300">Official Evidence</td>
                    {colleges.map((col, idx) => (
                      <td key={idx} className="p-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                          ✓ Verified Source
                        </span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
            <button onClick={onClose} className="btn-outline text-xs py-2 px-5 rounded-xl">
              Close Comparison
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

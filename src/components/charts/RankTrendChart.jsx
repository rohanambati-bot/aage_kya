import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  LineController,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

// Tree-shaken Chart.js registration
ChartJS.register(
  LineController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
)

export default function RankTrendChart({ trends = [], collegeName = '', courseName = '' }) {
  const chartData = useMemo(() => {
    // Sort trends chronologically
    const sorted = [...trends].sort((a, b) => a.year - b.year)
    const labels = sorted.map((t) => String(t.year))
    const ranks = sorted.map((t) => t.closing_rank)

    return {
      labels,
      datasets: [
        {
          label: `${collegeName || 'Closing Rank'} (${courseName || 'Trend'})`,
          data: ranks,
          borderColor: '#6366F1', // Indigo
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          borderWidth: 3,
          tension: 0.3, // Smooth curve
          pointBackgroundColor: '#818CF8',
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    }
  }, [trends, collegeName, courseName])

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#9CA3AF', font: { size: 11 } },
      },
      y: {
        reverse: true, // Lower rank number is better (top of chart)
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#9CA3AF',
          font: { size: 11 },
          callback: (value) => `#${value.toLocaleString('en-IN')}`,
        },
        title: {
          display: true,
          text: 'Closing Rank (Lower is Better ↑)',
          color: '#9CA3AF',
          font: { size: 10 },
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#1E293B',
        titleColor: '#F8FAFC',
        bodyColor: '#CBD5E1',
        borderColor: 'rgba(99, 102, 241, 0.4)',
        borderWidth: 1,
        callbacks: {
          label: (context) => `Closing Rank: #${context.raw.toLocaleString('en-IN')}`,
        },
      },
    },
  }

  if (!trends || trends.length === 0) {
    return (
      <div className="w-full h-48 flex items-center justify-center text-gray-500 text-xs">
        No multi-year cutoff trend data available.
      </div>
    )
  }

  return (
    <div className="w-full h-48 p-2 relative">
      <Line data={chartData} options={options} />
    </div>
  )
}

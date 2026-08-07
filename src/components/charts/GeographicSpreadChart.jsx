import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  BarController,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

// Tree-shaken Chart.js registration
ChartJS.register(
  BarController,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
)

export default function GeographicSpreadChart({ colleges = [] }) {
  const chartData = useMemo(() => {
    const counts = {}
    for (const c of colleges) {
      const state = c.state || c.location || 'Other'
      counts[state] = (counts[state] || 0) + 1
    }

    const sortedStates = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8) // Top 8 states

    return {
      labels: sortedStates.map(([state]) => state),
      datasets: [
        {
          label: 'Colleges in Region',
          data: sortedStates.map(([, count]) => count),
          backgroundColor: 'rgba(14, 165, 233, 0.4)', // Sky blue translucent
          borderColor: '#0EA5E9',
          borderWidth: 1.5,
          borderRadius: 6,
        },
      ],
    }
  }, [colleges])

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#9CA3AF', font: { size: 10 } },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#9CA3AF',
          font: { size: 10 },
          stepSize: 1,
          precision: 0,
        },
        beginAtZero: true,
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1E293B',
        titleColor: '#F8FAFC',
        bodyColor: '#CBD5E1',
        borderColor: 'rgba(14, 165, 233, 0.4)',
        borderWidth: 1,
        callbacks: {
          label: (context) => `${context.raw} matching institution(s)`,
        },
      },
    },
  }

  if (!colleges || colleges.length === 0) {
    return (
      <div className="w-full h-44 flex items-center justify-center text-gray-500 text-xs">
        No college geographic distribution data available.
      </div>
    )
  }

  return (
    <div className="w-full h-44 p-2 relative">
      <Bar data={chartData} options={options} />
    </div>
  )
}

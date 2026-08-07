import { useMemo } from 'react'
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  RadarController,
} from 'chart.js'
import { Radar } from 'react-chartjs-2'

// Tree-shaken Chart.js registration
ChartJS.register(
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
)

export default function MatchBreakdownChart({ breakdown = {}, collegeName = 'Selected College' }) {
  const chartData = useMemo(() => {
    const {
      academicFit = 50,
      streamFit = 50,
      locationFit = 50,
      budgetFit = 50,
      outcomeSignal = 50,
    } = breakdown

    return {
      labels: [
        'Academic Fit',
        'Stream Fit',
        'Location Fit',
        'Budget Fit',
        'Outcome Signal',
      ],
      datasets: [
        {
          label: `${collegeName} Match Fit`,
          data: [
            academicFit,
            streamFit,
            locationFit,
            budgetFit,
            outcomeSignal ?? 50,
          ],
          backgroundColor: 'rgba(255, 153, 51, 0.25)', // Saffron translucent fill
          borderColor: '#FF9933',
          borderWidth: 2,
          pointBackgroundColor: '#FF9933',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#FF9933',
        },
      ],
    }
  }, [breakdown, collegeName])

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        angleLines: { color: 'rgba(255, 255, 255, 0.15)' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        pointLabels: {
          color: '#D1D5DB',
          font: { size: 11, weight: '600' },
        },
        ticks: {
          display: false,
          beginAtZero: true,
          max: 100,
        },
        min: 0,
        max: 100,
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
        borderColor: 'rgba(255, 153, 51, 0.4)',
        borderWidth: 1,
        callbacks: {
          label: (context) => `${context.label}: ${context.raw}/100`,
        },
      },
    },
  }

  return (
    <div className="w-full h-64 p-2 relative">
      <Radar data={chartData} options={options} />
    </div>
  )
}

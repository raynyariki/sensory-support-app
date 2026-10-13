import { useEffect, useRef } from "react";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from "chart.js";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

function BarChart({ labels, values, horizontal = false, height, ariaLabel }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    // Read colours from the design tokens so the charts match the site.
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue("--color-accent").trim();
    const ink = styles.getPropertyValue("--color-ink").trim();
    const line = styles.getPropertyValue("--color-line").trim();

    const tickStyle = {
      color: ink,
      font: { family: "Public Sans, system-ui, sans-serif", size: 14 },
    };

    const valueAxis = {
      beginAtZero: true,
      ticks: { ...tickStyle, precision: 0 },
      grid: { color: line },
    };
    const categoryAxis = {
      ticks: tickStyle,
      grid: { display: false },
    };

    const chart = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: accent, borderRadius: 2 }],
      },
      options: {
        indexAxis: horizontal ? "y" : "x",
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: horizontal
          ? { x: valueAxis, y: categoryAxis }
          : { x: categoryAxis, y: valueAxis },
      },
    });

    return () => chart.destroy();
  }, [labels, values, horizontal]);

  return (
    <div className="chart" style={{ height }}>
      <canvas ref={canvasRef} role="img" aria-label={ariaLabel} />
    </div>
  );
}

export default BarChart;
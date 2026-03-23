import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  getBookingsPerDayChartData,
  getRevenueTrendChartData,
  getStatusChartData,
} from '../utils/bookingSelectors';

function ChartCard({ children, title, subtitle }) {
  return (
    <section className="panel chart-panel">
      <div className="panel-kicker">Business Chart</div>
      <h2>{title}</h2>
      <p className="chart-copy">{subtitle}</p>
      <div className="chart-shell">{children}</div>
    </section>
  );
}

function EmptyChartState({ text }) {
  return <div className="chart-empty">{text}</div>;
}

export default function DashboardPage({ bookings, stats }) {
  const statusData = getStatusChartData(bookings);
  const bookingsPerDayData = getBookingsPerDayChartData(bookings);
  const revenueTrendData = getRevenueTrendChartData(bookings);

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-kicker">Owner Dashboard</div>
        <h1>Live business summary</h1>
        <p className="panel-copy">
          These numbers are calculated from the same live Firestore bookings
          collection used by the website admin.
        </p>
      </section>

      <section className="stats-grid">
        {[
          ['Total Bookings', stats.total],
          ['Today', stats.today],
          ['Pending', stats.pending],
          ['Confirmed', stats.confirmed],
          ['Revenue', `$${stats.revenue}`],
        ].map(([label, value]) => (
          <div className="stat-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <div className="dashboard-chart-grid">
        <ChartCard
          title="Bookings By Status"
          subtitle="A quick owner view of the current booking mix."
        >
          {statusData.some((item) => item.value > 0) ? (
            <ResponsiveContainer height={260} width="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  dataKey="value"
                  innerRadius={58}
                  outerRadius={86}
                  paddingAngle={3}
                >
                  {statusData.map((entry) => (
                    <Cell fill={entry.fill} key={entry.name} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#121212',
                    border: '1px solid rgba(214, 167, 72, 0.22)',
                    borderRadius: '14px',
                    color: '#f7f1e3',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState text="No bookings available for status breakdown yet." />
          )}

          <div className="chart-legend">
            {statusData.map((item) => (
              <div className="chart-legend-item" key={item.name}>
                <span
                  className="chart-legend-dot"
                  style={{ background: item.fill }}
                />
                <span>{item.name}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard
          title="Bookings Per Day"
          subtitle="Recent booking volume from the live Firestore schedule."
        >
          {bookingsPerDayData.length > 0 ? (
            <ResponsiveContainer height={260} width="100%">
              <BarChart data={bookingsPerDayData}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#cbbfa2"
                  tick={{ fontSize: 12 }}
                />
                <YAxis allowDecimals={false} stroke="#cbbfa2" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: '#121212',
                    border: '1px solid rgba(214, 167, 72, 0.22)',
                    borderRadius: '14px',
                    color: '#f7f1e3',
                  }}
                />
                <Bar dataKey="bookings" fill="#d6a748" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState text="No daily booking data available yet." />
          )}
        </ChartCard>

        <ChartCard
          title="Revenue Trend"
          subtitle="Confirmed and completed booking revenue by booking day."
        >
          {revenueTrendData.length > 0 ? (
            <ResponsiveContainer height={260} width="100%">
              <LineChart data={revenueTrendData}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#cbbfa2"
                  tick={{ fontSize: 12 }}
                />
                <YAxis stroke="#cbbfa2" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: '#121212',
                    border: '1px solid rgba(214, 167, 72, 0.22)',
                    borderRadius: '14px',
                    color: '#f7f1e3',
                  }}
                />
                <Line
                  dataKey="revenue"
                  dot={{ fill: '#82efb6', r: 4 }}
                  stroke="#82efb6"
                  strokeWidth={3}
                  type="monotone"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState text="No revenue trend data available yet." />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

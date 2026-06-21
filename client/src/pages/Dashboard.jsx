import { useEffect, useState } from 'react';
import { api, formatCurrency, formatNumber } from '../lib/utils';
import ExportMenu from '../components/ExportMenu';
import { exportDashboardReport } from '../lib/excelExport';
import {
  Handshake, CalendarDays, DollarSign, TrendingUp,
  ArrowUpRight, X, Info
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    api('/dashboard')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full" />
      </div>
    );
  }

  const stats = data?.stats || {};
  const monthlyIncome = data?.monthlyIncome || [];
  const pipelineStats = data?.pipelineStats || [];
  const contentStatusStats = data?.contentStatusStats || [];

  const incomeData = monthlyIncome.map(m => ({
    month: m.month,
    amount: m.amount || 0
  })).reverse();

  const pipelineColors = {
    outreach: '#c084fc', negotiation: '#818cf8', contract: '#60a5fa',
    delivered: '#34d399', paid: '#10b981'
  };

  const incomeSources = data?.incomeSources || [];
  const contentStatusCount = (status) => contentStatusStats.find(item => item.status === status)?.count || 0;
  const dashboardExportRows = [
    { report: 'Total Deals', metric: 'Count', value: stats.totalDeals || 0 },
    { report: 'Active Deals', metric: 'Count', value: stats.activeDeals || 0 },
    { report: 'Content Pieces', metric: 'Count', value: stats.totalContent || 0 },
    { report: 'Total Income', metric: 'Revenue', value: stats.totalIncome || 0 },
    ...monthlyIncome.map(item => ({ report: 'Revenue', metric: item.month, value: item.amount || 0 })),
    ...pipelineStats.map(item => ({ report: 'Campaign Performance', metric: item.pipeline_stage, value: item.count || 0 })),
    ...contentStatusStats.map(item => ({ report: 'Content Status', metric: item.status, value: item.count || 0 })),
    ...incomeSources.map(item => ({ report: 'Revenue Source', metric: item.source, value: item.amount || 0 })),
  ];
  const dashboardExportColumns = [
    { header: 'Report', key: 'report' },
    { header: 'Metric', key: 'metric' },
    { header: 'Value', key: 'value', type: 'number' },
  ];

  const cardDetails = {
    totalDeals: {
      title: 'Total Deals',
      description: 'All brand partnerships you have tracked in your pipeline.',
      breakdown: [
        { label: 'Active', value: stats.activeDeals || 0 },
        { label: 'Completed', value: stats.totalDeals ? stats.totalDeals - (stats.activeDeals || 0) : 0 },
      ]
    },
    activeDeals: {
      title: 'Active Deals',
      description: 'Deals currently in progress (Outreach through Delivered).',
      breakdown: [
        { label: 'In Outreach', value: pipelineStats.find(p => p.pipeline_stage === 'outreach')?.count || 0 },
        { label: 'In Negotiation', value: pipelineStats.find(p => p.pipeline_stage === 'negotiation')?.count || 0 },
        { label: 'In Contract', value: pipelineStats.find(p => p.pipeline_stage === 'contract')?.count || 0 },
        { label: 'Delivered', value: pipelineStats.find(p => p.pipeline_stage === 'delivered')?.count || 0 },
      ]
    },
    totalContent: {
      title: 'Content Pieces',
      description: 'Total content items planned or published across all platforms.',
      breakdown: [
        { label: 'Published', value: contentStatusCount('published') },
        { label: 'Scheduled', value: contentStatusCount('scheduled') },
        { label: 'Draft', value: contentStatusCount('draft') },
      ]
    },
    totalIncome: {
      title: 'Total Income',
      description: 'Revenue from paid brand deals and other sources.',
      breakdown: incomeSources.length > 0 
        ? incomeSources.map(s => ({ 
            label: s.source.length > 15 ? s.source.substring(0, 12) + '...' : s.source, 
            value: formatCurrency(s.amount || 0) 
          }))
        : monthlyIncome.slice(0, 3).map(m => ({
            label: m.month,
            value: formatCurrency(m.amount || 0)
          }))
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of your creator business</p>
        </div>
        <ExportMenu
          reportName="dashboard-report"
          columns={dashboardExportColumns}
          filteredRows={dashboardExportRows}
          fullRows={dashboardExportRows}
          filters={{ page: 'dashboard' }}
          onExport={({ scope, filters }) => exportDashboardReport({
            stats,
            pipelineStats,
            contentStatusStats,
            scope,
            filters,
          })}
        />
      </div>

      {/* Stats Grid - Clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Deals"
          value={stats.totalDeals || 0}
          icon={Handshake}
          color="purple"
          trend="+12%"
          onClick={() => setSelectedCard('totalDeals')}
        />
        <StatCard
          title="Active Deals"
          value={stats.activeDeals || 0}
          icon={Info}
          color="blue"
          trend="+5%"
          onClick={() => setSelectedCard('activeDeals')}
        />
        <StatCard
          title="Content Pieces"
          value={stats.totalContent || 0}
          icon={CalendarDays}
          color="orange"
          trend="+8%"
          onClick={() => setSelectedCard('totalContent')}
        />
        <StatCard
          title="Total Income"
          value={formatCurrency(stats.totalIncome || 0)}
          icon={DollarSign}
          color="green"
          trend="+23%"
          isCurrency
          onClick={() => setSelectedCard('totalIncome')}
        />
      </div>

      {/* Card Detail Popup */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedCard(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{cardDetails[selectedCard].title}</h3>
              <button onClick={() => setSelectedCard(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">{cardDetails[selectedCard].description}</p>
            <div className="space-y-2">
              {cardDetails[selectedCard].breakdown.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Income Trend</h3>
              <p className="text-sm text-gray-500">Monthly revenue over time</p>
            </div>
            <div className="flex items-center gap-1 text-sm text-green-600 font-medium">
              <TrendingUp className="w-4 h-4" /><span>+18.2%</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={incomeData}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d946ef" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#d946ef" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} formatter={(value) => [formatCurrency(value), 'Revenue']} />
                <Area type="monotone" dataKey="amount" stroke="#d946ef" strokeWidth={2} fill="url(#incomeGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Deal Pipeline</h3>
              <p className="text-sm text-gray-500">Deals by stage</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineStats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="pipeline_stage" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} width={100} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={32}>
                  {pipelineStats.map((entry, index) => (
                    <Cell key={index} fill={pipelineColors[entry.pipeline_stage] || '#d946ef'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, trend, isCurrency, onClick }) {
  const colorMap = {
    purple: 'bg-purple-50 text-purple-600',
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    green: 'bg-green-50 text-green-600',
  };

  return (
    <div onClick={onClick} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all cursor-pointer group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-3 text-sm">
          <ArrowUpRight className="w-4 h-4 text-green-500" />
          <span className="text-green-600 font-medium">{trend}</span>
          <span className="text-gray-400">vs last month</span>
        </div>
      )}
      <div className="mt-3 flex items-center gap-1 text-xs text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
        <Info className="w-3 h-3" /> Click for details
      </div>
    </div>
  );
}

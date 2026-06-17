import { useEffect, useState } from 'react';
import { api, formatCurrency, formatDate } from '../lib/utils';
import ExportMenu from '../components/ExportMenu';
import {
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  PiggyBank,
  CreditCard,
  X,
  Pencil,
  Trash2,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const INCOME_CATEGORIES = [
  { id: 'brand_deal', label: 'Brand Deal', color: '#d946ef' },
  { id: 'affiliate', label: 'Affiliate', color: '#818cf8' },
  { id: 'ad_revenue', label: 'Ad Revenue', color: '#60a5fa' },
  { id: 'product', label: 'Product Sales', color: '#34d399' },
  { id: 'consulting', label: 'Consulting', color: '#fbbf24' },
  { id: 'other', label: 'Other', color: '#9ca3af' },
];

export default function Income() {
  const [income, setIncome] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [dateFilterType, setDateFilterType] = useState('all');
  const [dateFilterValue, setDateFilterValue] = useState('');
  const [dateFilterEndValue, setDateFilterEndValue] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIncome, setEditingIncome] = useState(null);
  const [incomeToDelete, setIncomeToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIncomeIds, setSelectedIncomeIds] = useState([]);

  useEffect(() => {
    loadIncome();
  }, []);

  const loadIncome = () => {
    return api('/income')
      .then(data => setIncome(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const filteredIncome = income.filter(item => {
    const matchesSearch = item.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    const matchesDate = matchesDateFilter(item.date, dateFilterType, dateFilterValue, dateFilterEndValue);
    return matchesSearch && matchesCategory && matchesDate;
  });
  const selectedIncome = filteredIncome.filter(item => selectedIncomeIds.includes(item.id));
  const incomeExportColumns = [
    { header: 'Source', key: 'source' },
    { header: 'Category', key: 'category' },
    { header: 'Amount', key: 'amount', type: 'currency' },
    { header: 'Currency', key: 'currency' },
    { header: 'Date', key: 'date', type: 'date' },
    { header: 'Status', key: 'status' },
    { header: 'Description', key: 'description' },
  ];

  const toggleIncomeSelection = (id) => {
    setSelectedIncomeIds(current => current.includes(id)
      ? current.filter(itemId => itemId !== id)
      : [...current, id]);
  };

  const toggleAllVisibleIncome = () => {
    const visibleIds = filteredIncome.map(item => item.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIncomeIds.includes(id));
    setSelectedIncomeIds(allVisibleSelected
      ? selectedIncomeIds.filter(id => !visibleIds.includes(id))
      : Array.from(new Set([...selectedIncomeIds, ...visibleIds])));
  };

  const totalIncome = filteredIncome.reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalReceived = filteredIncome.filter(i => i.status === 'received').reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalPending = filteredIncome.filter(i => i.status === 'pending').reduce((sum, i) => sum + (i.amount || 0), 0);

  const handleDeleteIncome = async () => {
    if (!incomeToDelete) return;

    setDeleting(true);
    try {
      await api(`/income/${incomeToDelete.id}`, { method: 'DELETE' });
      await loadIncome();
      setIncomeToDelete(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Category breakdown for pie chart - show by source (brand names)
  const sourceData = {};
  filteredIncome.forEach(item => {
    if (!sourceData[item.source]) {
      sourceData[item.source] = 0;
    }
    sourceData[item.source] += item.amount || 0;
  });

  // Get top 5 sources, group rest as "Others"
  const sortedSources = Object.entries(sourceData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const colors = ['#d946ef', '#818cf8', '#60a5fa', '#34d399', '#fbbf24', '#9ca3af'];

  const categoryData = sortedSources.map(([source, amount], idx) => ({
    name: source.length > 12 ? source.substring(0, 10) + '..' : source,
    fullName: source,
    value: amount,
    color: colors[idx % colors.length]
  })).filter(d => d.value > 0);

  // Monthly trend
  const monthlyData = {};
  filteredIncome.forEach(item => {
    const month = item.date?.substring(0, 7) || 'Unknown';
    if (!monthlyData[month]) monthlyData[month] = 0;
    monthlyData[month] += item.amount || 0;
  });

  const sortedMonths = Object.keys(monthlyData).sort().slice(-6);
  const trend = sortedMonths.length >= 2 
    ? ((monthlyData[sortedMonths[sortedMonths.length - 1]] - monthlyData[sortedMonths[sortedMonths.length - 2]]) / monthlyData[sortedMonths[sortedMonths.length - 2]] * 100).toFixed(1)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Income Tracker</h1>
          <p className="text-gray-500 mt-1">Track and analyze your revenue</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            reportName="income-report"
            columns={incomeExportColumns}
            filteredRows={filteredIncome}
            fullRows={income}
            selectedRows={selectedIncome}
            filters={{ searchQuery, filterCategory, dateFilterType, dateFilterValue, dateFilterEndValue }}
          />
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Log Income
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-500">Total Income</p>
            <div className="p-2 bg-brand-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-brand-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalIncome)}</p>
          <div className="flex items-center gap-1 mt-2 text-sm">
            {Number(trend) >= 0 ? (
              <ArrowUpRight className="w-4 h-4 text-green-500" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-red-500" />
            )}
            <span className={Number(trend) >= 0 ? 'text-green-600' : 'text-red-600'}>
              {Math.abs(Number(trend))}%
            </span>
            <span className="text-gray-400">vs last month</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-500">Received</p>
            <div className="p-2 bg-green-50 rounded-lg">
              <Wallet className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalReceived)}</p>
          <p className="text-sm text-gray-400 mt-2">{Math.round((totalReceived / (totalIncome || 1)) * 100)}% of total</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-500">Pending</p>
            <div className="p-2 bg-amber-50 rounded-lg">
              <PiggyBank className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalPending)}</p>
          <p className="text-sm text-gray-400 mt-2">{income.filter(i => i.status === 'pending').length} invoices</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Income by Category</h3>
          <p className="text-sm text-gray-500 mb-6">Where your money comes from</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name, props) => {
                  const fullName = props?.payload?.fullName || name;
                  return [formatCurrency(value), fullName];
                }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Recent Transactions</h3>
          <p className="text-sm text-gray-500 mb-6">Latest income entries</p>
          <div className="space-y-4 max-h-64 overflow-y-auto">
            {filteredIncome.slice(0, 10).map(item => {
              const cat = INCOME_CATEGORIES.find(c => c.id === item.category) || INCOME_CATEGORIES[5];
              return (
                <div key={item.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                      <DollarSign className="w-4 h-4" style={{ color: cat.color }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.source}</p>
                      <p className="text-xs text-gray-500">{cat.label} • {formatDate(item.date)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(item.amount)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${item.status === 'received' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              );
            })}
            {filteredIncome.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">No income entries yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          <option value="all">All Categories</option>
          {INCOME_CATEGORIES.map(c => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <select
          value={dateFilterType}
          onChange={(e) => { setDateFilterType(e.target.value); setDateFilterValue(''); setDateFilterEndValue(''); }}
          className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          <option value="all">All Dates</option>
          <option value="today">Today</option>
          <option value="last7">Last 7 Days</option>
          <option value="last30">Last 30 Days</option>
          <option value="month">By Month</option>
          <option value="range">Custom Range</option>
        </select>
        {dateFilterType === 'month' && (
          <input
            type="month"
            value={dateFilterValue}
            onChange={(e) => setDateFilterValue(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          />
        )}
        {dateFilterType === 'range' && (
          <>
            <input
              type="date"
              value={dateFilterValue}
              onChange={(e) => setDateFilterValue(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            />
            <input
              type="date"
              value={dateFilterEndValue}
              onChange={(e) => setDateFilterEndValue(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            />
          </>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3">
                  <input
                    type="checkbox"
                    checked={filteredIncome.length > 0 && filteredIncome.every(item => selectedIncomeIds.includes(item.id))}
                    onChange={toggleAllVisibleIncome}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    aria-label="Select all visible income rows"
                  />
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Source</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Category</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Amount</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredIncome.map(item => {
                const cat = INCOME_CATEGORIES.find(c => c.id === item.category) || INCOME_CATEGORIES[5];
                return (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIncomeIds.includes(item.id)}
                        onChange={() => toggleIncomeSelection(item.id)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        aria-label={`Select ${item.source}`}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{item.source}</p>
                      {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(item.amount)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">{formatDate(item.date)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${item.status === 'received' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingIncome(item)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                          title="Edit income"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIncomeToDelete(item)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Delete income"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredIncome.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    No income entries found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Income Modal */}
      {showAddModal && (
        <IncomeModal onClose={() => setShowAddModal(false)} onSuccess={loadIncome} />
      )}

      {editingIncome && (
        <IncomeModal
          incomeItem={editingIncome}
          onClose={() => setEditingIncome(null)}
          onSuccess={loadIncome}
        />
      )}

      {incomeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Delete income?</h2>
              <button onClick={() => setIncomeToDelete(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600">
                This will remove the income entry for <span className="font-semibold text-gray-900">{incomeToDelete.source}</span>.
                {incomeToDelete.deal_id && ' Since it is linked to a brand deal, that deal will be deleted from Deals CRM too.'}
              </p>
              <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-medium text-gray-900">{formatCurrency(incomeToDelete.amount)}</span>
                </div>
                <div className="flex justify-between gap-4 mt-2">
                  <span className="text-gray-500">Status</span>
                  <span className="font-medium text-gray-900">{incomeToDelete.status}</span>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIncomeToDelete(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteIncome}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function matchesDateFilter(dateValue, filterType, filterValue, endValue) {
  if (filterType === 'all') return true;
  if (!dateValue) return false;

  const normalizedDate = String(dateValue).split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  const daysAgo = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  };

  if (filterType === 'today') return normalizedDate === today;
  if (filterType === 'last7') return normalizedDate >= daysAgo(6) && normalizedDate <= today;
  if (filterType === 'last30') return normalizedDate >= daysAgo(29) && normalizedDate <= today;
  if (filterType === 'month') return filterValue ? normalizedDate.startsWith(filterValue) : true;
  if (filterType === 'range') {
    const startsAfter = filterValue ? normalizedDate >= filterValue : true;
    const endsBefore = endValue ? normalizedDate <= endValue : true;
    return startsAfter && endsBefore;
  }
  return true;
}

function IncomeModal({ incomeItem, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    source: incomeItem?.source || '',
    amount: incomeItem?.amount || '',
    currency: incomeItem?.currency || 'USD',
    date: incomeItem?.date || new Date().toISOString().split('T')[0],
    category: incomeItem?.category || 'brand_deal',
    status: incomeItem?.status || 'received',
    description: incomeItem?.description || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api(incomeItem ? `/income/${incomeItem.id}` : '/income', {
        method: incomeItem ? 'PUT' : 'POST',
        body: JSON.stringify({ ...formData, amount: Number(formData.amount) })
      });
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{incomeItem ? 'Edit Income' : 'Log Income'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source *</label>
            <input
              required
              value={formData.source}
              onChange={e => setFormData({...formData, source: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Brand name or source"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="5000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={formData.currency}
                onChange={e => setFormData({...formData, currency: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {INCOME_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <div className="flex gap-3">
              {['received', 'pending'].map(status => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFormData({...formData, status})}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    formData.status === status
                      ? status === 'received' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-amber-50 border-amber-300 text-amber-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Optional notes..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : incomeItem ? 'Update Income' : 'Log Income'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

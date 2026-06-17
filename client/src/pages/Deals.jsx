import { useEffect, useState } from 'react';
import { api, formatCurrency, formatDate } from '../lib/utils';
import ExportMenu from '../components/ExportMenu';
import {
  Plus, Search, MoreHorizontal, Calendar, X,
  Instagram, Youtube, Video, FileText, MessageCircle, Globe
} from 'lucide-react';

const PIPELINE_STAGES = [
  { id: 'all', label: 'All', color: 'bg-gray-900 text-white', activeColor: 'bg-gray-900 text-white', inactiveColor: 'bg-gray-100 text-gray-600' },
  { id: 'outreach', label: 'Outreach', color: 'bg-purple-500', activeColor: 'bg-purple-600 text-white', inactiveColor: 'bg-purple-50 text-purple-700' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-blue-500', activeColor: 'bg-blue-600 text-white', inactiveColor: 'bg-blue-50 text-blue-700' },
  { id: 'contract', label: 'Contract', color: 'bg-indigo-500', activeColor: 'bg-indigo-600 text-white', inactiveColor: 'bg-indigo-50 text-indigo-700' },
  { id: 'delivered', label: 'Delivered', color: 'bg-amber-500', activeColor: 'bg-amber-600 text-white', inactiveColor: 'bg-amber-50 text-amber-700' },
  { id: 'paid', label: 'Paid', color: 'bg-green-500', activeColor: 'bg-green-600 text-white', inactiveColor: 'bg-green-50 text-green-700' },
];

const SOCIAL_PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'tiktok', label: 'TikTok', icon: Video },
  { id: 'twitter', label: 'X', icon: FileText },
  { id: 'facebook', label: 'Facebook', icon: MessageCircle },
  { id: 'linkedin', label: 'LinkedIn', icon: Globe },
  { id: 'blog', label: 'Blog', icon: FileText },
  { id: 'other', label: 'Other', icon: Globe },
];

const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
];

export default function Deals() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState('all');
  const [dateFilterType, setDateFilterType] = useState('all');
  const [dateFilterValue, setDateFilterValue] = useState('');
  const [dateFilterEndValue, setDateFilterEndValue] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);

  useEffect(() => { loadDeals(); }, []);

  const loadDeals = () => {
    api('/deals')
      .then(data => setDeals(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const filteredDeals = deals.filter(deal => {
    const matchesSearch = deal.brand_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         deal.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = filterStage === 'all' || deal.pipeline_stage === filterStage;
    const matchesDate = matchesDateFilter(deal.end_date || deal.start_date || deal.created_at, dateFilterType, dateFilterValue, dateFilterEndValue);
    return matchesSearch && matchesStage && matchesDate;
  });
  const dealExportColumns = [
    { header: 'Brand', key: 'brand_name' },
    { header: 'Contact Name', key: 'contact_name' },
    { header: 'Contact Email', key: 'contact_email' },
    { header: 'Value', key: 'value', type: 'currency' },
    { header: 'Currency', key: 'currency' },
    { header: 'Stage', key: 'pipeline_stage' },
    { header: 'Platforms', value: row => (row.platforms || []).join(', ') },
    { header: 'Start Date', key: 'start_date', type: 'date' },
    { header: 'End Date', key: 'end_date', type: 'date' },
    { header: 'Description', key: 'description' },
    { header: 'Notes', key: 'notes' },
  ];

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Deals</h1>
        <div className="flex items-center gap-2">
          <ExportMenu
            reportName="deals-report"
            columns={dealExportColumns}
            filteredRows={filteredDeals}
            fullRows={deals}
            filters={{ searchQuery, filterStage, dateFilterType, dateFilterValue, dateFilterEndValue }}
          />
          <button onClick={() => setShowAddModal(true)}
            className="w-10 h-10 bg-brand-600 hover:bg-brand-700 text-white rounded-full flex items-center justify-center transition-colors shadow-lg">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input 
          type="text" 
          placeholder="Search brands..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-gray-100 border-0 rounded-2xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all" 
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={dateFilterType}
          onChange={(e) => { setDateFilterType(e.target.value); setDateFilterValue(''); setDateFilterEndValue(''); }}
          className="px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
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
            className="px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          />
        )}
        {dateFilterType === 'range' && (
          <>
            <input
              type="date"
              value={dateFilterValue}
              onChange={(e) => setDateFilterValue(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            />
            <input
              type="date"
              value={dateFilterEndValue}
              onChange={(e) => setDateFilterEndValue(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            />
          </>
        )}
      </div>

      {/* Stage Filter Boxes - 6 in a row */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {PIPELINE_STAGES.map(stage => {
          const count = stage.id === 'all' 
            ? deals.length 
            : deals.filter(d => d.pipeline_stage === stage.id).length;
          const isActive = filterStage === stage.id;
          return (
            <button
              key={stage.id}
              onClick={() => setFilterStage(stage.id)}
              className={`flex-shrink-0 px-4 py-3 rounded-2xl text-sm font-medium transition-all min-w-[100px] ${
                isActive ? stage.activeColor : stage.inactiveColor
              }`}
            >
              <span className="block text-center">{stage.label}</span>
              <span className={`block text-center text-xs mt-0.5 ${isActive ? 'text-white/80' : 'text-gray-400'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Deals List */}
      <div className="space-y-3">
        {filteredDeals.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg">No deals found</p>
            <p className="text-sm mt-1">Tap + to add your first deal</p>
          </div>
        )}

        {filteredDeals.map(deal => {
          const stageInfo = PIPELINE_STAGES.find(s => s.id === deal.pipeline_stage) || PIPELINE_STAGES[1];
          const stageColorClass = stageInfo.inactiveColor;

          return (
            <div 
              key={deal.id} 
              onClick={() => setEditingDeal(deal)}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Brand Avatar */}
                  <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-brand-700">
                      {deal.brand_name?.charAt(0)?.toUpperCase() || 'B'}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900">{deal.brand_name}</h3>
                    <p className="text-sm text-gray-500">{deal.contact_name || 'No contact'}</p>

                    {/* Status Badge */}
                    <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${stageColorClass}`}>
                      {stageInfo.label}
                    </span>

                    {/* Platform icons */}
                    {deal.platforms && deal.platforms.length > 0 && (
                      <div className="flex gap-1 mt-1.5">
                        {deal.platforms.slice(0, 3).map(platformId => {
                          const platform = SOCIAL_PLATFORMS.find(p => p.id === platformId);
                          if (!platform) return null;
                          const Icon = platform.icon;
                          return (
                            <span key={platformId} className="text-gray-400">
                              <Icon className="w-3.5 h-3.5" />
                            </span>
                          );
                        })}
                        {deal.platforms.length > 3 && (
                          <span className="text-xs text-gray-400">+{deal.platforms.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Value */}
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">
                    {deal.value >= 1000 
                      ? `$${(deal.value / 1000).toFixed(deal.value % 1000 === 0 ? 0 : 1)}K` 
                      : formatCurrency(deal.value || 0)}
                  </p>
                  {deal.end_date && (
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(deal.end_date)}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingDeal) && (
        <DealModal 
          deal={editingDeal} 
          onClose={() => { setShowAddModal(false); setEditingDeal(null); }} 
          onSuccess={loadDeals} 
        />
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

function DealModal({ deal, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    brand_name: deal?.brand_name || '',
    contact_name: deal?.contact_name || '',
    contact_email: deal?.contact_email || '',
    value: deal?.value || '',
    currency: deal?.currency || 'USD',
    pipeline_stage: deal?.pipeline_stage || 'outreach',
    description: deal?.description || '',
    platforms: deal?.platforms || [],
    start_date: deal?.start_date || '',
    end_date: deal?.end_date || '',
    notes: deal?.notes || ''
  });
  const [saving, setSaving] = useState(false);

  const togglePlatform = (platformId) => {
    const newPlatforms = formData.platforms.includes(platformId)
      ? formData.platforms.filter(p => p !== platformId)
      : [...formData.platforms, platformId];
    setFormData({ ...formData, platforms: newPlatforms });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...formData, deliverables: [] };
      if (deal) {
        await api(`/deals/${deal.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/deals', { method: 'POST', body: JSON.stringify(payload) });
      }
      onSuccess(); onClose();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const stageButtons = [
    { id: 'outreach', label: 'Outreach', color: 'bg-purple-500' },
    { id: 'negotiation', label: 'Negotiation', color: 'bg-blue-500' },
    { id: 'contract', label: 'Contract', color: 'bg-indigo-500' },
    { id: 'delivered', label: 'Delivered', color: 'bg-amber-500' },
    { id: 'paid', label: 'Paid', color: 'bg-green-500' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{deal ? 'Edit Deal' : 'New Deal'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name *</label>
            <input required value={formData.brand_name} onChange={e => setFormData({...formData, brand_name: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all" placeholder="e.g. Nike, Sephora" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <input value={formData.contact_name} onChange={e => setFormData({...formData, contact_name: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all" placeholder="John Smith" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
              <input type="email" value={formData.contact_email} onChange={e => setFormData({...formData, contact_email: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all" placeholder="john@brand.com" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deal Value</label>
              <input type="number" value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all" placeholder="5000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all appearance-none">
                {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Social Media Platforms</label>
            <div className="flex flex-wrap gap-2">
              {SOCIAL_PLATFORMS.map(platform => {
                const Icon = platform.icon;
                const isSelected = formData.platforms.includes(platform.id);
                return (
                  <button key={platform.id} type="button" onClick={() => togglePlatform(platform.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                      isSelected ? 'bg-brand-50 border-brand-300 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}>
                    <Icon className="w-4 h-4" /> {platform.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Stage</label>
            <div className="flex gap-2">
              {stageButtons.map(s => {
                const isActive = formData.pipeline_stage === s.id;
                return (
                  <button key={s.id} type="button" onClick={() => setFormData({...formData, pipeline_stage: s.id})}
                    className={`flex-1 py-2.5 px-1 rounded-xl text-xs font-medium transition-all ${
                      isActive ? `${s.color} text-white shadow-md` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3}
              className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all" placeholder="Campaign details, deliverables..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} rows={2}
              className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all" placeholder="Internal notes..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl disabled:opacity-50 transition-colors shadow-lg shadow-brand-200">
              {saving ? 'Saving...' : deal ? 'Update Deal' : 'Create Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

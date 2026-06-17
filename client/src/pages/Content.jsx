import { useEffect, useState } from 'react';
import { api, formatDate } from '../lib/utils';
import ExportMenu from '../components/ExportMenu';
import {
  Plus,
  Search,
  Calendar,
  Instagram,
  Youtube,
  Video,
  FileText,
  Image,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-600 bg-pink-50' },
  { id: 'tiktok', label: 'TikTok', icon: Video, color: 'text-gray-900 bg-gray-100' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, color: 'text-red-600 bg-red-50' },
  { id: 'twitter', label: 'X/Twitter', icon: FileText, color: 'text-blue-500 bg-blue-50' },
  { id: 'blog', label: 'Blog', icon: FileText, color: 'text-orange-600 bg-orange-50' },
];

const CONTENT_TYPES = ['post', 'story', 'reel', 'video', 'carousel', 'blog_post'];
const STATUS_OPTIONS = ['draft', 'scheduled', 'published'];

export default function Content() {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateFilterType, setDateFilterType] = useState('all');
  const [dateFilterValue, setDateFilterValue] = useState('');
  const [dateFilterEndValue, setDateFilterEndValue] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContent, setEditingContent] = useState(null);
  const [contentToDelete, setContentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedContentIds, setSelectedContentIds] = useState([]);

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = () => {
    return api('/content')
      .then(data => setContent(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const filteredContent = content.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlatform = filterPlatform === 'all' || item.platform === filterPlatform;
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchesDate = matchesDateFilter(item.scheduled_date || item.published_date || item.created_at, dateFilterType, dateFilterValue, dateFilterEndValue);
    return matchesSearch && matchesPlatform && matchesStatus && matchesDate;
  });
  const selectedContent = filteredContent.filter(item => selectedContentIds.includes(item.id));
  const contentExportColumns = [
    { header: 'Title', key: 'title' },
    { header: 'Platform', key: 'platform' },
    { header: 'Type', key: 'content_type' },
    { header: 'Status', key: 'status' },
    { header: 'Scheduled Date', key: 'scheduled_date', type: 'date' },
    { header: 'Published Date', key: 'published_date', type: 'date' },
    { header: 'Created At', key: 'created_at', type: 'date' },
  ];

  const toggleContentSelection = (id) => {
    setSelectedContentIds(current => current.includes(id)
      ? current.filter(itemId => itemId !== id)
      : [...current, id]);
  };

  const toggleAllVisibleContent = () => {
    const visibleIds = filteredContent.map(item => item.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedContentIds.includes(id));
    setSelectedContentIds(allVisibleSelected
      ? selectedContentIds.filter(id => !visibleIds.includes(id))
      : Array.from(new Set([...selectedContentIds, ...visibleIds])));
  };

  const getPlatformInfo = (platformId) => PLATFORMS.find(p => p.id === platformId) || PLATFORMS[0];

  const getStatusIcon = (status) => {
    switch (status) {
      case 'published': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'scheduled': return <Clock className="w-4 h-4 text-blue-500" />;
      default: return <AlertCircle className="w-4 h-4 text-amber-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-700';
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      default: return 'bg-amber-100 text-amber-700';
    }
  };

  const updateStatus = async (item, status) => {
    try {
      await api(`/content/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      await loadContent();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteContent = async () => {
    if (!contentToDelete) return;

    setDeleting(true);
    try {
      await api(`/content/${contentToDelete.id}`, { method: 'DELETE' });
      await loadContent();
      setContentToDelete(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Calendar view helpers
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const contentByDate = {};
  filteredContent.forEach(item => {
    if (item.scheduled_date) {
      const date = item.scheduled_date.split('T')[0];
      if (!contentByDate[date]) contentByDate[date] = [];
      contentByDate[date].push(item);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Calendar</h1>
          <p className="text-gray-500 mt-1">Plan and track your content</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportMenu
            reportName="content-report"
            columns={contentExportColumns}
            filteredRows={filteredContent}
            fullRows={content}
            selectedRows={selectedContent}
            filters={{ searchQuery, filterPlatform, filterStatus, dateFilterType, dateFilterValue, dateFilterEndValue, viewMode }}
          />
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              Calendar
            </button>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Content
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          <option value="all">All Platforms</option>
          {PLATFORMS.map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          <option value="all">All Status</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
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

      {/* Content List View */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3">
                    <input
                      type="checkbox"
                      checked={filteredContent.length > 0 && filteredContent.every(item => selectedContentIds.includes(item.id))}
                      onChange={toggleAllVisibleContent}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      aria-label="Select all visible content rows"
                    />
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Content</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Platform</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Type</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Date</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Progress</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredContent.map(item => {
                  const platform = getPlatformInfo(item.platform);
                  const PlatformIcon = platform.icon;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedContentIds.includes(item.id)}
                          onChange={() => toggleContentSelection(item.id)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                          aria-label={`Select ${item.title}`}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${platform.color}`}>
                            <PlatformIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{item.title}</p>
                            {item.deal_id && (
                              <p className="text-xs text-gray-400">Sponsored content</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{platform.label}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 capitalize">{item.content_type}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                          {getStatusIcon(item.status)}
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-500">
                          {item.scheduled_date ? formatDate(item.scheduled_date) : 'Not scheduled'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <StatusStepper status={item.status} onChange={(status) => updateStatus(item, status)} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingContent(item)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                            title="Edit content"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setContentToDelete(item)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Delete content"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredContent.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                      No content found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">{monthName}</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentMonth(new Date())}
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Today
              </button>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 text-center">
                {day}
              </div>
            ))}

            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-white min-h-[100px]" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, day) => {
              const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day + 1).padStart(2, '0')}`;
              const dayContent = contentByDate[dateStr] || [];
              const isToday = dateStr === new Date().toISOString().split('T')[0];

              return (
                <div key={day} className={`bg-white min-h-[100px] p-2 ${isToday ? 'ring-2 ring-brand-200 ring-inset' : ''}`}>
                  <span className={`text-sm font-medium ${isToday ? 'text-brand-600' : 'text-gray-700'}`}>
                    {day + 1}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayContent.slice(0, 3).map(item => {
                      const platform = getPlatformInfo(item.platform);
                      return (
                        <div key={item.id} className={`text-xs px-1.5 py-0.5 rounded ${platform.color} truncate`}>
                          {item.title}
                        </div>
                      );
                    })}
                    {dayContent.length > 3 && (
                      <div className="text-xs text-gray-400 px-1.5">+{dayContent.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Content Modal */}
      {showAddModal && (
        <ContentModal onClose={() => setShowAddModal(false)} onSuccess={loadContent} />
      )}

      {editingContent && (
        <ContentModal
          contentItem={editingContent}
          onClose={() => setEditingContent(null)}
          onSuccess={loadContent}
        />
      )}

      {contentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Delete content?</h2>
              <button onClick={() => setContentToDelete(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600">
                This will permanently remove <span className="font-semibold text-gray-900">{contentToDelete.title}</span> from your content calendar.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setContentToDelete(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteContent}
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

function StatusStepper({ status, onChange }) {
  const steps = [
    { id: 'draft', label: 'D' },
    { id: 'scheduled', label: 'S' },
    { id: 'published', label: 'P' },
  ];
  const activeIndex = Math.max(0, steps.findIndex(step => step.id === status));

  return (
    <div className="inline-flex items-center">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <button
            type="button"
            onClick={() => onChange(step.id)}
            className={`h-7 w-7 rounded-full text-xs font-semibold transition-colors ${
              index <= activeIndex ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            title={step.id.charAt(0).toUpperCase() + step.id.slice(1)}
          >
            {step.label}
          </button>
          {index < steps.length - 1 && (
            <div className={`h-0.5 w-5 ${index < activeIndex ? 'bg-brand-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function ContentModal({ contentItem, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    title: contentItem?.title || '',
    platform: contentItem?.platform || 'instagram',
    content_type: contentItem?.content_type || 'post',
    status: contentItem?.status || 'draft',
    scheduled_date: contentItem?.scheduled_date || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api(contentItem ? `/content/${contentItem.id}` : '/content', {
        method: contentItem ? 'PUT' : 'POST',
        body: JSON.stringify(formData)
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
          <h2 className="text-lg font-semibold text-gray-900">{contentItem ? 'Edit Content' : 'Add Content'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              required
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Summer collection review"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <select
                value={formData.platform}
                onChange={e => setFormData({...formData, platform: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {PLATFORMS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.content_type}
                onChange={e => setFormData({...formData, content_type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {CONTENT_TYPES.map(t => (
                  <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date</label>
              <input
                type="date"
                value={formData.scheduled_date}
                onChange={e => setFormData({...formData, scheduled_date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
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
              {saving ? 'Saving...' : contentItem ? 'Update Content' : 'Add Content'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

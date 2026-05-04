import { useEffect, useState } from 'react';
import { api, formatCurrency, formatNumber } from '../lib/utils';
import {
  Plus,
  Instagram,
  Youtube,
  Video,
  FileText,
  X,
  Copy,
  Check,
  Star,
  Users,
  Heart,
  Eye
} from 'lucide-react';

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'tiktok', label: 'TikTok', icon: Video },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'twitter', label: 'X/Twitter', icon: FileText },
  { id: 'blog', label: 'Blog', icon: FileText },
];

const SERVICE_TYPES = [
  { id: 'feed_post', label: 'Feed Post' },
  { id: 'story', label: 'Story' },
  { id: 'reel', label: 'Reel/Short' },
  { id: 'video', label: 'Long-form Video' },
  { id: 'live', label: 'Live Stream' },
  { id: 'blog_post', label: 'Blog Post' },
  { id: 'sponsored', label: 'Sponsored Content' },
  { id: 'ambassador', label: 'Brand Ambassador' },
];

export default function RateCard() {
  const [rateCards, setRateCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadRateCards();
  }, []);

  const loadRateCards = () => {
    api('/rate-cards')
      .then(data => setRateCards(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const activeCard = rateCards.find(c => c.is_default) || rateCards[0];

  const copyRateCard = () => {
    if (!activeCard) return;
    const text = generateRateCardText(activeCard);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rate Card</h1>
          <p className="text-gray-500 mt-1">Create and share your media kit</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Rate Card
        </button>
      </div>

      {activeCard ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Preview Card */}
          <div className="lg:col-span-2 space-y-6">
            {/* Media Kit Header */}
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center">
                    <Star className="w-8 h-8 text-brand-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{activeCard.name}</h2>
                    <p className="text-gray-500">Media Kit & Rate Card</p>
                  </div>
                </div>
                <button
                  onClick={copyRateCard}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Users className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{formatNumber(activeCard.audience_size || 0)}</p>
                  <p className="text-xs text-gray-500">Followers</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Heart className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{activeCard.engagement_rate || 0}%</p>
                  <p className="text-xs text-gray-500">Engagement</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Eye className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{activeCard.platforms?.length || 0}</p>
                  <p className="text-xs text-gray-500">Platforms</p>
                </div>
              </div>

              {/* Platforms */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Platforms</h3>
                <div className="flex flex-wrap gap-2">
                  {activeCard.platforms?.map(platformId => {
                    const platform = PLATFORMS.find(p => p.id === platformId);
                    if (!platform) return null;
                    const Icon = platform.icon;
                    return (
                      <span key={platformId} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full text-sm text-gray-700">
                        <Icon className="w-4 h-4" />
                        {platform.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Pricing Tiers */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Services & Pricing</h3>
                <div className="space-y-3">
                  {activeCard.pricing_tiers?.map((tier, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors">
                      <div>
                        <p className="font-medium text-gray-900">{tier.service}</p>
                        {tier.description && <p className="text-sm text-gray-500">{tier.description}</p>}
                      </div>
                      <p className="text-lg font-bold text-brand-600">{formatCurrency(tier.price)}</p>
                    </div>
                  ))}
                  {(!activeCard.pricing_tiers || activeCard.pricing_tiers.length === 0) && (
                    <p className="text-gray-400 text-sm text-center py-4">No pricing tiers added yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Your Rate Cards</h3>
              <div className="space-y-2">
                {rateCards.map(card => (
                  <div
                    key={card.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      card.id === activeCard.id 
                        ? 'border-brand-300 bg-brand-50' 
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{card.name}</span>
                      {card.is_default && (
                        <span className="text-xs px-2 py-0.5 bg-brand-100 text-brand-700 rounded-full">Default</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-brand-600 to-brand-700 rounded-xl p-5 text-white">
              <h3 className="font-semibold mb-2">Pro Tip</h3>
              <p className="text-sm text-brand-100">
                Update your rate card monthly to reflect your growing audience. Brands expect current metrics.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Star className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Rate Card Yet</h3>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            Create your first rate card to share with brands and track your pricing over time.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Rate Card
          </button>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <RateCardModal onClose={() => setShowAddModal(false)} onSuccess={loadRateCards} />
      )}
    </div>
  );
}

function RateCardModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: 'My Media Kit',
    platforms: ['instagram'],
    audience_size: '',
    engagement_rate: '',
    pricing_tiers: [{ service: 'Feed Post', price: '', description: '' }],
    is_default: true
  });
  const [saving, setSaving] = useState(false);

  const addTier = () => {
    setFormData({
      ...formData,
      pricing_tiers: [...formData.pricing_tiers, { service: '', price: '', description: '' }]
    });
  };

  const removeTier = (idx) => {
    setFormData({
      ...formData,
      pricing_tiers: formData.pricing_tiers.filter((_, i) => i !== idx)
    });
  };

  const updateTier = (idx, field, value) => {
    const newTiers = [...formData.pricing_tiers];
    newTiers[idx][field] = value;
    setFormData({ ...formData, pricing_tiers: newTiers });
  };

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
      await api('/rate-cards', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          audience_size: Number(formData.audience_size) || 0,
          engagement_rate: Number(formData.engagement_rate) || 0,
          pricing_tiers: formData.pricing_tiers.map(t => ({
            ...t,
            price: Number(t.price) || 0
          }))
        })
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Create Rate Card</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rate Card Name</label>
            <input
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="My Media Kit 2026"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Platforms</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(platform => {
                const Icon = platform.icon;
                const isSelected = formData.platforms.includes(platform.id);
                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => togglePlatform(platform.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      isSelected
                        ? 'bg-brand-50 border-brand-300 text-brand-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {platform.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Audience Size</label>
              <input
                type="number"
                value={formData.audience_size}
                onChange={e => setFormData({...formData, audience_size: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="50000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Engagement Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={formData.engagement_rate}
                onChange={e => setFormData({...formData, engagement_rate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="4.5"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Pricing Tiers</label>
              <button
                type="button"
                onClick={addTier}
                className="text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                + Add Tier
              </button>
            </div>
            <div className="space-y-3">
              {formData.pricing_tiers.map((tier, idx) => (
                <div key={idx} className="p-3 border border-gray-200 rounded-lg space-y-3">
                  <div className="flex gap-3">
                    <select
                      value={tier.service}
                      onChange={e => updateTier(idx, 'service', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                    >
                      {SERVICE_TYPES.map(s => (
                        <option key={s.id} value={s.label}>{s.label}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={tier.price}
                      onChange={e => updateTier(idx, 'price', e.target.value)}
                      placeholder="Price"
                      className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                    />
                    {formData.pricing_tiers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTier(idx)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={tier.description}
                    onChange={e => updateTier(idx, 'description', e.target.value)}
                    placeholder="What's included (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_default"
              checked={formData.is_default}
              onChange={e => setFormData({...formData, is_default: e.target.checked})}
              className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
            />
            <label htmlFor="is_default" className="text-sm text-gray-700">Set as default rate card</label>
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
              {saving ? 'Saving...' : 'Create Rate Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function generateRateCardText(card) {
  let text = `${card.name}\n`;
  text += `Audience: ${formatNumber(card.audience_size || 0)} followers\n`;
  text += `Engagement: ${card.engagement_rate || 0}%\n\n`;
  text += `Platforms: ${card.platforms?.map(p => {
    const platform = PLATFORMS.find(pl => pl.id === p);
    return platform?.label || p;
  }).join(', ')}\n\n`;
  text += `Services & Pricing:\n`;
  card.pricing_tiers?.forEach(tier => {
    text += `- ${tier.service}: ${formatCurrency(tier.price || 0)}\n`;
    if (tier.description) text += `  ${tier.description}\n`;
  });
  return text;
}

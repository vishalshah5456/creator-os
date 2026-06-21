import { useEffect, useState } from 'react';
import { Mail, Save, Shield, UserRound } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'twitter', label: 'X/Twitter' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'blog', label: 'Blog' },
  { id: 'other', label: 'Other' },
];

export default function Profile() {
  const { user, updateProfile, updateEmail, setPassword, sendPasswordReset, refreshProfile } = useAuth();
  const [profileForm, setProfileForm] = useState({
    name: '',
    handle: '',
    bio: '',
    niche: '',
    followers: '',
    platforms: [],
  });
  const [email, setEmail] = useState('');
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      name: user.name || '',
      handle: user.handle || '',
      bio: user.bio || '',
      niche: user.niche || '',
      followers: user.followers || '',
      platforms: Array.isArray(user.platforms) ? user.platforms : [],
    });
    setEmail(user.email || '');
  }, [user]);

  useEffect(() => {
    refreshProfile().catch(() => {});
  }, []);

  const clearAlerts = () => {
    setError('');
    setMessage('');
  };

  const togglePlatform = (platformId) => {
    setProfileForm(current => ({
      ...current,
      platforms: current.platforms.includes(platformId)
        ? current.platforms.filter(id => id !== platformId)
        : [...current.platforms, platformId],
    }));
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    clearAlerts();
    setSavingProfile(true);

    try {
      await updateProfile({
        ...profileForm,
        followers: Number(profileForm.followers) || 0,
      });
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    clearAlerts();

    if (email.trim().toLowerCase() === user.email?.toLowerCase()) {
      setError('Enter a different email address.');
      return;
    }

    setSavingEmail(true);
    try {
      await updateEmail(email);
      setMessage('Confirmation links were sent. Confirm from both old and new email inboxes if Supabase asks for it.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEmail(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    clearAlerts();

    if (passwordForm.password.length < 12) {
      setError('Use at least 12 characters for your password.');
      return;
    }

    if (passwordForm.password !== passwordForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await setPassword(passwordForm.password);
      setPasswordForm({ password: '', confirmPassword: '' });
      setMessage('Password updated successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleResetEmail = async () => {
    clearAlerts();
    setSavingPassword(true);
    try {
      await sendPasswordReset(user.email);
      setMessage('Password reset email sent.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-500 mt-1">Manage your account details and security settings</p>
      </div>

      {(message || error) && (
        <div className={`rounded-lg border p-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-600' : 'border-green-200 bg-green-50 text-green-700'}`}>
          {error || message}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-full bg-brand-100 flex items-center justify-center">
            <UserRound className="h-6 w-6 text-brand-700" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
            <p className="text-sm text-gray-500">This information is used inside your CreatorCRM workspace.</p>
          </div>
        </div>

        <form onSubmit={handleProfileSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                required
                value={profileForm.name}
                onChange={event => setProfileForm({ ...profileForm, name: event.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Creator Handle</label>
              <input
                required
                value={profileForm.handle}
                onChange={event => setProfileForm({ ...profileForm, handle: event.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Niche</label>
              <input
                value={profileForm.niche}
                onChange={event => setProfileForm({ ...profileForm, niche: event.target.value })}
                placeholder="Fashion, finance, fitness..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Followers</label>
              <input
                type="number"
                min="0"
                value={profileForm.followers}
                onChange={event => setProfileForm({ ...profileForm, followers: event.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
            <textarea
              value={profileForm.bio}
              onChange={event => setProfileForm({ ...profileForm, bio: event.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Short description about you and your creator business"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Platforms</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(platform => (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => togglePlatform(platform.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    profileForm.platforms.includes(platform.id)
                      ? 'bg-brand-50 border-brand-300 text-brand-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {platform.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {savingProfile ? 'Saving...' : 'Save profile'}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <Mail className="w-5 h-5 text-brand-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Email Address</h2>
              <p className="text-sm text-gray-500">Current email: {user.email}</p>
            </div>
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <button
              type="submit"
              disabled={savingEmail}
              className="px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg disabled:opacity-50"
            >
              {savingEmail ? 'Sending...' : 'Update email'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <Shield className="w-5 h-5 text-brand-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Password</h2>
              <p className="text-sm text-gray-500">Set a new password or send yourself a reset link.</p>
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                minLength={12}
                value={passwordForm.password}
                onChange={event => setPasswordForm({ ...passwordForm, password: event.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                minLength={12}
                value={passwordForm.confirmPassword}
                onChange={event => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={savingPassword}
                className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg disabled:opacity-50"
              >
                {savingPassword ? 'Saving...' : 'Change password'}
              </button>
              <button
                type="button"
                onClick={handleResetEmail}
                disabled={savingPassword}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Send reset email
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import type { AuthService } from '../../services/auth.service';
import type { RelayService } from '../../services/relay.service';
import type { AuthState } from '../../types/auth';
import type { ProfileMetadata } from '../../types/nostr';
import { sanitizeText } from '../../utils/sanitize';
import { isValidPubkey, isValidRoleTag } from '../../utils/validation';
import './Profile.css';

interface ProfilePageProps {
  authService: AuthService;
  relayService: RelayService;
  publicKey: string | null;
  onUnauthenticated?: () => void;
  onSuccess?: () => void;
  onRoleSuggestion?: (about: string) => Promise<string | null>;
}

const PersonhoodInfo = () => (
  <section className="personhood-info">
    <p>
      Network‑state members receive a <strong>Personhood Credential (PHC)</strong> from a trusted authority.
      The PHC attests that the holder is a unique, real individual. Because the credential lives
      in your passport, you can present a <em>zero‑knowledge proof</em> that you are verified.
    </p>
    <p>
      In this form we compare the name you enter with the name disclosed by your verified
      passport proof. If the two match, the profile will be saved as your business card credential together with a
      passport tag that references the PHC's unique identifier.
    </p>
  </section>
);

const MAX_NAME_LENGTH = 100;
const MAX_ABOUT_LENGTH = 1000;
const MAX_URL_LENGTH = 2048;

export function ProfilePage({
  authService,
  relayService,
  publicKey,
  onUnauthenticated,
  onSuccess,
  onRoleSuggestion,
}: ProfilePageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [suggestedRole, setSuggestedRole] = useState<string | null>(null);
  const [isGettingRole, setIsGettingRole] = useState(false);
  const [formData, setFormData] = useState<ProfileMetadata>({
    name: '',
    display_name: '',
    about: '',
    picture: '',
    website: '',
  });

  useEffect(() => {
    if (!publicKey) {
      if (onUnauthenticated) {
        onUnauthenticated();
      }
      return;
    }

    loadProfile();
  }, [publicKey]);

  const loadProfile = async () => {
    if (!publicKey) return;

    setIsLoading(true);
    try {
      const [profile, roleTag] = await Promise.all([
        relayService.fetchProfile(publicKey),
        relayService.fetchProfileRoleTag(publicKey),
      ]);
      
      if (profile) {
        setFormData({
          name: sanitizeText(profile.name || ''),
          display_name: sanitizeText(profile.display_name || ''),
          about: sanitizeText(profile.about || ''),
          picture: profile.picture || '',
          website: profile.website || '',
        });
      }
      
      if (roleTag) {
        setSuggestedRole(roleTag);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const tags: string[][] = [];
      if (!isValidPubkey(publicKey)) {
        throw new Error('Invalid public key format');
      }

      // Suggest role based on "about" field if it has content and callback provided
      if (formData.about && formData.about.trim().length > 0 && onRoleSuggestion) {
        setIsGettingRole(true);
        try {
          const roleSuggestion = await onRoleSuggestion(formData.about);
          const candidate = roleSuggestion ? roleSuggestion.trim() : '';
          if (candidate && isValidRoleTag(candidate)) {
            tags.push(['role', candidate]);
            setSuggestedRole(candidate);
          } else {
            setSuggestedRole(null);
          }
        } catch (error) {
          console.error('Failed to get role suggestion:', error);
          setSuggestedRole(null);
        } finally {
          setIsGettingRole(false);
        }
      } else {
        setSuggestedRole(null);
      }

      const profileEvent = {
        kind: 0,
        content: JSON.stringify({
          ...formData,
          name: sanitizeText(formData.name || ''),
          display_name: sanitizeText(formData.display_name || ''),
          about: sanitizeText(formData.about || ''),
        }),
        created_at: Math.floor(Date.now() / 1000),
        tags,
      };

      const follows = {
        kind: 3,
        content: "",
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          (() => {
            const followTag: string[] = ['p', publicKey];
            const relayUrl = relayService.getRelays()[0];
            if (relayUrl) {
              followTag.push(relayUrl);
            }
            if (formData.name) {
              followTag.push(formData.name);
            }
            return followTag;
          })(),
        ],
      };

      const signedProfile = await authService.signEvent(profileEvent);
      const signedFollows = await authService.signEvent(follows);

      await relayService.publishEvent(signedProfile);
      await relayService.publishEvent(signedFollows);

      setSaveMessage('Profile saved successfully!');
      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      setSaveMessage('Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  if (isLoading) {
    return (
      <div className="profile-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-card">
        <h1>Profile Setup</h1>
        <PersonhoodInfo />

        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-group">
            <label htmlFor="name">First Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name || ''}
              onChange={handleChange}
              placeholder="Your username"
              maxLength={MAX_NAME_LENGTH}
            />
          </div>

          <div className="form-group">
            <label htmlFor="display_name">Last Name</label>
            <input
              type="text"
              id="display_name"
              name="display_name"
              value={formData.display_name || ''}
              onChange={handleChange}
              placeholder="Your Last Name"
              maxLength={MAX_NAME_LENGTH}
            />
          </div>

          <div className="form-group">
            <label htmlFor="about">About</label>
            <textarea
              id="about"
              name="about"
              value={formData.about || ''}
              onChange={handleChange}
              placeholder="Tell us about yourself"
              rows={4}
              maxLength={MAX_ABOUT_LENGTH}
            />
          </div>

          <div className="form-group">
            <label htmlFor="picture">Profile Picture URL</label>
            <input
              type="url"
              id="picture"
              name="picture"
              value={formData.picture || ''}
              onChange={handleChange}
              placeholder="https://example.com/avatar.jpg"
              maxLength={MAX_URL_LENGTH}
            />
          </div>

          <div className="form-group">
            <label htmlFor="website">LinkedIn</label>
            <input
              type="url"
              id="website"
              name="website"
              value={formData.website || ''}
              onChange={handleChange}
              placeholder="https://linkedin.com/example"
              maxLength={MAX_URL_LENGTH}
            />
          </div>

          {saveMessage && (
            <div className={`save-message ${saveMessage.includes('Error') ? 'error' : 'success'}`}>
              {saveMessage}
            </div>
          )}

          {(isGettingRole || suggestedRole) && (
            <div className="role-tag-container">
              {isGettingRole ? (
                <>
                  <div className="role-tag-label">Getting AI suggestion...</div>
                  <div className="role-tag-loading">
                    <div className="role-tag-spinner"></div>
                  </div>
                </>
              ) : suggestedRole ? (
                <>
                  <div className="role-tag-label">AI Suggested Role:</div>
                  <div className="role-tag">
                    {sanitizeText(suggestedRole)}
                  </div>
                </>
              ) : null}
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="save-button" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


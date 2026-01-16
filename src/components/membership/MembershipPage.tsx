import { useState, useEffect } from 'react';
import type { AuthService } from '../../services/auth.service';
import type { RelayService } from '../../services/relay.service';
import type { AuthState } from '../../types/auth';
import type { ProfileMetadata, FollowEntry } from '../../types/nostr';
import { sanitizeText } from '../../utils/sanitize';
import { isValidHttpUrl } from '../../utils/validation';
import { BarcodeScanner } from './BarcodeScanner';
import './Membership.css';

interface ProfileWithPubkey extends ProfileMetadata {
  pubkey: string;
}

interface MembershipPageProps {
  authService: AuthService;
  relayService: RelayService;
  publicKey: string | null;
  onUnauthenticated?: () => void;
}

const TrustInfo = () => (
  <section className="trust-info">
    <h2>Building Trust with Verifiable Relationship Credentials</h2>
    <p>
      Beyond the Personhood Credential, members can create <strong>Verifiable Relationship
      Credentials (VRCs)</strong>.  A VRC is issued directly between two members – for example,
      by scanning a QR‑code at a meetup – and certifies a first‑hand trust link.
    </p>
    <p>
      Each VRC becomes a node in a decentralized trust graph.  When you add a member, the
      system records a <strong>role</strong> tag that ties the new
      participant to your existing graph, enabling permissionless access to network‑state
      resources while keeping the underlying data private.
    </p>
    <p>
      The graph grows organically: trusted authorities issue PHCs, and members continuously
      enrich the network with peer‑generated VRCs, creating a resilient, scalable web of
      verified participants.
    </p>
  </section>
);

export function MembershipPage({
  authService,
  relayService,
  publicKey,
  onUnauthenticated,
}: MembershipPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<ProfileWithPubkey[]>([]);
  const [members, setMembers] = useState<FollowEntry[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Map<string, ProfileMetadata>>(new Map());
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!publicKey) {
      if (onUnauthenticated) {
        onUnauthenticated();
      }
      return;
    }

    loadFollowList();
  }, [publicKey]);

  useEffect(() => {
    if (members.length > 0) {
      loadMemberProfiles();
    }
  }, [members]);

  const handleDecoded = (decoded: string) => {
    setSearchQuery(decoded);
    setShowScanner(false);
    handleSearch();
  };

  const loadFollowList = async () => {
    if (!publicKey) return;

    setIsLoading(true);
    try {
      const followList = await relayService.fetchFollowList(publicKey);
      setMembers(followList);
    } catch (error) {
      console.error('Failed to load follow list:', error);
      setSaveMessage('Failed to load membership list');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMemberProfiles = async () => {
    if (members.length === 0) return;

    try {
      const pubkeys = members.map((m) => m.pubkey);
      const profilesMap = await relayService.fetchMultipleProfiles(pubkeys);
      setMemberProfiles(profilesMap);
    } catch (error) {
      console.error('Failed to load member profiles:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setIsLoading(true);
      try {
        const profilesMap = await relayService.queryProfiles([], 50);
        const profilesList: ProfileWithPubkey[] = [];
        profilesMap.forEach((profile, pubkey) => {
          profilesList.push({ ...profile, pubkey });
        });
        setProfiles(profilesList);
      } catch (error) {
        console.error('Failed to query profiles:', error);
        setSaveMessage('Failed to search profiles');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length !== 64 || !/^[0-9a-fA-F]+$/.test(trimmedQuery)) {
      setSaveMessage('Invalid pubkey format. Must be 64 hex characters.');
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }

    setIsLoading(true);
    try {
      const profilesMap = await relayService.queryProfiles([trimmedQuery], 1);
      const profilesList: ProfileWithPubkey[] = [];
      profilesMap.forEach((profile, pubkey) => {
        profilesList.push({ ...profile, pubkey });
      });
      setProfiles(profilesList);
      if (profilesList.length === 0) {
        setSaveMessage('No profile found for this pubkey');
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (error) {
      console.error('Failed to query profile:', error);
      setSaveMessage('Failed to search profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async (pubkey: string) => {
    if (!publicKey) return;

    if (members.some((m) => m.pubkey === pubkey)) {
      setSaveMessage('User is already a member');
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }

    setIsSaving(true);
    try {
      const newMembers: FollowEntry[] = [
        ...members,
        {
          pubkey,
        },
      ];

      await relayService.publishFollowList(publicKey, newMembers, (event) =>
        authService.signEvent(event)
      );

      setMembers(newMembers);
      setSaveMessage('Member added successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to add member:', error);
      setSaveMessage('Failed to add member. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = async (pubkey: string) => {
    if (!publicKey) return;

    setIsSaving(true);
    try {
      const newMembers = members.filter((m) => m.pubkey !== pubkey);

      await relayService.publishFollowList(publicKey, newMembers, (event) =>
        authService.signEvent(event)
      );

      setMembers(newMembers);
      setSaveMessage('Member removed successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to remove member:', error);
      setSaveMessage('Failed to remove member. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getProfileDisplayName = (profile: ProfileMetadata, pubkey: string): string => {
    return profile.display_name || profile.name || pubkey.slice(0, 16) + '...';
  };

  const formatPubkey = (pubkey: string): string => {
    return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
  };

  if (isLoading && members.length === 0) {
    return (
      <div className="membership-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading membership list...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="membership-container">
      <div className="membership-card">
        <h1>Membership Management</h1>
        <TrustInfo />
        <p className="membership-description">
          Query applicants and manage the membership list.
        </p>

        {saveMessage && (
          <div
            className={`save-message ${
              saveMessage.includes('Error') || saveMessage.includes('Failed')
                ? 'error'
                : 'success'
            }`}
          >
            {saveMessage}
          </div>
        )}

        <div className="search-section">
          <h2>Add Member</h2>
          <div className="search-form">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter pubkey or leave empty for recent profiles"
              className="search-input"
              disabled={isLoading}
            />
            <button
              onClick={handleSearch}
              className="search-button"
              disabled={isLoading || isSaving}
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
            <button
              onClick={() => setShowScanner((prev) => !prev)}
              className="scanner-toggle"
              disabled={isLoading || isSaving}
            >
              {showScanner ? 'Close Scanner' : 'Scan QR'}
            </button>
          </div>

          {showScanner && (
            <div style={{ marginTop: '1rem' }}>
              <BarcodeScanner onDecode={handleDecoded} active={true} />
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Point at QR‑code containing a pubkey
              </p>
            </div>
          )}

          {profiles.length > 0 && (
            <div className="profiles-list">
              <h3>Search Results</h3>
              {profiles.map((profile) => {
                const isMember = members.some((m) => m.pubkey === profile.pubkey);
                return (
                  <div key={profile.pubkey} className="profile-item">
                    <div className="profile-info">
                      {profile.picture && isValidHttpUrl(profile.picture) && (
                        <img
                          src={profile.picture}
                          alt={sanitizeText(getProfileDisplayName(profile, profile.pubkey))}
                          className="profile-avatar"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="profile-details">
                        <div className="profile-name">
                          {sanitizeText(getProfileDisplayName(profile, profile.pubkey))}
                        </div>
                        <div className="profile-pubkey">{formatPubkey(profile.pubkey)}</div>
                        {profile.about && (
                          <div className="profile-about">{sanitizeText(profile.about)}</div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        isMember
                          ? handleRemoveMember(profile.pubkey)
                          : handleAddMember(profile.pubkey)
                      }
                      className={`member-button ${isMember ? 'remove' : 'add'}`}
                      disabled={isSaving}
                    >
                      {isMember ? 'Remove' : 'Add Member'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="members-section">
          <h2>Current Members ({members.length})</h2>
          {members.length === 0 ? (
            <p className="empty-message">No members yet. Add members from search results above.</p>
          ) : (
            <div className="members-list">
              {members.map((member) => {
                const profile = memberProfiles.get(member.pubkey);
                return (
                  <div key={member.pubkey} className="member-item">
                    <div className="profile-info">
                      {profile?.picture && isValidHttpUrl(profile.picture) && (
                        <img
                          src={profile.picture}
                          alt={sanitizeText(getProfileDisplayName(profile || {}, member.pubkey))}
                          className="profile-avatar"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="profile-details">
                        <div className="profile-name">
                          {profile
                            ? sanitizeText(getProfileDisplayName(profile, member.pubkey))
                            : formatPubkey(member.pubkey)}
                        </div>
                        <div className="profile-pubkey">{formatPubkey(member.pubkey)}</div>
                        {profile?.about && (
                          <div className="profile-about">{sanitizeText(profile.about)}</div>
                        )}
                        {member.petname && (
                          <div className="profile-petname">Name: {sanitizeText(member.petname)}</div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(member.pubkey)}
                      className="member-button remove"
                      disabled={isSaving}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


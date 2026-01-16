import { useState } from 'react';
import type { AuthService } from '../../services/auth.service';
import type { AuthState } from '../../types/auth';
import './Auth.css';

interface RegistrationFlowProps {
  authService: AuthService;
  setAuthenticated: AuthState['setAuthenticated'];
  onSuccess?: () => void;
}

export function RegistrationFlow({
  authService,
  setAuthenticated,
  onSuccess,
}: RegistrationFlowProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'info' | 'creating' | 'success'>('info');
  const [username, setUsername] = useState('');
  const maxUsernameLength = 100;

  const handleRegister = async () => {
    setIsLoading(true);
    setError(null);
    setStep('creating');

    try {
      authService.clearStoredKeyInfo();

      let credentialId: Uint8Array;
      const passkeyUsername = username.trim() || undefined;
      
      try {
        credentialId = await authService.createPasskey(passkeyUsername);
      } catch (passkeyError) {
        console.error('[RegistrationFlow] Passkey creation failed:', passkeyError);
        throw new Error('Unable to create passkey. Please try again.');
      }

      let keyInfo;
      try {
        keyInfo = await authService.createNostrKey(credentialId);
      } catch (nostrKeyError) {
        console.error('[RegistrationFlow] Failed to create Nostr key from passkey:', nostrKeyError);
        throw new Error('Unable to finalize account. Please try again.');
      }

      authService.setCurrentKeyInfo(keyInfo);
      setAuthenticated(keyInfo);
      setStep('success');

      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (err) {
      console.error('[RegistrationFlow] Registration error:', err);
      setError('Registration failed. Please try again.');
      setStep('info');
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Create Account</h1>
        <p className="auth-description">
          Create a new decentralized Identity. Your identity will be securely derived from a passkey.
        </p>

        {step === 'info' && (
          <>
            <div className="auth-features">
              <div className="feature-item">
                <span className="feature-icon">🔐</span>
                <span>Phishing-resistant authentication</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📱</span>
                <span>Biometric authentication support</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🌐</span>
                <span>Cross-device synchronization</span>
              </div>
            </div>

            <div className="username-section">
              <label htmlFor="username" className="username-label">
                Name (Optional)
              </label>
              <input
                id="username"
                type="text"
                className="username-input"
                placeholder="Enter a name for this passkey"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                maxLength={maxUsernameLength}
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button
              className="auth-button primary"
              onClick={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Account'}
            </button>
          </>
        )}

        {step === 'creating' && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Creating your passkey...</p>
            <p className="loading-hint">Please follow your browser's authentication prompt</p>
            <p className="loading-hint-small">
              💡 Using your system's native passkey manager (Touch ID, Face ID, Windows Hello, etc.)
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="success-state">
            <div className="success-icon">✓</div>
            <p>Account created successfully!</p>
            <p className="success-hint">Redirecting to profile setup...</p>
          </div>
        )}
      </div>
    </div>
  );
}


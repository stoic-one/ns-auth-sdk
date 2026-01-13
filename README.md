# NS Auth SDK

Decentralized SSO - Authentication, membership, and profile management.

NSAuth enables client-side managing of private-keys with WebAuthn passkeys (FIDO2 credentials). By leveraging passkeys, users avoid traditional private‑key backups and password hassles, relying instead on biometric or device‑based authentication. The keys are compatible with common blockchains like Bitcoin and Ethereum and data is stored as events on public relays and can be encrypted.

Two Approaches
PRF Direct Method – Derive the private key directly from the PRF value produced by a passkey. Encryption Method – Encrypt an existing private key with a key derived from the passkey’s PRF output. WebAuthn PRF Extension The PRF (Pseudo‑Random Function) extension, part of WebAuthn Level 3, yields deterministic 32‑byte high‑entropy values from an authenticator’s internal private key and a supplied salt. The same credential ID and salt always generate the same PRF output, which never leaves the device except during authentication.

Using PRF Values as Private Keys
A 32‑byte PRF output can serve as a private key if it falls within the secp256k1 range (1 ≤ value < n). The chance of falling outside this range is astronomically low (~2⁻²²⁴), so explicit range checks are generally unnecessary.

Restoration Steps
Install the client on a new device. Fetch the latest kind 30100 event for the target public key. Extract the PWKBlob and decrypt it with the passkey’s PRF value. Use the recovered private key for signing. Multiple passkeys can each have their own PWKBlob, allowing redundancy across devices.


## Installation

Install from [npm](https://www.npmjs.com/package/ns-auth-sdk):

```bash
npm install ns-auth-sdk
# or
pnpm install ns-auth-sdk
# or
yarn add ns-auth-sdk
```

## Quick Start

### 1. Initialize Services

```typescript
import { AuthService, RelayService } from 'ns-auth-sdk';
import { EventStore } from 'applesauce-core';

// Initialize auth service
const authService = new AuthService({
  rpId: 'your-domain.com',
  rpName: 'Your App Name',
  storageKey: 'nsauth_keyinfo',
});

// Initialize relay service with applesauce EventStore
const relayService = new RelayService({
  relayUrls: ['wss://relay.damus.io'],
});

// Initialize with applesauce EventStore
const eventStore = new EventStore(/* applesauce config */);
relayService.initialize(eventStore);
```

### 2. Set Up Auth Store

```typescript
import { useAuthStore } from 'ns-auth-sdk';

function App() {
  const publicKey = useAuthStore((state) => state.publicKey);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  
  // Initialize auth on mount
  useAuthInit(authService, setAuthenticated);
  
  // ... rest of your app
}
```

### 3. Use Components

#### Registration Flow

```typescript
import { RegistrationFlow } from 'ns-auth-sdk';
import { useRouter } from 'next/navigation'; // or your router

function RegisterPage() {
  const router = useRouter();
  
  return (
    <RegistrationFlow
      authService={authService}
      setAuthenticated={useAuthStore((state) => state.setAuthenticated)}
      onSuccess={() => router.push('/profile')}
    />
  );
}
```

#### Login Button

```typescript
import { LoginButton } from 'ns-auth-sdk';

function LoginPage() {
  return (
    <LoginButton
      authService={authService}
      setAuthenticated={useAuthStore((state) => state.setAuthenticated)}
      setLoginError={useAuthStore((state) => state.setLoginError)}
      onSuccess={() => router.push('/dashboard')}
    />
  );
}
```

#### Profile Page

```typescript
import { ProfilePage } from 'ns-auth-sdk';

function ProfilePageComponent() {
  const publicKey = useAuthStore((state) => state.publicKey);
  
  return (
    <ProfilePage
      authService={authService}
      relayService={relayService}
      publicKey={publicKey}
      onUnauthenticated={() => router.push('/login')}
      onSuccess={() => router.push('/membership')}
      onRoleSuggestion={async (about) => {
        // Optional: Provide role suggestion callback
        const response = await fetch('/api/suggest-role', {
          method: 'POST',
          body: JSON.stringify({ about }),
        });
        const data = await response.json();
        return data.role || null;
      }}
    />
  );
}
```

#### Membership Management

```typescript
import { MembershipPage } from 'ns-auth-sdk';

function MembershipPageComponent() {
  const publicKey = useAuthStore((state) => state.publicKey);
  
  return (
    <MembershipPage
      authService={authService}
      relayService={relayService}
      publicKey={publicKey}
      onUnauthenticated={() => router.push('/login')}
    />
  );
}
```

## API Reference

### AuthService

Wrapper around `nosskey-sdk` for WebAuthn/Passkey integration.

#### Methods

- `createPasskey(username?: string): Promise<Uint8Array>` - Create a new passkey
- `createNostrKey(credentialId?: Uint8Array): Promise<NostrKeyInfo>` - Create Nostr key from passkey
- `getPublicKey(): Promise<string>` - Get current public key
- `signEvent(event: NostrEvent): Promise<NostrEvent>` - Sign a Nostr event
- `getCurrentKeyInfo(): NostrKeyInfo | null` - Get current key info
- `setCurrentKeyInfo(keyInfo: NostrKeyInfo): void` - Set current key info
- `hasKeyInfo(): boolean` - Check if key info exists
- `clearStoredKeyInfo(): void` - Clear stored key info
- `isPrfSupported(): Promise<boolean>` - Check if PRF is supported

### RelayService

Service for communicating with Nostr relays using applesauce-core.

#### Methods

- `initialize(eventStore: EventStore): void` - Initialize with applesauce EventStore
- `setRelays(urls: string[]): void` - Set relay URLs
- `publishEvent(event: NostrEvent, timeoutMs?: number): Promise<boolean>` - Publish event
- `fetchProfile(pubkey: string): Promise<ProfileMetadata | null>` - Fetch profile
- `fetchProfileRoleTag(pubkey: string): Promise<string | null>` - Fetch role tag
- `fetchFollowList(pubkey: string): Promise<FollowEntry[]>` - Fetch follow list
- `fetchMultipleProfiles(pubkeys: string[]): Promise<Map<string, ProfileMetadata>>` - Fetch multiple profiles
- `queryProfiles(pubkeys?: string[], limit?: number): Promise<Map<string, ProfileMetadata>>` - Query profiles
- `publishFollowList(pubkey: string, followList: FollowEntry[], signEvent: (event: NostrEvent) => Promise<NostrEvent>): Promise<boolean>` - Publish follow list

### Components

All components are framework-agnostic React components that accept callback props for navigation.

#### Common Props

- `authService: AuthService` - Auth service instance
- `relayService?: RelayService` - Relay service instance (required for profile/membership)
- `publicKey?: string | null` - Current user's public key
- `onSuccess?: () => void` - Success callback
- `onUnauthenticated?: () => void` - Unauthenticated callback

## Integration with Applesauce

This library is designed to work seamlessly with applesauce-core. The `RelayService` uses applesauce's `EventStore` for all relay operations.

```typescript
import { EventStore } from 'applesauce-core';
import { RelayService } from 'ns-auth-sdk';

const eventStore = new EventStore({
  // applesauce configuration
});

const relayService = new RelayService();
relayService.initialize(eventStore);
```


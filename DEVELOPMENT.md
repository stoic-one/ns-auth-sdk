# Development Guide

This project uses [Conventional Commits](https://www.conventionalcommits.org/) with semantic-release for automatic versioning and releases.

## Commit Format

```
<type>(<scope>): <subject>
```

## Commit Types

### Release Types

- **`feat`** - New feature (minor version bump)
- **`fix`** - Bug fix (patch version bump)
- **`perf`** - Performance improvement (patch version bump)
- **`chore`** - Maintenance/updates (patch version bump)
- **`refactor`** - Code refactoring (patch version bump)

### Non-Release Types

- **`docs`** - Documentation changes
- **`style`** - Code style/formatting
- **`test`** - Test changes
- **`build`** - Build system changes
- **`ci`** - CI configuration changes

## Examples

```bash
git commit -m "feat(auth): add login button"
git commit -m "fix(profile): resolve image upload issue"
git commit -m "chore: update dependencies"
git commit -m "docs: update README"
```

## Breaking Changes

To trigger a **major version bump**, indicate a breaking change using either method:

**Method 1:** Add `!` after the type/scope:
```bash
git commit -m "feat!(api): change authentication method"
git commit -m "feat!: send email when product ships"
```

**Method 2:** Include `BREAKING CHANGE:` in the commit body:
```bash
git commit -m "feat(api): change authentication method

BREAKING CHANGE: The login endpoint now requires OAuth2 instead of basic auth"
```

**Note:** `BREAKING-CHANGE` (with hyphen) is also valid and synonymous with `BREAKING CHANGE`.

## Release Process

1. Commit using conventional commit format
2. Push to `main` branch
3. semantic-release automatically creates releases and updates the changelog

## Resources

- [Conventional Commits](https://www.conventionalcommits.org/)

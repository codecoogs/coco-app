# Release Versioning Strategy for Coco

This document outlines how the Coco project manages versions and releases.

## Versioning Scheme: Semantic Versioning (SemVer)

We follow [Semantic Versioning 2.0.0](https://semver.org/), which uses three version numbers: **MAJOR.MINOR.PATCH**

### Version Format: `X.Y.Z`

- **MAJOR** (X) – Increment when making incompatible API changes or major feature releases
- **MINOR** (Y) – Increment when adding new features in a backward-compatible manner
- **PATCH** (Z) – Increment when fixing bugs in a backward-compatible manner

Examples:
- `0.1.0` – First release with initial features
- `0.2.0` – New feature added (e.g., Stripe payments)
- `0.2.1` – Bug fix in existing feature
- `1.0.0` – First stable/production release

### Pre-release Versions

For testing releases, use:
- `1.0.0-alpha` – Very early, may be unstable
- `1.0.0-beta` – Feature-complete, undergoing testing
- `1.0.0-rc.1` – Release candidate, nearly ready

Example: `0.3.0-beta.1`

## Release Types

### Patch Release (0.1.X)
**When:** Bug fixes, minor improvements, security updates
**Frequency:** As needed
**Examples:**
- Fix authentication bug
- Improve error message clarity
- Performance optimization
- Security vulnerability patch

```bash
# Bump from 0.1.0 to 0.1.1
npm version patch
```

### Minor Release (0.X.0)
**When:** New features, backward-compatible enhancements
**Frequency:** Every 2-4 weeks
**Examples:**
- Add new dashboard page
- Add bulk import feature
- New officer tools
- API improvements

```bash
# Bump from 0.1.0 to 0.2.0
npm version minor
```

### Major Release (X.0.0)
**When:** Breaking changes, significant rewrites, API changes
**Frequency:** Rare (plan carefully)
**Examples:**
- Migrate authentication system
- Redesign dashboard layout significantly
- Change database structure
- Deprecate core features

```bash
# Bump from 0.2.0 to 1.0.0
npm version major
```

## Release Process

### 1. Preparation (Days before release)

- Create a release branch: `git checkout -b release/0.3.0`
- Update version in `package.json`:
  ```bash
  npm version minor --no-git-tag-version
  ```
- Update `CHANGELOG.md` with features, fixes, and breaking changes
- Review all changes since last release
- Test thoroughly on staging environment

### 2. Create a Release PR

- Push release branch to GitHub
- Create a PR against `main` with title: `release: v0.3.0`
- Include changelog in PR description
- Request review from team leads
- Get at least 2 approvals

### 3. Merge & Tag

```bash
# After PR approval, merge to main
git checkout main
git pull origin main
git merge release/0.3.0

# Create a Git tag
git tag -a v0.3.0 -m "Release version 0.3.0"

# Push to GitHub
git push origin main
git push origin v0.3.0
```

### 4. Create GitHub Release

- Go to [Releases](https://github.com/codecoogs/coco-app/releases)
- Click "Draft a new release"
- Select the tag `v0.3.0`
- Title: `v0.3.0 - Feature Title`
- Description: Copy from CHANGELOG.md
- Attach any release notes or documentation
- Publish the release

### 5. Deploy

- Verify Vercel deployment succeeded
- Test on production environment
- Monitor for errors in logs

### 6. Communicate

- Post in team channels
- Notify users of major changes
- Include upgrade instructions if needed

## Changelog Format

Maintain a `CHANGELOG.md` file using [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-08-15

### Added
- New bulk import feature for opportunities
- Academic periods management panel
- Team deactivation functionality

### Changed
- Improved point display in sidebar
- Updated member dashboard layout
- Refactored authentication flow

### Fixed
- Fix for member lockdown access issues
- Bug in opportunity pagination
- Navigation highlighting on refresh

### Deprecated
- Old point import format (use CSV instead)

### Removed
- Legacy theme switcher (replaced with new system)

### Security
- Fixed potential XSS vulnerability in event descriptions

## [0.2.1] - 2026-08-10

### Fixed
- Stripe webhook signature verification bug

## [0.2.0] - 2026-07-20

### Added
- Stripe payment integration for memberships
- Financial dashboard with transaction history
```

## Version Bumping in `package.json`

The `package.json` includes the current version. Keep it in sync with releases:

```json
{
  "name": "coco-app",
  "version": "0.3.0"
}
```

Update this during the release process using:

```bash
npm version patch      # 0.2.1 -> 0.2.2
npm version minor      # 0.2.1 -> 0.3.0
npm version major      # 0.2.1 -> 1.0.0
```

These commands:
1. Update `package.json`
2. Create a git commit
3. Create a git tag

## Deployment Strategy

### Automatic Deployment
- All merges to `main` auto-deploy to production via Vercel
- Releases are tagged for easy rollback

### Manual Deployment
```bash
# Deploy a specific version
vercel --prod
```

### Rollback
```bash
# Deploy previous version
git checkout v0.2.0
vercel --prod

# Or redeploy main
git checkout main
vercel --prod
```

## Compatibility Commitments

### During 0.x Phase
- MINOR version bumps may include breaking changes
- Users should review CHANGELOG before updating
- We'll strive to minimize breaking changes

### After 1.0.0 Release
- MAJOR versions will be used for breaking changes
- MINOR versions guarantee backward compatibility
- PATCH versions are always safe updates

## Documentation for Releases

For each release, document:
- **New Features** – What users can now do
- **Improvements** – What's better
- **Fixes** – What bugs were fixed
- **Breaking Changes** – What users need to update
- **Migration Guide** – Step-by-step update instructions (if needed)

Example migration guide:

```markdown
## Upgrading from 0.2.x to 0.3.0

### Breaking Changes
- The old point import format is no longer supported

### Migration Steps
1. Update your code: `npm update coco-app`
2. Export existing points using the new CSV export tool
3. Re-import points using the new bulk import feature

### Rollback
If you need to downgrade: `npm install coco-app@0.2.0`
```

## Beta & Testing Releases

For testing new features before official release:

```bash
# Create a pre-release branch
git checkout -b rc/0.3.0-beta

# Update version
npm version prerelease --no-git-tag-version

# Publish beta version
npm publish --tag beta

# Install beta version for testing
npm install coco-app@0.3.0-beta
```

## Long-term Support (LTS) Versions

Currently, only the latest version is supported. Once we reach 1.0.0, consider:
- Marking stable releases as LTS
- Providing bug fixes for 12+ months
- Supporting security patches longer
- Documenting end-of-life dates

Example:
- `1.0.0` – LTS until 2027-08
- `1.1.0` – Latest release
- Users on 1.0.0 can safely stay current for security/bugs

## Automation (Future)

Consider automating with tools like:
- **semantic-release** – Automatic version bumping based on commits
- **Conventional Commits** – Standardized commit messages
- **GitHub Actions** – Auto-generate changelogs, create releases
- **Renovate** – Dependency update management

## Frequently Asked Questions

### Q: How often should we release?
**A:** Aim for a release every 2-4 weeks for stability. Hotfixes can release anytime.

### Q: What if we need to release without all planned features?
**A:** Release what's ready. Features not finished can wait for the next release.

### Q: How do we handle urgent security fixes?
**A:** Create a hotfix branch, patch version bump, release immediately, then merge back to main.

### Q: Should we support older versions?
**A:** For now, only support the current version. Consider LTS after reaching 1.0.0.

### Q: How do we test releases?
**A:** Use the staging environment with pre-release versions, have the team test, then go live.

---

**Current Version:** Check `package.json` for the actual version.
**Last Updated:** August 2026

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New documentation: Contributing guidelines, Release strategy, and GitHub templates
- GitHub issue templates for bug reports and feature requests
- GitHub pull request template with checklist
- Comprehensive CHANGELOG tracking

### Changed
- Updated README with accurate project overview and feature list
- Improved project structure documentation

## [0.1.0] - 2026-08-07

### Added

#### Authentication & Core
- Supabase-based authentication system
- Individual member sign-up and login flows
- Team-based login flow
- Session management with Supabase auth helpers
- Forgot password and password reset functionality

#### Dashboard & Navigation
- Main dashboard with sidebar navigation
- Role-based access control (member, officer, admin)
- Member-only and officer-only page access controls
- Responsive navigation for mobile and desktop
- Theme switching (light/dark mode)

#### Member Features
- Points tracking and leaderboard
- Personal point history and activity log
- Member profile and settings
- Team membership management
- Event browsing and signup
- Opportunity discovery and applications

#### Events Management
- Officer dashboard for event creation and management
- Event listing with filtering
- Member signup tracking
- Event scheduling system

#### Opportunities
- Opportunities listing for members
- Officer admin panel for opportunity management
- Bulk import feature for opportunities via CSV/file upload
- Opportunity detail pages
- Drag-and-drop file upload with visual feedback

#### Financial System
- Stripe integration for membership purchases
- Membership purchase flow via Stripe Checkout
- Financial dashboard with transaction history
- Membership plan management
- Stripe webhook handling for payment events

#### Point Management
- Officer tools for point assignment
- Point history tracking per member
- Academic year scoping for points
- Bulk point operations
- Point analytics

#### Team Management
- Team creation and management
- Team member assignment
- Team deactivation functionality
- Team-level permissions and roles
- Team-based point tracking

#### Admin Tools
- Academic period management (semesters)
- User permission management
- Member lockdown controls
- Officer permission assignment
- System configuration

#### Technical
- Next.js 16 with React 19 (App Router)
- TypeScript for type safety
- Tailwind CSS 4 with custom theming
- shadcn/ui component library
- Base UI components
- dnd-kit for drag-and-drop functionality
- ESLint for code quality
- GitHub Actions CI pipeline (lint, typecheck, build)
- Vercel deployment with auto-deploy on push to main

### Fixed
- Fixed theme icon hydration mismatch for dark-family themes
- Fixed sidebar navigation highlighting on page refresh
- Fixed getSiteUrl() with Vercel URL fallback

### Known Issues
- None documented at this time

---

## Versioning

This project follows [Semantic Versioning](https://semver.org/). For detailed information about releases and versioning strategy, see [RELEASES.md](./RELEASES.md).

## Contributing

See [CONTRIBUTING.md](./.github/CONTRIBUTING.md) for guidelines on contributing to this project.

---

For a complete history of changes, view the [git commit log](https://github.com/codecoogs/coco-app/commits).

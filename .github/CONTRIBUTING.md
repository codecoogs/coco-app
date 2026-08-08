# Contributing to Coco

Thank you for your interest in contributing to the CodeCoogs member platform! This guide will help you get started.

## Getting Started

### 1. Clone and Set Up

```bash
git clone <repo-url>
cd coco-app
npm install
```

### 2. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or for bug fixes
git checkout -b fix/your-fix-name
```

Branch naming convention:
- `feature/` for new features
- `fix/` for bug fixes
- `refactor/` for code refactoring
- `docs/` for documentation updates

### 3. Set Up Environment

Copy `.env` to `.env.local` and add your configuration:

```bash
cp .env .env.local
# Then edit .env.local with your local values
```

### 4. Start Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to test your changes.

## Development Workflow

### Code Standards

- **TypeScript**: All components should be properly typed. Run `npm run typecheck` to verify.
- **Formatting**: Use ESLint to check code quality. Run `npm run lint`.
- **React/Next.js**: Follow Next.js best practices using the App Router.
  - Use server components by default
  - Mark interactive components with `"use client"`
  - Keep client-side logic minimal
- **Styling**: Use Tailwind CSS for all styling. Keep component styles scoped and reusable.
- **Components**: Use shadcn/ui and Base UI components where available.

### Code Style Guide

- Use meaningful variable and function names
- Avoid console.logs in production code
- Keep functions focused and single-responsibility
- Write TypeScript interfaces for all props
- No commented-out code – delete it or use git history to find it

### Database Changes

If your feature requires database changes:

1. Create migrations in the `supabase/migrations/` directory
2. Test migrations locally with Supabase CLI
3. Update the schema documentation if applicable
4. Include migration files in your PR

### Testing

- Test your changes thoroughly before submitting a PR
- Test across different screen sizes (responsive design)
- Test with different user roles (member, officer, admin)
- Verify that related features still work

### Committing

Write clear, descriptive commit messages:

```
feature: add opportunity import functionality

- Allow officers to bulk import opportunities via CSV
- Add validation and error handling
- Implement retry logic for failed imports

Fixes #123
```

Format:
- `<type>: <short description>` (max 72 chars)
- Leave a blank line
- Provide a more detailed description (wrapped at 72 chars)
- Reference related issues/PRs using `Fixes #123`

## Submitting Changes

### Before Creating a PR

1. **Run all checks:**
   ```bash
   npm run lint
   npm run typecheck
   npm run build
   ```

2. **Pull latest main:**
   ```bash
   git fetch origin
   git rebase origin/main
   ```

3. **Verify your feature works** in the running dev server

### Create a Pull Request

When creating a PR, include:

- **Clear title** – "Add opportunity bulk import for officers" (not "Updates")
- **Description** – Explain what was changed and why
  - What problem does this solve?
  - How should reviewers test it?
  - Any breaking changes?
  - Any edge cases or limitations?
- **Linked issues** – Use `Fixes #123` to close related issues
- **Screenshots/videos** – For UI changes, show before/after

Example PR template:

```markdown
## What's being changed?
Added bulk import functionality for opportunities on the officer dashboard.

## Why?
Officers need a faster way to add multiple opportunities at once, especially during busy seasons.

## How to test?
1. Go to Dashboard > Opportunities (as an officer)
2. Click "Import from CSV"
3. Upload the provided test CSV file
4. Verify opportunities are created with correct data

## Related Issues
Fixes #45
```

### Code Review Process

- At least one approval required before merging
- Address all feedback before merge
- Push updates to the same branch – don't force push
- Resolve conversations after addressing feedback

## Common Tasks

### Adding a New Page/Feature

1. Create the route in `app/dashboard/your-feature/page.tsx`
2. Create a components folder if needed: `app/dashboard/your-feature/components/`
3. Add navigation link in the sidebar/nav component
4. Add any necessary database functions or API routes
5. Test both logged-in and permission scenarios

### Modifying Existing Features

1. Check git history for context: `git log -p app/path/to/file`
2. Look for related tests or examples in the codebase
3. Test all entry points to the feature
4. Verify no regressions in related features

### Fixing a Bug

1. Create a test case that reproduces the bug
2. Verify the test fails
3. Implement the fix
4. Verify the test passes
5. Check for similar patterns in the codebase

### Performance Optimization

- Use Next.js Image optimization for images
- Leverage Next.js data fetching patterns (server components, ISR)
- Profile before optimizing – check React DevTools Profiler
- Document performance improvements in the PR

## Project Structure Reference

```
app/
├── api/                    # Next.js route handlers
│   ├── codecoogs/         # CodeCoogs API proxy routes
│   ├── officers/          # Officer-only actions
│   └── stripe/            # Stripe webhook handlers
├── auth/                  # Authentication flows
├── components/            # Shared components
│   ├── auth/             # Auth-related components
│   └── ui/               # UI building blocks
├── contexts/             # React context providers
├── dashboard/            # Main application features
│   ├── events/
│   ├── finances/
│   ├── opportunities/
│   ├── point-management/
│   ├── team-management/
│   └── ...
└── page.tsx             # Landing page
```

## Useful Commands

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm start               # Run production build
npm run lint            # Run ESLint
npm run typecheck       # Run TypeScript type checking
```

## Getting Help

- **Questions about the codebase?** Look at recent PRs and commits for context
- **Issues with setup?** Check the README and .env.local configuration
- **Need help with a feature?** Open a discussion or reach out to the team
- **Found a bug?** Create an issue with reproduction steps

## Code of Conduct

- Be respectful and constructive in code reviews
- Assume good intent from other contributors
- Focus on the code, not the person
- Help newer contributors learn and grow

## Release Process

This project follows semantic versioning. See [RELEASES.md](../RELEASES.md) for more details on how versions are managed and released.

---

Thanks for contributing to Coco! Your work helps make CodeCoogs better for everyone. 🎉

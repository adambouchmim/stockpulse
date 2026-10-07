# Changelog

All notable changes to the **StockPulse** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.0-beta] - 2026-10-07

### 🚀 Features & Enhancements
- **In-App User Feedback System**: Added a dedicated feedback hub (`/feedback`) with category selection (Feature Request, Bug Report, News/Content, General, Other), star rating, and diagnostics toggle.
- **Direct Email & Multi-Layer Delivery**: Feedback is dispatched directly to `pulsedigeststock@gmail.com` with automatic Supabase database storage and direct email app fallbacks.
- **Floating Feedback Action Button**: Non-intrusive floating feedback trigger accessible across all protected views.
- **Cross-Device Tutorial Sync**: Persisted tutorial completion flag directly in user account metadata (`tutorial_completed: true`) preventing repeated tours across different browsers/devices.

---

## [0.2.0-beta] - 2026-09-20

### 🚀 Features & Enhancements
- **Interactive User Onboarding Tutorial**: Integrated a guided step-by-step tour for new users highlighting Ticker Search, Digest Refresh, Categorized Sections, and Preferences/Alerts.
- **Mobile-Adaptive Tour**: Seamlessly opens and collapses drawer sidebars on mobile screens during tour steps.
- **Replay Tutorial**: Added manual tour launch trigger in Settings for users to revisit the walkthrough at any time.

---

## [0.1.0-beta] - 2026-09-18

### 🚀 Features & Enhancements
- **GitHub Free Hosting**: Configured GitHub Pages integration with automated CI/CD pipeline via GitHub Actions.
- **Client-Side Routing**: Added SPA fallback routing (`404.html`) and base path resolution for seamless navigation on GitHub Pages.
- **Authentication**: Integrated Supabase Auth for user registration, login, and session persistence with automatic redirect handling.
- **Stock News & Market Digest**: Core portfolio and watchlist digest feed with sentiment and ticker filtering.

### 🛡️ Security & Configuration
- Added `.gitignore` to protect environment secrets, local build artifacts, and dependency trees.
- Isolated Supabase configuration and public client bindings.

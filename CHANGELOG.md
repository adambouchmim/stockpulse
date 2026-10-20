# Changelog

All notable changes to the **tailorfeed** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.5.0-beta] - 2026-10-20

### 🚀 Brand Transition: tailorfeed
- **Product Rebranding**: Officially rebranded application to **tailorfeed** (*"Your financial news feed. Tailor made."*).
- **Brand Assets**: Added official high-res logo (`logo.png`), favicons (`favicon.ico`, `favicon.png`), and Apple touch icon (`apple-touch-icon.png`).
- **BrandLogo Component**: Created shared responsive `<BrandLogo />` component supporting light/dark adaptive invert, stacked auth hero layouts, and inline navigation headers.
- **Dynamic Base Routing**: Enhanced Vite configuration to dynamically detect GitHub repository name or default to `/tailorfeed/`.
- **Telegram Bot Rebrand**: Updated bot instructions and links to `@Tailorfeed_bot`.
- **Tutorial & Storage Migration**: Preserved backward compatibility for tutorial completion flags across legacy `stockpulse` keys and new `tailorfeed` keys.

---

## [0.4.1-beta] - 2026-10-20

### 🚀 Features & Enhancements
- **Subtitle Marquee Scrolling**: Extended `MarqueeText` scrolling to sector and industry labels in both watchlist cards and live search suggestions.
- **Marquee Container Layout**: Added `containerClassName` support to `MarqueeText` for seamless flexbox truncation and alignment.

---

## [0.4.0-beta] - 2026-10-20

### 🚀 Features & Enhancements
- **Typography Overhaul**: Standardized the entire application on Google Font **Montserrat** (weights 100–900) across display, body, mono, and feedback templates.
- **Pure OLED / AMOLED Dark Mode**: Re-engineered dark mode color tokens from slate/navy to true black (`#000000`), deep charcoal cards, high-contrast borders, and adaptive browser `theme-color` meta tags.
- **Interactive Ping-Pong Marquee**: Added `MarqueeText` component to smoothly scroll truncated long company names in the watchlist with gradient edge masking and reduced-motion support.
- **Enhanced Watchlist UX & Responsive Sidebar**: Added real-time ticker count badges, expanded search result metadata (sectors, country flags), and responsive desktop sidebar scaling (from 320px up to 460px on wide screens).
- **Driver.js Onboarding Tour Theming**: Styled tutorial popovers, indicators, and buttons to seamlessly inherit AMOLED theme tokens.

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

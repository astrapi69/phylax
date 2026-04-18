# Phylax D-Series: Deployment Master Plan

**Document purpose**: Strategic overview of all deployment paths for Phylax v1.0.0+. Not a task list - a reference document to inform decisions about where and when to distribute the app.

**Scope**: Phylax is a Progressive Web App (PWA) built with React 18 + Vite + TypeScript. Fully client-side, no backend, no database. Local-first architecture with IndexedDB storage and AES-256-GCM encryption.

**Current state**: v1.0.0 tagged and released on GitHub. Not yet deployed anywhere. Users can only clone and build locally.

---

## Deployment paths overview

| Target            | Cost     | Reach          | Complexity | Review time | Status          |
| ----------------- | -------- | -------------- | ---------- | ----------- | --------------- |
| GitHub Pages      | Free     | Any browser    | Low        | None        | D-01            |
| Custom Domain     | ~15€/yr  | Any browser    | Low        | None        | Optional        |
| Microsoft Store   | 20€ once | Windows 10/11  | Medium     | 1-7 days    | Future          |
| Google Play Store | 25€ once | Android        | Medium     | 1-3 days    | Future          |
| F-Droid           | Free     | Android (FOSS) | Medium     | 2-8 weeks   | Future          |
| Apple App Store   | 99€/yr   | iOS            | High       | Weeks       | Not recommended |
| Amazon Appstore   | Free     | Fire tablets   | Low        | Days        | Low priority    |
| Meta Quest Store  | Free     | VR headsets    | Low        | Days        | Irrelevant      |

---

## D-01: GitHub Pages (first deployment)

**Purpose**: Make Phylax publicly accessible via URL. Foundation for all other distribution paths (PWABuilder requires a live URL).

**What it produces**:

- Phylax accessible at `https://astrapi69.github.io/phylax/`
- HTTPS automatic (Let's Encrypt via GitHub)
- Service Worker functional
- PWA installable from browser ("Add to Home Screen")
- Zero hosting cost, unlimited bandwidth for public repos

**Technical requirements**:

- Vite `base: '/phylax/'` configuration
- GitHub Actions workflow for build + deploy
- Service Worker scope adjustments
- Manifest path corrections

**Success criteria**:

- URL loads without errors
- PWA install prompt appears in Chrome/Edge
- Offline mode works after first visit
- All existing features work on deployed version

**Estimated effort**: 45-60 minutes

---

## D-02: Custom Domain (optional)

**Purpose**: Professional URL like `phylax.dev` or `phylax.app` instead of GitHub subdomain.

**What it produces**:

- Phylax at `https://phylax.dev` (or chosen domain)
- HTTPS via GitHub's automatic Let's Encrypt
- `base: '/'` in Vite (cleaner paths)
- Better branding and memorability

**Technical requirements**:

- Domain purchase (~10-15€/year for .dev, .app, .io)
- DNS configuration (A records or CNAME)
- GitHub Pages custom domain setup
- HTTPS verification wait (minutes to hours)

**When to do it**:

- After D-01 confirms deployment works
- When you're ready to invest in domain
- When you want to share URL beyond GitHub audience

**Estimated effort**: 30 minutes + domain purchase

---

## D-03: Microsoft Store

**Purpose**: Windows users discover Phylax through native Store, install like any Windows app.

**What it produces**:

- Phylax listed in Microsoft Store
- Windows 10/11 users can install via Store UI
- Automatic updates through Store mechanism
- Runs as native-feeling Windows app via Edge WebView2

**Technical requirements**:

- PWABuilder.com (free Microsoft tool)
- Microsoft Partner Center account
  - Individual: ~20€ one-time fee
  - Company: ~80€ one-time fee
- Live PWA URL (requires D-01 first)
- Store listing assets: screenshots (1366x768, 1920x1080), logo, description
- Privacy policy URL (can be DONATE.md or SECURITY.md initially)

**Review process**:

- Usually 1-7 days
- Microsoft is PWA-friendly (they own Edge)
- Rejection rare for legitimate PWAs

**Store listing needs**:

- Short description (max 200 chars)
- Long description (max 10,000 chars)
- At least 3 screenshots
- 300x300 square logo
- 2480x1200 hero image (optional but recommended)
- Age rating classification (IARC questionnaire)
- Privacy policy URL
- Support contact

**Advantages**:

- Lowest-cost paid store
- Fastest review cycle
- High trust signal for users
- Automatic updates without GitHub Pages reliance

**Disadvantages**:

- Windows-only user base
- One-time fee barrier

**Estimated effort**: 3-5 hours (listing prep + PWABuilder + submission)

---

## D-04: F-Droid (Android FOSS)

**Purpose**: Distribute Phylax to Android users via the FOSS-focused alternative to Google Play. Strong philosophical fit with Phylax's privacy-first, open-source positioning.

**What it produces**:

- Phylax listed in F-Droid repository
- Android users with F-Droid installed can discover and install
- Reviewers verify the app is genuinely FOSS (no telemetry, no proprietary dependencies)
- Community-driven quality control

**Technical requirements**:

- F-Droid metadata file in repository
- Build reproducibility (F-Droid builds from source)
- No proprietary dependencies
- TWA (Trusted Web Activity) wrapper via Bubblewrap
- Complete source availability (✓ Phylax is MIT)

**Review process**:

- Community review: 2-8 weeks
- Focuses on: licensing compliance, anti-features (tracking, ads), security
- Phylax fits perfectly: MIT license, no telemetry, no ads, privacy-first

**Advantages**:

- Free
- Exact fit with Phylax's philosophy
- Audience explicitly cares about privacy/FOSS values
- Signal quality: F-Droid listing = "this is truly open and respectful"

**Disadvantages**:

- Long review time
- Smaller user base than Google Play
- F-Droid requires manual Android install (less mainstream)

**Estimated effort**: 2-4 hours setup + waiting period

---

## D-05: Google Play Store

**Purpose**: Broadest Android reach. Most Android users install from Google Play by default.

**What it produces**:

- Phylax listed on Play Store
- Android users install via normal Play Store flow
- Automatic updates
- Runs via TWA (Trusted Web Activity) - indistinguishable from native app for most users

**Technical requirements**:

- Google Play Developer account: 25€ one-time
- PWABuilder or Bubblewrap tool
- TWA manifest configuration
- Digital Asset Links verification (connects Play app to your domain)
- Live PWA URL (requires D-01 or D-02)
- Store listing assets

**Review process**:

- 1-3 days for new listings (was longer pre-2024)
- Google scrutinizes new developer accounts more
- Health apps may face additional medical-disclaimer checks
- Phylax is NOT a medical device - must be explicit in listing to avoid category confusion

**Store listing needs**:

- Short description (max 80 chars)
- Full description (max 4000 chars)
- At least 2 screenshots per device type (phone, 7-inch tablet, 10-inch tablet)
- Feature graphic 1024x500
- High-res icon 512x512
- Privacy policy URL (REQUIRED for Play Store)
- Data safety form (disclose what data you collect - Phylax answer: "none")

**Advantages**:

- Massive user base
- Trusted by Android users
- Automatic updates
- Good for discoverability

**Disadvantages**:

- Google Play policies are strict and change often
- Review can flag health-related apps
- TWA requires verified domain ownership (Digital Asset Links)

**Estimated effort**: 4-6 hours (listing + Digital Asset Links + submission)

---

## D-06: Apple App Store (NOT recommended for v1.0)

**Purpose**: iOS users could install Phylax like any iOS app.

**Why not recommended**:

- 99€/year developer account (vs 20-25€ one-time for competitors)
- Apple explicitly discourages PWA wrappers in app stores
- Requires Capacitor/WKWebView hybrid wrapper (more complex than TWA)
- Review process is strict, can take weeks
- Rejection risk: "just a website" is a common rejection reason
- IAP rules could force using Apple payment for any donations (30% cut)

**When to revisit**:

- After significant user demand from iOS users
- When budget can absorb 99€/year
- When native iOS features are worth the complexity
- iOS users can still use Phylax via Safari "Add to Home Screen"

---

## D-07: Amazon Appstore (low priority)

**Purpose**: Reach Fire tablet users and Amazon app ecosystem.

**Technical path**:

- Free developer account
- PWABuilder generates Amazon package
- Review: typically days

**Why low priority**:

- Small user base compared to Play Store
- Fire tablet users are a niche
- Phylax would reach them via F-Droid if they sideload

**Estimated effort**: 2-3 hours if pursued

---

## Recommended rollout sequence

### Phase 1: Foundation (after v1.0.0 release)

**D-01: GitHub Pages** → live URL exists → basic deployment path proven

### Phase 2: First store (after early user feedback)

**D-03: Microsoft Store** → first paid-store experience, cheapest commitment, fastest review

### Phase 3: FOSS community (parallel with Phase 2)

**D-04: F-Droid** → philosophical fit, free, signals quality to privacy-aware users

### Phase 4: Mainstream Android (after Microsoft Store experience)

**D-05: Google Play Store** → broadest reach, benefits from screenshots/descriptions refined during Microsoft Store submission

### Phase 5: Custom domain (when branding needs it)

**D-02: Custom Domain** → professional URL when audience expands beyond developers

### Phase 6 (optional): iOS and niche stores

**D-06, D-07**: Only if demand justifies

---

## Prerequisites shared across all store paths

Before ANY store submission, have ready:

**Marketing copy**:

- Short pitch (1 sentence): "Phylax is a privacy-first health profile PWA - your data encrypted on your device, no cloud, no tracking."
- Medium pitch (2-3 paragraphs): introducing concept, features, who it's for
- Full description: features list with benefits, use cases, philosophy
- Keywords list for search optimization

**Visual assets**:

- App icon in multiple sizes (already done via R-01)
- Hero/feature graphic (1024x500 for Google, 2480x1200 for Microsoft)
- Screenshots: at least 3, ideally showing
  - Profile view with realistic data
  - Observations grouped by theme
  - AI chat in action
  - Settings with privacy info
- Privacy-respectful: no real health data in screenshots

**Legal**:

- Privacy policy URL (Phylax: minimal, mostly "we don't collect anything")
- Terms of service (optional but recommended)
- Age rating appropriate declaration
- Medical disclaimer reiteration (Phylax is NOT a medical device)

**Technical**:

- Live PWA URL with HTTPS (D-01 or D-02)
- Service Worker functional
- Lighthouse PWA audit passing
- Responsive layout verified on mobile/tablet/desktop

---

## Cost summary

**Total one-time costs for maximum reach (excluding iOS)**:

- Microsoft Store Individual: ~20€
- Google Play Developer: ~25€
- Domain (optional): ~15€/year
- F-Droid, GitHub Pages, Amazon: free

**Minimum viable launch (GitHub Pages only)**: 0€

**Recommended first-year budget**: ~60€ (Microsoft Store + Google Play + domain)

**Maximum reach (all platforms except iOS)**: ~60€ one-time + 15€/year domain

---

## Decision framework

**Go to D-01 now because**:

- Unlocks everything else (stores require live URL)
- Zero cost, zero commitment
- Enables browser-based installation for early users
- Provides testable URL for feedback

**Delay D-02 (custom domain) until**:

- User base grows beyond developer audience
- Domain purchase feels justified
- Consistent GitHub Pages success

**Consider D-03 (Microsoft Store) when**:

- Browser-based installs are stable
- Screenshots and descriptions are ready
- 20€ investment feels right
- Windows users are expressing interest

**Consider D-04 (F-Droid) when**:

- Repository is structured for F-Droid's build system
- Comfortable with public FOSS community review
- Want to reach privacy-aware Android users

**Consider D-05 (Google Play) when**:

- D-03 experience has refined your store listing skills
- Android reach justifies 25€ investment
- Privacy policy is solid enough for Google's data safety form

**Skip D-06 (Apple App Store) unless**:

- Demand from iOS users is vocal and consistent
- Budget comfortably handles 99€/year
- Native iOS features worth pursuing beyond Safari PWA install

---

## References

- PWABuilder: https://pwabuilder.com (Microsoft's free tool for all store packages)
- F-Droid Inclusion Policy: https://f-droid.org/docs/Inclusion_Policy/
- Google Play Developer Console: https://play.google.com/console
- Microsoft Partner Center: https://partner.microsoft.com
- Bubblewrap (TWA tool): https://github.com/GoogleChromeLabs/bubblewrap

---

_This document is a strategic reference. Actual task execution happens via D-01, D-02, etc. prompts when those tasks are initiated._

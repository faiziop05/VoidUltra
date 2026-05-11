use below folders to work on, react native project is already created

Native\VoidUltra\src

04/16/2026 02:12 PM <DIR> .
04/16/2026 02:11 PM <DIR> ..
04/16/2026 02:10 PM <DIR> components
04/16/2026 02:11 PM <DIR> redux
04/16/2026 02:11 PM <DIR> screens
04/16/2026 02:11 PM <DIR> theme
04/16/2026 02:12 PM <DIR> utils

Here is the link to the original application you requested to reverse engineer:
**App Store Link:** [Void Max](https://apps.apple.com/us/app/void-max/id6451418601)\\\\\\\\
below is there app desctiption
Have you ever overshared on the internet and wished for a redo. Well, with Void Max you get that second chance.

Void Max is our free micro journaling app that helps you avoid impulsively posting on social media by turning your life into your personal private timeline.
Void Max looks like a typical social media app, so the interface is easy to use.
But unlike social media, Void Max is a Privacy First app, meaning no one can see your posts — not even us. We even blur the timeline so your business stays your own
Once we unlock our timeline, we can see all of our posts including health and wellness prompts we have answered, and even links we shared to our timeline
Now you can micro journal whatever’s top of mind…
Or
For deeper reflections Void Max can access recent photos, videos, calendar events, and even track your health with engaging questions.

Key Features:

Total Privacy: Your journal is private, and no one else can see it. You can unlock your posts using Face ID, Touch ID or passcode.

Easy-to-Use Interface: It's as user-friendly as social media but without the noise.

Freedom to Express: Be yourself without fear of judgment or cancellation.

Daily Prompts: Get inspired with daily writing prompts.

Threads: Add depth to your entries with threaded conversations.

Post Attachments: Attach photos, voice memos, videos, and more to your posts.

While Void Max is personal and just for you, sometimes you want to share your posts with your friends and family. So when you’re ready, we made it easy to share via iMessage, Facebook, Instagram, or even to Apple’s new journaling app.

Void Max is built for you to keep track of all your thoughts throughout the day making it the perfect tool to avoid impulsive posting on the internet, while also helping support your mental health by providing you a safe space for all of your thoughts.

Below is the comprehensive, highly detailed Product Requirements Document (PRD) and exact blueprint designed specifically to be copied and pasted into Antigravity (or any AI coding agent) to build the complete application.

---

# PROJECT BLUEPRINT: Void ULTRA

**App Name:** Void ULTRA (or _Void Ultra_)
**Core Goal:** To provide a hyper-private, offline-first micro-journaling experience that mimics the fluid, dopamine-driven UI of a social media timeline. It allows users to safely dump thoughts, vent, track moods, and record memories without the pressure or privacy risks of a public audience. It is "social media for an audience of one."

## 1. Technical Architecture & Constraints

- **Framework:** React Native utilizing the Expo SDK.
- **Architecture:** Strict local client-side processing to completely eliminate operational costs and guarantee 100% user privacy. No external backend servers, no cloud APIs, and no third-party data tracking.
- **Database:** Local SQLite (using `expo-sqlite`) for high-speed querying of text and tags.
- **Storage:** `expo-file-system` for saving local image URIs and media attachments.
- **Design System:** A modern minimalist "Digital Zen" UI. The default aesthetic is a deep, immersive Dark Mode to reduce eye strain, featuring clean typography and borderless component design.

## 2. Database Schema (SQLite)

Antigravity must initialize a local database with the following structure:

- **Table: `posts`**
  - `id` (TEXT, UUID, Primary Key)
  - `content` (TEXT, the body of the post)
  - `timestamp` (INTEGER, Unix epoch time)
  - `is_pinned` (BOOLEAN)
  - `mood_score` (INTEGER, optional 1-5 scale)
- **Table: `media`**
  - `id` (TEXT, UUID, Primary Key)
  - `post_id` (TEXT, Foreign Key to `posts.id`)
  - `file_uri` (TEXT, local device path)
  - `media_type` (TEXT, 'image' or 'video')
- **Table: `tags`**
  - `id` (TEXT, UUID, Primary Key)
  - `name` (TEXT, unique tag name)
- **Table: `post_tags`** (Join Table)
  - `post_id` (TEXT)
  - `tag_id` (TEXT)

## 3. Screen-by-Screen Breakdown & Navigation Flow

The app will use `@react-navigation/native` with a bottom tab navigator and a stacked modal system for composing new entries.

### Screen 1: The Initial Onboarding & Secure Vault Setup

**Purpose:** Welcomes the user, explains the absolute privacy of the local-only architecture, and sets up biometric security.

- **UI Components:**
  - Full-screen minimal carousel with smooth animations (`react-native-reanimated`).
  - **Slide 1:** "Welcome to EchoVoid. Your personal timeline."
  - **Slide 2:** "Zero Servers. Zero Tracking. Everything stays exactly here, on your device."
  - **Slide 3:** Biometric Setup. A button triggering `expo-local-authentication` to lock the app behind FaceID/TouchID or device PIN.
- **State Logic:** Once completed, a boolean `hasOnboarded` is saved to `AsyncStorage` to bypass this screen on future launches.

### Screen 2: The Main Feed (Home Timeline)

**Purpose:** The core screen of the application. It looks and feels exactly like a Twitter or Threads feed, but populated strictly with the user's own journal entries.

- **UI Components:**
  - **Header:** Minimal top bar with the app logo and a "Search" icon.
  - **FlatList / FlashList:** A highly optimized list rendering all posts in reverse-chronological order.
  - **Post Component (The "Echo"):**
    - Avatar: A static, customizable user profile picture.
    - Timestamp: Formatted relatively (e.g., "2m ago", "4h ago", "Oct 12").
    - Body Text: Supports markdown-style rendering for bold/italics.
    - Media Container: If images are attached, they render in a curved-border grid layout.
    - Action Bar (Bottom of post): Icons for "Reply/Thread", "Tag", and "Delete".
  - **Floating Action Button (FAB):** A prominent, haptic-enabled button positioned at the bottom right to trigger the "Compose" modal.
- **Interactions:**
  - Pull-to-refresh (even though it's local, this provides a satisfying UI reset).
  - Long-press on a post to trigger a bottom sheet menu: "Pin to Top", "Copy Text", "Delete".

### Screen 3: The Compose Modal (Writing a Post)

**Purpose:** A frictionless, distraction-free environment to immediately capture a thought.

- **UI Components:**
  - Slides up from the bottom covering 90% of the screen.
  - **Top Bar:** "Cancel" on the left, "Post" (disabled if empty) on the right.
  - **Text Input:** Auto-focuses immediately upon opening, popping up the keyboard. It dynamically expands in height as the user types.
  - **Media Bar (above keyboard):**
    - Camera Icon: Triggers `expo-image-picker` to take a new photo.
    - Gallery Icon: Triggers `expo-image-picker` to select existing media.
    - Tag Icon (#): Opens an inline list to append tags to the post.
- **State Logic:**
  - When "Post" is tapped, the app captures the timestamp, saves the text/tags/media URIs to the local SQLite database, triggers a physical vibration (`expo-haptics`), closes the modal, and instantly prepends the new post to the top of the Main Feed.

### Screen 4: Thread Detail View

**Purpose:** To expand a single thought and allow the user to reply to themselves, creating a continuous thread of thought over time.

- **UI Components:**
  - Accessed by tapping a specific post from the Main Feed.
  - Shows the original post in a larger font at the top.
  - A vertical connecting line (UI aesthetic) extending downward to any "replies" the user has added to this specific thought.
  - A "Reply to this..." text input field fixed at the bottom of the screen.

### Screen 5: The Search & Tag Explorer

**Purpose:** To easily retrieve past thoughts based on keywords or categorized tags.

- **UI Components:**
  - Top sticky search bar. Auto-filters the SQLite database locally as the user types (`onChangeText`).
  - **Tag Grid:** Below the search bar, a dynamic wrap-layout of pill-shaped buttons showing all active tags (e.g., `#ideas`, `#vent`, `#dreams`, `#work`).
  - Tapping a tag instantly switches the view below to a FlatList of only the posts containing that tag.

### Screen 6: The Calendar / Heatmap Archive

**Purpose:** A visual representation of the user's journaling frequency.

- **UI Components:**
  - A GitHub-style contribution heatmap or a traditional monthly calendar view.
  - Days with multiple posts are shaded in a brighter/deeper color.
  - Tapping a specific day opens a modal showing the exact timeline feed for that specific 24-hour period.
- **Logic:** Queries the SQLite database grouping by `DATE(timestamp)` to populate the calendar matrix.

### Screen 7: Profile & Settings (The Control Center)

**Purpose:** App management and data control.

- **UI Components:**
  - **User Customization:** Change the display name and avatar (only visible to the user).
  - **Appearance:** Toggle between System Default, Light, and the preferred Digital Zen Dark Mode.
  - **Security:** Toggle Biometric App Lock on/off.
  - **Data Management (Crucial for offline apps):**
    - "Export Data": Generates a JSON file or plain text file of all database entries and allows the user to share/save it via Expo Sharing.
    - "Nuke Timeline": A heavily warned, double-confirmation button that completely wipes the local SQLite database and deletes all stored media URIs from the device, ensuring the "void" is permanently emptied.

## 4. Animation and UX Guidelines for Antigravity

To ensure the app feels premium and not like a standard template, Antigravity must implement the following UX details:

- **Haptics:** Use `expo-haptics` on every major interaction (liking a post, posting a new entry, deleting).
- **Keyboard Handling:** Use `KeyboardAvoidingView` perfectly on the compose screens so the text input never gets hidden behind the OS keyboard.
- **Transitions:** The transition from the Main Feed to the Compose Modal must be seamless. Use `react-native-reanimated` to fade in the background overlay smoothly.
- **Empty States:** If the database is empty, the Main Feed should display a beautifully minimal empty state component: a faint icon of a black hole or void, with the text "It's quiet in here. Tap the + to drop a thought into the void."

## 5. Development Milestones (For AI Execution)

1.  **Phase 1:** Initialize Expo project, install dependencies (React Navigation, Reanimated, SQLite, FileSystem, Safe Area Context). Set up the Dark Mode theme provider.
2.  **Phase 2:** Build the SQLite database connection, establish schemas, and write CRUD helper functions.
3.  **Phase 3:** Build the UI components (Timeline Feed, Post Card, FAB). Wire them to the database to ensure dummy data renders correctly.
4.  **Phase 4:** Build the Compose Modal, integrating Image Picker and haptic feedback. Ensure successful saving of real entries.
5.  **Phase 5:** Build out Search, Tagging, and the Calendar View.
6.  **Phase 6:** Implement Local Authentication (Biometrics) and the Data Export/Delete functionality in settings.

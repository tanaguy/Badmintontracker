# Badminton Tracker - Web Version 🏸

A mobile-friendly Progressive Web App (PWA) for tracking badminton matches, players, and statistics. Works 100% in your browser with **ZERO server costs**!

## ✨ Features

- 📱 **Mobile-First Design** - Optimized for phones and tablets
- 🏸 **Singles & Doubles** - Support for both match types
- ⚖️ **Fair Rotation** - Equal play distribution algorithm
- 📊 **Rankings & Stats** - Track win rates and performance
- 💾 **Offline Support** - Works without internet (PWA)
- 🏠 **Install to Home Screen** - Acts like a native app
- 🆓 **Completely Free** - No server, no hosting fees

## 🚀 Quick Start (3 Options)

### Option 1: Open Locally (Easiest - 30 seconds)

1. Download all the files to a folder
2. Double-click `index.html`
3. Done! The app opens in your browser

**Pros:** Instant, no setup
**Cons:** Need to open file each time

---

### Option 2: GitHub Pages (Free Hosting - 5 minutes)

**Best for:** Accessing from any device, anywhere

#### Steps:

1. **Create GitHub Account** (if you don't have one)
   - Go to https://github.com
   - Sign up (it's free!)

2. **Create New Repository**
   - Click the `+` icon → "New repository"
   - Name: `badminton-tracker` (or any name)
   - Make it **Public**
   - Click "Create repository"

3. **Upload Files**
   - Click "uploading an existing file"
   - Drag and drop ALL files:
     - `index.html`
     - `styles.css`
     - `app.js`
     - `manifest.json`
     - `service-worker.js`
   - Click "Commit changes"

4. **Enable GitHub Pages**
   - Go to repository Settings
   - Scroll to "Pages" section
   - Source: Select "main" branch
   - Click "Save"

5. **Access Your App**
   - Wait 1-2 minutes
   - Your app will be at: `https://YOUR-USERNAME.github.io/badminton-tracker/`
   - Bookmark this URL!

**Your app is now live and accessible from ANY device! 🎉**

---

### Option 3: Netlify Drop (Drag & Drop - 2 minutes)

**Best for:** Quickest online deployment

#### Steps:

1. Go to https://app.netlify.com/drop
2. Drag the folder containing all files into the upload area
3. Done! You get a live URL instantly

**Example URL:** `https://random-name-12345.netlify.app`

You can customize the URL in Netlify settings.

---

### Option 4: Other Free Hosting Services

All of these offer free hosting:

- **Vercel** - https://vercel.com (great for developers)
- **Cloudflare Pages** - https://pages.cloudflare.com
- **Render** - https://render.com (free static sites)
- **Surge** - https://surge.sh (simple command-line)

---

## 📱 Install as Mobile App (PWA)

Once your app is hosted online:

### On iPhone/iPad:
1. Open the URL in Safari
2. Tap the Share button
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add"
5. Now it appears as an app icon! 🎉

### On Android:
1. Open the URL in Chrome
2. Tap the menu (three dots)
3. Tap "Install app" or "Add to Home screen"
4. Tap "Install"
5. App icon appears on your home screen! 🎉

---

## 🎮 How to Use

### First Time Setup

1. **Add Players**
   - Go to "Players" tab
   - Tap "➕ Add" button
   - Enter name, optionally add photo
   - Set skill level
   - Save

2. **Start a Session**
   - Go to "Session" tab
   - Tap "Start New Session"
   - Name your session (e.g., "Monday Night")
   - Select participating players
   - Tap "Start Session"

### Playing Matches

1. **Generate Matches**
   - Tap "Generate Matches" button
   - Choose Singles or Doubles
   - Select number of matches
   - Optional: Enable skill-based matching
   - Tap "Generate"

2. **Record Results**
   - Tap on a match in the queue
   - Select the winning team
   - Optional: Add detailed scores
   - Tap "Record Match"

### View Stats

- **Rankings Tab**: See overall and session rankings
- **History Tab**: Review past sessions and matches

---

## 💡 Key Features Explained

### Equal Rotation Algorithm
The app automatically tracks how many games each player has played and prioritizes players who have played the least. This ensures everyone gets equal playing time!

**Example:** If Player A played 3 games and Player B played 1 game, Player B will be selected for the next match first.

### Skill-Based Matching
When enabled, the app tries to match players with similar skill levels (1-5 scale) while still maintaining fair rotation.

### Session vs Overall Stats
- **Overall**: Lifetime statistics across all sessions
- **Session**: Statistics for the current active session only

---

## 🔧 Technical Details

### Files Included:
- `index.html` - Main app structure
- `styles.css` - Mobile-optimized styling
- `app.js` - All app logic and functionality
- `manifest.json` - PWA configuration
- `service-worker.js` - Offline support

### Technologies Used:
- Vanilla JavaScript (no frameworks needed)
- CSS Grid & Flexbox for responsive layout
- LocalStorage for data persistence
- Service Workers for PWA features

### Browser Support:
- ✅ Chrome/Edge (recommended)
- ✅ Safari (iOS/Mac)
- ✅ Firefox
- ✅ Samsung Internet

---

## 📊 Data Storage

All data is stored locally in your browser using LocalStorage:
- **Players** - Names, avatars, skill levels
- **Sessions** - Session history and player rosters
- **Matches** - Match results and scores
- **Stats** - Calculated win rates and rankings

**Note:** Data is device-specific. If you switch devices or clear browser data, you'll lose your history. Consider exporting data periodically (future feature).

---

## 🆘 Troubleshooting

### App doesn't load
- Make sure all files are in the same folder
- Try opening in a different browser
- Check browser console for errors (F12)

### "Install to Home Screen" not showing
- Must be accessed via HTTPS (use GitHub Pages or Netlify)
- Make sure you're using a supported browser
- PWA features require online hosting

### Data not saving
- Check if browser is in private/incognito mode
- Ensure LocalStorage is enabled in browser settings
- Try a different browser

### Match generation not working
- Need at least 2 players for singles
- Need at least 4 players for doubles
- Make sure you've started a session first

---

## 🎯 Tips for Best Experience

1. **Add all players before starting a session**
2. **Use descriptive session names** (e.g., "Monday Night - Week 1")
3. **Record scores** for better statistics tracking
4. **End sessions** when done to keep history organized
5. **Install to home screen** for quick access

---

## 🔐 Privacy & Security

- **No data collection** - Everything stays on your device
- **No tracking** - No analytics or third-party scripts
- **No account needed** - Just open and use
- **Offline capable** - Works without internet after first load

---

## 🚀 Future Enhancements (Optional)

Want to improve the app? Here are some ideas:
- Export/import data (JSON backup)
- Multiple tournaments support
- Team photos and bios
- Match scheduling
- Push notifications for upcoming matches
- Dark mode

---

## 📞 Support

Having issues? Common solutions:
1. Clear browser cache and reload
2. Make sure all files are uploaded
3. Check browser console (F12) for errors
4. Try a different browser

---

## 📄 License

Free to use, modify, and share! No attribution required.

---

## 🎉 You're Ready!

Pick a hosting option above, deploy your app, and start tracking your badminton games! The entire setup takes less than 5 minutes.

**Happy playing! 🏸**

// Bhagavad Gita App - Main Application Logic
class GitaApp {
    constructor() {
        this.currentView = 'home';
        this.currentChapter = null;
        this.currentShloka = null;
        this.db = null;
        this.chapters = [];
        this.bookmarks = this.loadBookmarks();
        this.theme = localStorage.getItem('theme') || 'dark';
        
        this.init();
    }

    async init() {
        // Initialize IndexedDB
        await this.initDB();
        
        // Load chapter metadata
        await this.loadChapterMetadata();
        
        // Set theme
        this.setTheme(this.theme);
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Render chapter list
        this.renderChapterList();
        
        // Show daily shloka
        this.showDailyShloka();
        
        // Check for install prompt
        this.setupInstallPrompt();
    }

    // IndexedDB Setup
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('GitaDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains('chapters')) {
                    db.createObjectStore('chapters', { keyPath: 'number' });
                }
                if (!db.objectStoreNames.contains('shlokas')) {
                    const shlokaStore = db.createObjectStore('shlokas', { keyPath: 'id' });
                    shlokaStore.createIndex('chapter', 'chapter', { unique: false });
                }
            };
        });
    }

    // Load chapter metadata from JSON
    async loadChapterMetadata() {
        try {
            const response = await fetch('data/chapters.json');
            this.chapters = await response.json();
        } catch (error) {
            console.error('Error loading chapters:', error);
            // Fallback to hardcoded metadata
            this.chapters = this.getDefaultChapters();
        }
    }

    getDefaultChapters() {
        return [
            { number: 1, title: "Arjuna's Dilemma", sanskrit: "अर्जुनविषादयोग", verses: 47 },
            { number: 2, title: "The Path of Knowledge", sanskrit: "सांख्ययोग", verses: 72 },
            { number: 3, title: "The Path of Action", sanskrit: "कर्मयोग", verses: 43 },
            { number: 4, title: "The Path of Wisdom", sanskrit: "ज्ञानकर्मसंन्यासयोग", verses: 42 },
            { number: 5, title: "Action and Renunciation", sanskrit: "कर्मसंन्यासयोग", verses: 29 },
            { number: 6, title: "The Path of Meditation", sanskrit: "आत्मसंयमयोग", verses: 47 },
            { number: 7, title: "Knowledge and Wisdom", sanskrit: "ज्ञानविज्ञानयोग", verses: 30 },
            { number: 8, title: "The Eternal Brahman", sanskrit: "अक्षरब्रह्मयोग", verses: 28 },
            { number: 9, title: "Royal Knowledge", sanskrit: "राजविद्याराजगुह्ययोग", verses: 34 },
            { number: 10, title: "Divine Manifestations", sanskrit: "विभूतियोग", verses: 42 },
            { number: 11, title: "The Universal Form", sanskrit: "विश्वरूपदर्शनयोग", verses: 55 },
            { number: 12, title: "The Path of Devotion", sanskrit: "भक्तियोग", verses: 20 },
            { number: 13, title: "Field and Knower", sanskrit: "क्षेत्रक्षेत्रज्ञविभागयोग", verses: 35 },
            { number: 14, title: "Three Qualities", sanskrit: "गुणत्रयविभागयोग", verses: 27 },
            { number: 15, title: "The Supreme Person", sanskrit: "पुरुषोत्तमयोग", verses: 20 },
            { number: 16, title: "Divine and Demonic", sanskrit: "दैवासुरसम्पद्विभागयोग", verses: 24 },
            { number: 17, title: "Three Types of Faith", sanskrit: "श्रद्धात्रयविभागयोग", verses: 28 },
            { number: 18, title: "Liberation Through Renunciation", sanskrit: "मोक्षसंन्यासयोग", verses: 78 }
        ];
    }

    // Load chapter content
    async loadChapter(chapterNum) {
        // Check if already in cache
        const cached = await this.getFromDB('chapters', chapterNum);
        if (cached) return cached;

        // Fetch from server
        try {
            const response = await fetch(`data/chapters/chapter-${chapterNum}.json`);
            const chapter = await response.json();
            
            // Store in IndexedDB
            await this.saveToDBStore('chapters', chapter);
            
            return chapter;
        } catch (error) {
            console.error(`Error loading chapter ${chapterNum}:`, error);
            return null;
        }
    }

    // Database operations
    async saveToDBStore(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getFromDB(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Event Listeners
    setupEventListeners() {
        // Menu toggle
        document.getElementById('menuBtn').addEventListener('click', () => {
            document.getElementById('sidebar').classList.add('active');
        });

        document.getElementById('closeSidebar').addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('active');
        });

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Search
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

        // Swipe gestures for mobile
        this.setupSwipeGestures();
    }

    setupSwipeGestures() {
        let touchStartX = 0;
        let touchEndX = 0;

        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });

        document.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
        });

        const handleSwipe = () => {
            if (touchEndX < touchStartX - 50) {
                // Swipe left - next shloka
                this.nextShloka();
            }
            if (touchEndX > touchStartX + 50) {
                // Swipe right - previous shloka
                this.previousShloka();
            }
        };

        this.handleSwipe = handleSwipe;
    }

    // Theme Management
    setTheme(theme) {
        this.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        const icon = document.querySelector('.theme-icon');
        icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    toggleTheme() {
        const newTheme = this.theme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    // Navigation
    showView(viewName) {
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`${viewName}View`).classList.add('active');
        this.currentView = viewName;
        
        // Close sidebar
        document.getElementById('sidebar').classList.remove('active');
    }

    goHome() {
        this.showView('home');
    }

    goBack() {
        if (this.currentView === 'shloka') {
            this.showChapter(this.currentChapter);
        } else {
            this.goHome();
        }
    }

    showChapters() {
        // Scroll to top and show home (chapters accessible via sidebar)
        document.getElementById('sidebar').classList.add('active');
    }

    showSearch() {
        this.showView('search');
        document.getElementById('searchInput').focus();
    }

    showBookmarks() {
        this.showView('bookmarks');
        this.renderBookmarks();
    }

    // Chapter List Rendering
    renderChapterList() {
        const list = document.getElementById('chapterList');
        list.innerHTML = this.chapters.map(ch => `
            <div class="chapter-item" onclick="app.showChapter(${ch.number})">
                <div class="chapter-number">Chapter ${ch.number}</div>
                <div class="chapter-title">${ch.title}</div>
                <div class="chapter-sanskrit">${ch.sanskrit}</div>
            </div>
        `).join('');
    }

    // Show Chapter
    async showChapter(chapterNum) {
        this.showLoading(true);
        
        const chapter = await this.loadChapter(chapterNum);
        if (!chapter) {
            this.showLoading(false);
            alert('Chapter not available. Please check your connection.');
            return;
        }

        this.currentChapter = chapterNum;
        const content = document.getElementById('chapterContent');
        
        content.innerHTML = `
            <h2>Chapter ${chapterNum}: ${chapter.title}</h2>
            <p class="chapter-intro">${chapter.introduction || ''}</p>
            <div class="shloka-list">
                ${chapter.shlokas.map((shloka, idx) => `
                    <div class="shloka-card" onclick="app.showShloka(${chapterNum}, ${idx + 1})">
                        <div class="verse-number">Verse ${idx + 1}</div>
                        <div class="sanskrit">${shloka.sanskrit}</div>
                    </div>
                `).join('')}
            </div>
        `;
        
        this.showView('chapter');
        this.showLoading(false);
    }

    // Show Individual Shloka
    async showShloka(chapterNum, shlokaNum) {
        this.showLoading(true);
        
        const chapter = await this.loadChapter(chapterNum);
        if (!chapter) {
            this.showLoading(false);
            return;
        }

        const shloka = chapter.shlokas[shlokaNum - 1];
        this.currentShloka = { chapter: chapterNum, verse: shlokaNum };
        
        const isBookmarked = this.isBookmarked(chapterNum, shlokaNum);
        
        const content = document.getElementById('shlokaContent');
        content.innerHTML = `
            <div class="shloka-detail">
                <div class="verse-number">Chapter ${chapterNum}, Verse ${shlokaNum}</div>
                
                <div class="sanskrit">${shloka.sanskrit}</div>
                
                ${shloka.transliteration ? `
                    <div class="transliteration">${shloka.transliteration}</div>
                ` : ''}
                
                <div class="translation">
                    <div class="section-title">Translation</div>
                    ${shloka.translation}
                </div>
                
                ${shloka.modern ? `
                    <div class="modern-explanation">
                        <div class="section-title">For Our Generation</div>
                        ${shloka.modern}
                    </div>
                ` : ''}
                
                <div style="margin-top: 2rem; display: flex; gap: 1rem;">
                    <button class="bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" 
                            onclick="app.toggleBookmark(${chapterNum}, ${shlokaNum})">
                        ${isBookmarked ? '⭐ Bookmarked' : '☆ Bookmark'}
                    </button>
                    <button class="share-btn" onclick="app.shareShloka(${chapterNum}, ${shlokaNum})">
                        📤 Share
                    </button>
                </div>
            </div>
        `;
        
        this.showView('shloka');
        this.showLoading(false);
    }

    // Daily Shloka
    async showDailyShloka() {
        // Generate random shloka or use date-based
        const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
        const chapterNum = (dayOfYear % 18) + 1;
        const chapter = await this.loadChapter(chapterNum);
        
        if (chapter && chapter.shlokas.length > 0) {
            const verseNum = (dayOfYear % chapter.shlokas.length) + 1;
            const shloka = chapter.shlokas[verseNum - 1];
            
            document.getElementById('dailyShloka').innerHTML = `
                <div class="sanskrit" style="font-size: 1.2rem;">${shloka.sanskrit}</div>
                <div class="translation" style="margin-top: 1rem;">
                    ${shloka.translation.substring(0, 150)}...
                </div>
                <button class="action-btn" style="margin-top: 1rem;" 
                        onclick="app.showShloka(${chapterNum}, ${verseNum})">
                    Read Full Verse
                </button>
            `;
        }
    }

    // Bookmarks
    loadBookmarks() {
        const saved = localStorage.getItem('bookmarks');
        return saved ? JSON.parse(saved) : [];
    }

    saveBookmarks() {
        localStorage.setItem('bookmarks', JSON.stringify(this.bookmarks));
    }

    isBookmarked(chapter, verse) {
        return this.bookmarks.some(b => b.chapter === chapter && b.verse === verse);
    }

    toggleBookmark(chapter, verse) {
        const index = this.bookmarks.findIndex(b => b.chapter === chapter && b.verse === verse);
        
        if (index > -1) {
            this.bookmarks.splice(index, 1);
        } else {
            this.bookmarks.push({ chapter, verse });
        }
        
        this.saveBookmarks();
        
        // Refresh current view
        if (this.currentView === 'shloka') {
            this.showShloka(chapter, verse);
        } else if (this.currentView === 'bookmarks') {
            this.renderBookmarks();
        }
    }

    async renderBookmarks() {
        const list = document.getElementById('bookmarksList');
        
        if (this.bookmarks.length === 0) {
            list.innerHTML = '<p class="loading">No bookmarks yet. Start exploring!</p>';
            return;
        }

        const bookmarkHTML = [];
        for (const bookmark of this.bookmarks) {
            const chapter = await this.loadChapter(bookmark.chapter);
            if (chapter) {
                const shloka = chapter.shlokas[bookmark.verse - 1];
                bookmarkHTML.push(`
                    <div class="shloka-card" onclick="app.showShloka(${bookmark.chapter}, ${bookmark.verse})">
                        <div class="verse-number">Chapter ${bookmark.chapter}, Verse ${bookmark.verse}</div>
                        <div class="sanskrit">${shloka.sanskrit}</div>
                    </div>
                `);
            }
        }
        
        list.innerHTML = bookmarkHTML.join('');
    }

    // Search
    async handleSearch(query) {
        if (query.length < 2) {
            document.getElementById('searchResults').innerHTML = '';
            return;
        }

        this.showLoading(true);
        const results = [];
        
        // Search through all chapters (in real app, use indexed search)
        for (let i = 1; i <= 18; i++) {
            const chapter = await this.loadChapter(i);
            if (chapter) {
                chapter.shlokas.forEach((shloka, idx) => {
                    const searchText = `${shloka.sanskrit} ${shloka.translation} ${shloka.modern || ''}`.toLowerCase();
                    if (searchText.includes(query.toLowerCase())) {
                        results.push({
                            chapter: i,
                            verse: idx + 1,
                            shloka
                        });
                    }
                });
            }
        }

        const resultsContainer = document.getElementById('searchResults');
        resultsContainer.innerHTML = results.slice(0, 20).map(r => `
            <div class="shloka-card" onclick="app.showShloka(${r.chapter}, ${r.verse})">
                <div class="verse-number">Chapter ${r.chapter}, Verse ${r.verse}</div>
                <div class="sanskrit">${r.shloka.sanskrit}</div>
                <div class="translation">${r.shloka.translation.substring(0, 100)}...</div>
            </div>
        `).join('');

        this.showLoading(false);
    }

    // Share Functionality
    async shareShloka(chapter, verse) {
        const chapterData = await this.loadChapter(chapter);
        const shloka = chapterData.shlokas[verse - 1];
        
        const shareText = `${shloka.sanskrit}\n\n${shloka.translation}\n\nBhagavad Gita ${chapter}.${verse}`;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Bhagavad Gita ${chapter}.${verse}`,
                    text: shareText
                });
            } catch (err) {
                console.log('Share cancelled');
            }
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(shareText);
            alert('Copied to clipboard!');
        }
    }

    // Navigation helpers
    nextShloka() {
        // Implement next shloka navigation
    }

    previousShloka() {
        // Implement previous shloka navigation
    }

    // Loading overlay
    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        overlay.classList.toggle('hidden', !show);
    }

    // PWA Install Prompt
    setupInstallPrompt() {
        let deferredPrompt;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            document.getElementById('installPrompt').classList.remove('hidden');
            
            document.getElementById('installBtn').addEventListener('click', async () => {
                document.getElementById('installPrompt').classList.add('hidden');
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                deferredPrompt = null;
            });
            
            document.getElementById('dismissInstall').addEventListener('click', () => {
                document.getElementById('installPrompt').classList.add('hidden');
            });
        });
    }
}

// Initialize app
const app = new GitaApp();

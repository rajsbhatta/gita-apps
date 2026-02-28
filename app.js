// Bhagavad Gita PWA - Main Application
class GitaApp {
    constructor() {
        this.db = null;
        this.chapters = [];
        this.currentView = 'home';
        this.currentChapter = null;
        this.currentShloka = null;
        this.theme = localStorage.getItem('theme') || 'dark';
        this.flavor = localStorage.getItem('flavor') || 'genz';
        this.lastRead = JSON.parse(localStorage.getItem('lastRead')) || null;
        this.pendingPersona = null;
    }

    async init() {
        await this.initDB();
        await this.loadChapters();
        this.setupEventListeners();
        this.applyTheme();
        await this.showDailyShloka();
        this.showLastRead();
        this.updatePersonaIcon();
    }

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
                if (!db.objectStoreNames.contains('chapters')) {
                    db.createObjectStore('chapters', { keyPath: 'number' });
                }
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'id' });
                }
            };
        });
    }

    setupEventListeners() {
        // Menu toggle
        document.getElementById('menuBtn').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshData();
        });

        // Persona dropdown
        const personaBtn = document.getElementById('personaBtn');
        const personaDropdown = document.getElementById('personaDropdown');

        personaBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            personaDropdown.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.persona-selector')) {
                personaDropdown.classList.remove('show');
            }
        });

        // Persona option clicks
        document.querySelectorAll('.persona-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const persona = option.dataset.persona;
                this.showPersonaConfirmation(persona);
                personaDropdown.classList.remove('show');
            });
        });

        // Search input
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        // Expandable action buttons
        document.querySelectorAll('.expand-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.dataset.action;
                
                // Expand animation
                btn.classList.add('expanded');
                
                setTimeout(() => {
                    if (action === 'chapters') this.showChapters();
                    else if (action === 'bookmarks') this.showBookmarks();
                    else if (action === 'search') this.showSearch();
                    
                    btn.classList.remove('expanded');
                }, 300);
            });
        });

        // Click outside modal to close
        document.getElementById('personaModal').addEventListener('click', (e) => {
            if (e.target.id === 'personaModal') {
                this.closePersonaModal();
            }
        });
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', this.theme);
        this.applyTheme();
    }

    applyTheme() {
        document.body.className = this.theme + '-theme';
        const themeIcon = document.querySelector('.theme-icon');
        themeIcon.textContent = this.theme === 'dark' ? '☀️' : '🌙';
    }

    async loadChapters() {
        try {
            // Try to get from IndexedDB first
            const cachedChapters = await this.getFromDB('metadata', 'chapters');
            if (cachedChapters) {
                this.chapters = cachedChapters.data;
                return;
            }

            // Fetch from network
            const response = await fetch('data/chapters.json');
            const data = await response.json();
            this.chapters = data;

            // Cache in IndexedDB
            await this.saveToDB('metadata', { id: 'chapters', data: data });
        } catch (error) {
            console.error('Error loading chapters:', error);
        }
    }

    async loadChapter(chapterNum) {
        try {
            // Try IndexedDB first
            const cached = await this.getFromDB('chapters', chapterNum);
            if (cached) return cached;

            // Fetch from network
            const response = await fetch(`data/chapters/chapter-${chapterNum}.json`);
            if (!response.ok) return null;
            
            const chapter = await response.json();

            // Cache it
            await this.saveToDB('chapters', chapter);
            return chapter;
        } catch (error) {
            console.error('Error loading chapter:', error);
            return null;
        }
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

    async saveToDB(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    showView(viewName) {
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(viewName + 'View').classList.add('active');
        this.currentView = viewName;
        window.scrollTo(0, 0);
    }

    goHome() {
        this.showView('home');
    }

    // Persona Management
    updatePersonaIcon() {
        const icons = {
            'millennial': '👔',
            'genz': '📱',
            'genalpha': '🎮'
        };
        document.querySelector('.persona-icon').textContent = icons[this.flavor] || '👤';
    }

    showPersonaConfirmation(persona) {
        if (persona === this.flavor) {
            this.showToast('Already using this style');
            return;
        }

        this.pendingPersona = persona;

        const personas = {
            'millennial': {
                name: 'Millennial',
                emoji: '👔',
                age: '28-43 years old',
                desc: 'Professional tone with career-focused examples, work-life balance insights, and mature perspectives on responsibility and leadership.'
            },
            'genz': {
                name: 'Gen Z',
                emoji: '📱',
                age: '12-27 years old',
                desc: 'Casual and honest language with social media references, mental health awareness, and authentic perspectives on modern challenges.'
            },
            'genalpha': {
                name: 'Gen Alpha',
                emoji: '🎮',
                age: '5-14 years old',
                desc: 'Simple, fun language with gaming analogies, school examples, and age-appropriate explanations using emojis and relatable scenarios.'
            }
        };

        const info = personas[persona];
        const modalBody = document.getElementById('personaModalBody');
        modalBody.innerHTML = `
            <div class="persona-confirm">
                <div class="persona-confirm-icon">${info.emoji}</div>
                <h4>${info.name}</h4>
                <p class="persona-confirm-age">For ages ${info.age}</p>
                <p class="persona-confirm-desc">${info.desc}</p>
                <p class="persona-confirm-question">Switch to this explanation style?</p>
            </div>
        `;

        document.getElementById('personaModal').classList.add('show');
    }

    confirmPersonaChange() {
        if (!this.pendingPersona) return;

        this.flavor = this.pendingPersona;
        localStorage.setItem('flavor', this.flavor);
        this.updatePersonaIcon();
        
        const names = {
            'millennial': 'Millennial',
            'genz': 'Gen Z',
            'genalpha': 'Gen Alpha'
        };
        
        this.showToast(`✅ Switched to ${names[this.flavor]} style`);
        this.closePersonaModal();

        // Refresh current verse if viewing one
        if (this.currentShloka) {
            this.showShloka(this.currentShloka.chapter, this.currentShloka.verse);
        }
    }

    closePersonaModal() {
        document.getElementById('personaModal').classList.remove('show');
        this.pendingPersona = null;
    }

    getModernExplanation(shloka) {
        if (this.flavor === 'millennial' && shloka.millennial) {
            return shloka.millennial;
        } else if (this.flavor === 'genz' && shloka.genz) {
            return shloka.genz;
        } else if (this.flavor === 'genalpha' && shloka.genalpha) {
            return shloka.genalpha;
        }
        return shloka.modern || shloka.genz || shloka.millennial || shloka.genalpha || '';
    }

    getFlavorTitle() {
        const titles = {
            'millennial': '💼 For Millennials',
            'genz': '📱 For Gen Z',
            'genalpha': '🎮 For Gen Alpha'
        };
        return titles[this.flavor] || '📱 Modern Explanation';
    }

    // Daily Shloka - Simplified to show only Sanskrit
    async showDailyShloka() {
        const container = document.getElementById('dailyShloka');
        
        try {
            const today = new Date();
            const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
            
            const chapterNum = (dayOfYear % 18) + 1;
            const chapter = await this.loadChapter(chapterNum);
            
            if (!chapter || !chapter.shlokas || chapter.shlokas.length === 0) {
                container.innerHTML = '<p>Unable to load daily verse</p>';
                return;
            }
            
            const verseNum = (dayOfYear % chapter.shlokas.length) + 1;
            const shloka = chapter.shlokas.find(s => s.verse === verseNum);
            
            if (!shloka) {
                container.innerHTML = '<p>Verse not found</p>';
                return;
            }
            
            // Store for "Read Full Verse" click
            this.dailyShlokaInfo = { chapter: chapterNum, verse: verseNum };
            
            // Show only Sanskrit text - clickable
            container.innerHTML = `
                <div class="daily-shloka-content" onclick="app.showShloka(${chapterNum}, ${verseNum})">
                    <div class="verse-reference">Chapter ${chapterNum}, Verse ${verseNum}</div>
                    <div class="sanskrit-text">${shloka.sanskrit}</div>
                    <div class="tap-hint">Tap to read full verse →</div>
                </div>
            `;
        } catch (error) {
            console.error('Error loading daily shloka:', error);
            container.innerHTML = `
                <p>Unable to load daily verse</p>
                <button onclick="app.showDailyShloka()" class="retry-btn">Retry</button>
            `;
        }
    }

    // Last Read Progress
    showLastRead() {
        if (!this.lastRead) {
            document.getElementById('continueReading').style.display = 'none';
            return;
        }

        const { chapter, verse, chapterTitle } = this.lastRead;
        const container = document.getElementById('lastReadCard');
        
        container.innerHTML = `
            <div class="last-read-content" onclick="app.showShloka(${chapter}, ${verse})">
                <div class="last-read-icon">📖</div>
                <div class="last-read-info">
                    <div class="last-read-title">${chapterTitle}</div>
                    <div class="last-read-verse">Verse ${verse}</div>
                </div>
                <div class="last-read-arrow">→</div>
            </div>
        `;
        
        document.getElementById('continueReading').style.display = 'block';
    }

    saveLastRead(chapter, verse, chapterTitle) {
        this.lastRead = { chapter, verse, chapterTitle };
        localStorage.setItem('lastRead', JSON.stringify(this.lastRead));
    }

    // Chapters
    showChapters() {
        this.showView('chapters');
        const container = document.getElementById('chaptersList');
        
        container.innerHTML = this.chapters.map(ch => `
            <div class="chapter-card" onclick="app.showChapterDetail(${ch.number})">
                <div class="chapter-number">${ch.number}</div>
                <div class="chapter-info">
                    <h3>${ch.title}</h3>
                    <p class="chapter-sanskrit">${ch.sanskrit}</p>
                    <p class="chapter-verses">${ch.verses} verses</p>
                </div>
            </div>
        `).join('');
    }

    async showChapterDetail(chapterNum) {
        this.showView('chapterDetail');
        const container = document.getElementById('chapterDetail');
        container.innerHTML = '<div class="loading">Loading chapter...</div>';

        const chapter = await this.loadChapter(chapterNum);
        if (!chapter) {
            container.innerHTML = '<p>Error loading chapter</p>';
            return;
        }

        this.currentChapter = chapter;

        container.innerHTML = `
            <div class="chapter-header">
                <h2>Chapter ${chapter.number}: ${chapter.title}</h2>
                <p class="chapter-sanskrit">${chapter.sanskrit}</p>
                <p class="chapter-intro">${chapter.introduction}</p>
            </div>
            <div class="verses-list">
                ${chapter.shlokas.map(shloka => `
                    <div class="verse-item" onclick="app.showShloka(${chapter.number}, ${shloka.verse})">
                        <div class="verse-num">Verse ${shloka.verse}</div>
                        <div class="verse-preview">${shloka.sanskrit.substring(0, 100)}...</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async showShloka(chapterNum, verseNum) {
        this.showView('shloka');
        const container = document.getElementById('shlokaDetail');
        container.innerHTML = '<div class="loading">Loading verse...</div>';

        const chapter = await this.loadChapter(chapterNum);
        if (!chapter) {
            container.innerHTML = '<p>Error loading verse</p>';
            return;
        }

        const shloka = chapter.shlokas.find(s => s.verse === verseNum);
        if (!shloka) {
            container.innerHTML = '<p>Verse not found</p>';
            return;
        }

        this.currentShloka = { chapter: chapterNum, verse: verseNum };
        
        // Save as last read
        this.saveLastRead(chapterNum, verseNum, chapter.title);

        const isBookmarked = this.isBookmarked(chapterNum, verseNum);

        container.innerHTML = `
            <div class="shloka-content">
                <div class="shloka-header">
                    <h2>Chapter ${chapterNum}: ${chapter.title}</h2>
                    <p class="verse-number">Verse ${verseNum}</p>
                </div>

                <div class="sanskrit-section">
                    <div class="section-title">Sanskrit</div>
                    <div class="sanskrit-text">${shloka.sanskrit}</div>
                </div>

                ${shloka.transliteration ? `
                    <div class="transliteration-section">
                        <div class="section-title">Transliteration</div>
                        <div class="transliteration-text">${shloka.transliteration}</div>
                    </div>
                ` : ''}

                ${shloka.translation ? `
                    <div class="translation-section">
                        <div class="section-title">Translation</div>
                        <div class="translation-text">${shloka.translation}</div>
                    </div>
                ` : ''}

                ${this.getModernExplanation(shloka) ? `
                    <div class="modern-explanation">
                        <div class="section-title">${this.getFlavorTitle()}</div>
                        ${this.getModernExplanation(shloka)}
                    </div>
                ` : ''}

                <div style="margin-top: 2rem; display: flex; gap: 1rem; flex-wrap: wrap;">
                    <button class="bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" 
                            onclick="app.toggleBookmark(${chapterNum}, ${verseNum})">
                        ${isBookmarked ? '⭐ Bookmarked' : '☆ Bookmark'}
                    </button>
                    <button class="share-btn" onclick="app.shareShloka(${chapterNum}, ${verseNum})">
                        📤 Share
                    </button>
                </div>

                <!-- Navigation Buttons -->
                <div style="margin-top: 1.5rem; display: flex; gap: 1rem; justify-content: space-between;">
                    ${verseNum > 1 ? `
                        <button class="nav-btn prev-btn" onclick="app.previousVerse()">
                            ← Previous Verse
                        </button>
                    ` : '<div></div>'}
                    
                    ${verseNum < chapter.shlokas.length ? `
                        <button class="nav-btn next-btn" onclick="app.nextVerse()">
                            Next Verse →
                        </button>
                    ` : '<div></div>'}
                </div>
            </div>
        `;
    }

    previousVerse() {
        if (!this.currentShloka) return;
        const { chapter, verse } = this.currentShloka;
        if (verse > 1) {
            this.showShloka(chapter, verse - 1);
        }
    }

    nextVerse() {
        if (!this.currentShloka) return;
        const { chapter, verse } = this.currentShloka;
        this.showShloka(chapter, verse + 1);
    }

    goBackFromShloka() {
        if (this.currentChapter) {
            this.showChapterDetail(this.currentChapter.number);
        } else {
            this.goHome();
        }
    }

    // Bookmarks
    toggleBookmark(chapterNum, verseNum) {
        const bookmarks = this.getBookmarks();
        const key = `${chapterNum}-${verseNum}`;
        
        if (bookmarks[key]) {
            delete bookmarks[key];
            this.showToast('Bookmark removed');
        } else {
            bookmarks[key] = {
                chapter: chapterNum,
                verse: verseNum,
                timestamp: Date.now()
            };
            this.showToast('⭐ Bookmarked!');
        }
        
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
        
        // Refresh current view
        if (this.currentShloka) {
            this.showShloka(chapterNum, verseNum);
        }
    }

    isBookmarked(chapterNum, verseNum) {
        const bookmarks = this.getBookmarks();
        return !!bookmarks[`${chapterNum}-${verseNum}`];
    }

    getBookmarks() {
        return JSON.parse(localStorage.getItem('bookmarks') || '{}');
    }

    async showBookmarks() {
        this.showView('bookmarks');
        const container = document.getElementById('bookmarksList');
        const bookmarks = this.getBookmarks();
        
        if (Object.keys(bookmarks).length === 0) {
            container.innerHTML = '<p class="empty-state">No bookmarks yet. Start exploring and bookmark your favorite verses!</p>';
            return;
        }

        const bookmarkArray = Object.values(bookmarks).sort((a, b) => b.timestamp - a.timestamp);
        
        container.innerHTML = '<div class="loading">Loading bookmarks...</div>';
        
        const bookmarkItems = await Promise.all(bookmarkArray.map(async (bm) => {
            const chapter = await this.loadChapter(bm.chapter);
            if (!chapter) return '';
            
            const shloka = chapter.shlokas.find(s => s.verse === bm.verse);
            if (!shloka) return '';
            
            return `
                <div class="bookmark-item" onclick="app.showShloka(${bm.chapter}, ${bm.verse})">
                    <div class="bookmark-header">
                        <span class="bookmark-ref">Chapter ${bm.chapter}, Verse ${bm.verse}</span>
                        <button class="remove-bookmark" onclick="event.stopPropagation(); app.toggleBookmark(${bm.chapter}, ${bm.verse}); app.showBookmarks();">×</button>
                    </div>
                    <div class="bookmark-preview">${shloka.sanskrit.substring(0, 100)}...</div>
                </div>
            `;
        }));
        
        container.innerHTML = bookmarkItems.join('');
    }

    shareShloka(chapterNum, verseNum) {
        const url = window.location.href;
        const text = `Check out Chapter ${chapterNum}, Verse ${verseNum} from the Bhagavad Gita`;
        
        if (navigator.share) {
            navigator.share({ title: 'Bhagavad Gita', text, url })
                .catch(err => console.log('Share failed', err));
        } else {
            navigator.clipboard.writeText(`${text}\n${url}`);
            this.showToast('📋 Link copied to clipboard');
        }
    }

    // Search
    showSearch() {
        this.showView('search');
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').innerHTML = '';
    }

    async performSearch() {
        const query = document.getElementById('searchInput').value.trim().toLowerCase();
        if (!query) return;

        const resultsContainer = document.getElementById('searchResults');
        resultsContainer.innerHTML = '<div class="loading">Searching...</div>';

        const results = [];

        for (const chapterMeta of this.chapters) {
            const chapter = await this.loadChapter(chapterMeta.number);
            if (!chapter) continue;

            chapter.shlokas.forEach(shloka => {
                const searchText = (
                    shloka.sanskrit + ' ' +
                    (shloka.transliteration || '') + ' ' +
                    (shloka.translation || '') + ' ' +
                    (shloka.modern || '') + ' ' +
                    (shloka.millennial || '') + ' ' +
                    (shloka.genz || '') + ' ' +
                    (shloka.genalpha || '')
                ).toLowerCase();

                if (searchText.includes(query)) {
                    results.push({
                        chapter: chapter.number,
                        verse: shloka.verse,
                        chapterTitle: chapter.title,
                        text: shloka.sanskrit
                    });
                }
            });
        }

        if (results.length === 0) {
            resultsContainer.innerHTML = '<p class="empty-state">No results found</p>';
            return;
        }

        resultsContainer.innerHTML = results.map(r => `
            <div class="search-result-item" onclick="app.showShloka(${r.chapter}, ${r.verse})">
                <div class="result-ref">Chapter ${r.chapter}: ${r.chapterTitle} - Verse ${r.verse}</div>
                <div class="result-preview">${r.text.substring(0, 100)}...</div>
            </div>
        `).join('');
    }

    // Refresh Data
    async refreshData() {
        const refreshBtn = document.getElementById('refreshBtn');
        const refreshIcon = refreshBtn.querySelector('.refresh-icon');
        
        refreshIcon.style.animation = 'spin 1s linear infinite';
        refreshBtn.disabled = true;
        
        try {
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            }
            
            await this.clearDB();
            
            const currentTheme = this.theme;
            const currentFlavor = this.flavor;
            const lastRead = this.lastRead;
            localStorage.clear();
            this.theme = currentTheme;
            this.flavor = currentFlavor;
            localStorage.setItem('theme', this.theme);
            localStorage.setItem('flavor', this.flavor);
            if (lastRead) {
                localStorage.setItem('lastRead', JSON.stringify(lastRead));
            }
            
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(reg => reg.unregister()));
            }
            
            this.showToast('✅ Data refreshed! Reloading...');
            
            setTimeout(() => {
                window.location.reload(true);
            }, 1000);
            
        } catch (error) {
            console.error('Refresh error:', error);
            this.showToast('❌ Error refreshing data');
            refreshIcon.style.animation = '';
            refreshBtn.disabled = false;
        }
    }

    async clearDB() {
        return new Promise((resolve) => {
            const request = indexedDB.deleteDatabase('GitaDB');
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
        });
    }

    showToast(message) {
        const existingToast = document.querySelector('.toast');
        if (existingToast) existingToast.remove();
        
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize app
const app = new GitaApp();
window.addEventListener('DOMContentLoaded', () => app.init());

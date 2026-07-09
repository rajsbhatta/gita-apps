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
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.isDaily = false;
        this.speechSynthesis = window.speechSynthesis;
        this.isSpeaking = false;
        this.readingSpeed = parseFloat(localStorage.getItem('readingSpeed')) || 0.9;
        this.selectedVoice = localStorage.getItem('selectedVoice') || null;
        this.readingPreferences = JSON.parse(localStorage.getItem('readingPreferences')) || {
            readSanskrit: true,
            readTranslation: true,
            readExplanation: true
        };
        // New features
        this.bookmarkNotes = JSON.parse(localStorage.getItem('bookmarkNotes') || '{}');
        this.readingStats = JSON.parse(localStorage.getItem('readingStats') || '{"versesRead":0,"totalReadTime":0,"currentStreak":0,"lastReadDate":null,"readingHistory":[]}');
        this.activeReadingPlan = localStorage.getItem('activeReadingPlan') || null;
        this.readingPlans = JSON.parse(localStorage.getItem('readingPlans') || '{}');
        this.challenges = JSON.parse(localStorage.getItem('challenges') || '{"completed":[],"inProgress":[]}');
        this.currentNoteChapter = null;
        this.currentNoteVerse = null;
    }

    async init() {
        await this.initDB();
        await this.loadChapters();
        this.setupEventListeners();
        this.setupSwipeNavigation();
        this.setupInstallPrompt();
        this.applyTheme();
        await this.showDailyShloka();
        this.showLastRead();
        this.updatePersonaIcon();
        this.initializeReadingPlans();
        this.initializeChallenges();
        this.scheduleNotifications();
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
        document.getElementById('menuBtn').addEventListener('click', () => {
            this.toggleSidebar();
        });

        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.showRefreshConfirmation();
        });

        const installBtn = document.getElementById('installBtn');
        if (installBtn) {
            installBtn.addEventListener('click', () => {
                this.installApp();
            });
        }

        const personaBtn = document.getElementById('personaBtn');
        const personaDropdown = document.getElementById('personaDropdown');

        personaBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            personaDropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.persona-selector')) {
                personaDropdown.classList.remove('show');
            }
        });

        document.querySelectorAll('.persona-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const persona = option.dataset.persona;
                this.showPersonaConfirmation(persona);
                personaDropdown.classList.remove('show');
            });
        });

        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        document.querySelectorAll('.expand-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.dataset.action;
                btn.classList.add('expanded');
                
                setTimeout(() => {
                    if (action === 'introduction') this.showIntroduction();
                    else if (action === 'chapters') this.showChapters();
                    else if (action === 'bookmarks') this.showBookmarks();
                    else if (action === 'search') this.showSearch();
                    else if (action === 'about') this.showAbout();
                    
                    btn.classList.remove('expanded');
                }, 300);
            });
        });

        document.getElementById('personaModal').addEventListener('click', (e) => {
            if (e.target.id === 'personaModal') {
                this.closePersonaModal();
            }
        });

        document.getElementById('noteModal').addEventListener('click', (e) => {
            if (e.target.id === 'noteModal') {
                this.closeNoteModal();
            }
        });
    }

    setupSwipeNavigation() {
        let touchStartX = 0;
        let touchEndX = 0;
        let touchStartY = 0;
        let touchEndY = 0;
        
        const shlokaView = document.getElementById('shlokaView');
        
        if (!shlokaView) return;
        
        shlokaView.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });
        
        shlokaView.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            this.handleSwipe(touchStartX, touchEndX, touchStartY, touchEndY);
        }, { passive: true });
    }

    async handleSwipe(startX, endX, startY, endY) {
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const minSwipeDistance = 50;
        
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
            if (this.isDailyVerse) {
                this.showToast('⚠️ Swipe not available for daily verse');
                return;
            }
            
            if (!this.currentShloka) return;
            
            const shlokaView = document.getElementById('shlokaView');
            const { chapter, verse } = this.currentShloka;
            const currentChapter = await this.loadChapter(chapter);
            
            if (!currentChapter) return;
            
            if (deltaX > 0) {
                if (verse > 1) {
                    shlokaView.classList.add('swiping-right');
                    setTimeout(() => {
                        shlokaView.classList.remove('swiping-right');
                        this.previousVerse();
                    }, 300);
                } else {
                    this.showToast('✅ You are at the first verse of this chapter');
                }
            } else {
                if (verse < currentChapter.shlokas.length) {
                    shlokaView.classList.add('swiping-left');
                    setTimeout(() => {
                        shlokaView.classList.remove('swiping-left');
                        this.nextVerse();
                    }, 300);
                } else {
                    this.showToast('✅ You have reached the last verse of this chapter');
                }
            }
        }
    }

    // Text-to-Speech Functions
    toggleReadAloud(text) {
        if (this.isSpeaking) {
            this.stopReading();
        } else {
            this.startReading(text);
        }
    }

    startReading(text) {
        this.speechSynthesis.cancel();
        const cleanText = text.replace(/<br>/g, '. ').replace(/<[^>]*>/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        const voices = this.speechSynthesis.getVoices();
        
        if (this.selectedVoice) {
            const voice = voices.find(v => v.name === this.selectedVoice);
            if (voice) {
                utterance.voice = voice;
            }
        } else {
            const hindiVoice = voices.find(voice => voice.lang.startsWith('hi'));
            const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
            utterance.voice = hindiVoice || englishVoice || voices[0];
        }
        
        utterance.rate = this.readingSpeed;
        utterance.pitch = 1.0;
        
        utterance.onstart = () => {
            this.isSpeaking = true;
            this.updateReadAloudButton(true);
        };
        
        utterance.onend = () => {
            this.isSpeaking = false;
            this.updateReadAloudButton(false);
        };
        
        utterance.onerror = (event) => {
            if (event.error !== 'canceled' && event.error !== 'interrupted') {
                this.showToast('❌ Unable to read text');
            }
            this.isSpeaking = false;
            this.updateReadAloudButton(false);
        };
        
        this.speechSynthesis.speak(utterance);
    }

    stopReading() {
        if (this.speechSynthesis.speaking) {
            this.speechSynthesis.cancel();
        }
        this.isSpeaking = false;
        this.updateReadAloudButton(false);
    }

    updateReadAloudButton(isReading) {
        const readBtn = document.getElementById('readAloudBtn');
        if (readBtn) {
            if (isReading) {
                readBtn.innerHTML = '🔇 Stop Reading';
                readBtn.classList.add('reading');
            } else {
                readBtn.innerHTML = '🔊 Read Aloud';
                readBtn.classList.remove('reading');
            }
        }
    }

    formatText(text) {
        if (!text) return '';
        return text.replace(/\n/g, '<br>');
    }

    getReadableText(shloka) {
        let text = '';
        
        if (this.readingPreferences.readSanskrit && shloka.sanskrit) {
            text += shloka.sanskrit + '. ';
        }
        
        if (this.readingPreferences.readTranslation && shloka.translation) {
            text += shloka.translation + '. ';
        }
        
        if (this.readingPreferences.readExplanation) {
            const modernText = this.getModernExplanation(shloka);
            if (modernText) {
                text += modernText;
            }
        }
        
        return text.replace(/`/g, '\\`').replace(/\n/g, '. ');
    }

    // PWA Install Functionality
    setupInstallPrompt() {
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
            this.isInstalled = true;
            this.hideInstallButton();
            return;
        }

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });

        window.addEventListener('appinstalled', () => {
            this.isInstalled = true;
            this.deferredPrompt = null;
            this.hideInstallButton();
            this.showToast('✅ App installed successfully!');
        });

        if (this.isIOSDevice() && !this.isInstalled) {
            this.showIOSInstallHint();
        }
    }

    async installApp() {
        if (!this.deferredPrompt) {
            if (this.isIOSDevice()) {
                this.showIOSInstallInstructions();
            } else {
                this.showToast('App is already installed or install not available');
            }
            return;
        }

        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            this.showToast('📥 Installing app...');
        } else {
            this.showToast('Installation cancelled');
        }

        this.deferredPrompt = null;
    }

    showInstallButton() {
        const installBtn = document.getElementById('installBtn');
        if (installBtn) {
            installBtn.style.display = 'flex';
            setTimeout(() => {
                installBtn.style.animation = 'bounceIn 0.5s';
            }, 100);
        }
        
        const banner = document.getElementById('installBanner');
        if (banner && this.currentView === 'home') {
            banner.style.display = 'block';
        }
    }

    hideInstallButton() {
        const installBtn = document.getElementById('installBtn');
        if (installBtn) {
            installBtn.style.display = 'none';
        }
        
        const banner = document.getElementById('installBanner');
        if (banner) {
            banner.style.display = 'none';
        }
    }

    isIOSDevice() {
        return /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
    }

    showIOSInstallHint() {
        if (!window.navigator.standalone) {
            const installBtn = document.getElementById('installBtn');
            if (installBtn) {
                installBtn.style.display = 'flex';
            }
        }
    }

    showIOSInstallInstructions() {
        const modalBody = document.getElementById('personaModalBody');
        modalBody.innerHTML = `
            <div class="install-instructions">
                <h4>📱 Install on iPhone/iPad</h4>
                <ol class="install-steps">
                    <li>Tap the <strong>Share</strong> button <span style="font-size: 1.5rem;">⎋</span> at the bottom of Safari</li>
                    <li>Scroll down and tap <strong>"Add to Home Screen"</strong> <span style="font-size: 1.5rem;">➕</span></li>
                    <li>Tap <strong>"Add"</strong> in the top right</li>
                    <li>The app will appear on your home screen!</li>
                </ol>
            </div>
        `;
        
        document.getElementById('personaModal').classList.add('show');
        
        const confirmBtn = document.querySelector('.btn-primary');
        const originalOnClick = confirmBtn.onclick;
        confirmBtn.textContent = 'Got it!';
        confirmBtn.onclick = () => {
            this.closePersonaModal();
            confirmBtn.textContent = 'Confirm';
            confirmBtn.onclick = originalOnClick;
        };
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');
        
        if (!sidebar.classList.contains('active') && this.isSpeaking) {
            this.stopReading();
        }
        
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
            const cachedChapters = await this.getFromDB('metadata', 'chapters');
            if (cachedChapters) {
                this.chapters = cachedChapters.data;
                return;
            }

            const response = await fetch('data/chapters.json');
            const data = await response.json();
            this.chapters = data;

            await this.saveToDB('metadata', { id: 'chapters', data: data });
        } catch (error) {
            console.error('Error loading chapters:', error);
        }
    }

    async loadChapter(chapterNum) {
        try {
            const cached = await this.getFromDB('chapters', chapterNum);
            if (cached) return cached;

            const response = await fetch(`data/chapters/chapter-${chapterNum}.json`);
            if (!response.ok) return null;
            
            const chapter = await response.json();

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
        if (this.isSpeaking) {
            this.stopReading();
        }

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

    // Introduction Page
    async showIntroduction() {
        this.showView('introduction');
        const container = document.getElementById('introductionContent');
        container.innerHTML = '<div class="loading">Loading introduction...</div>';

        try {
            const response = await fetch('data/introduction.json');
            const data = await response.json();

            container.innerHTML = `
                <h2 class="content-title">${data.title}</h2>
                <p class="content-subtitle">${data.subtitle}</p>
                ${data.sections.map(section => `
                    <div class="content-section">
                        <h3>${section.heading}</h3>
                        <p>${this.formatText(section.content)}</p>
                    </div>
                `).join('')}
            `;
        } catch (error) {
            console.error('Error loading introduction:', error);
            container.innerHTML = '<p class="error-message">Unable to load introduction. Please try again.</p>';
        }
    }

    // About Page
    async showAbout() {
        this.showView('about');
        const container = document.getElementById('aboutContent');
        container.innerHTML = '<div class="loading">Loading about...</div>';

        try {
            const response = await fetch('data/about.json');
            const data = await response.json();

            container.innerHTML = `
                <h2 class="content-title">${data.title}</h2>
                <p class="content-subtitle">${data.subtitle}</p>
                ${data.sections.map(section => `
                    <div class="content-section">
                        <h3>${section.heading}</h3>
                        <p>${this.formatText(section.content)}</p>
                    </div>
                `).join('')}
            `;
        } catch (error) {
            console.error('Error loading about:', error);
            container.innerHTML = '<p class="error-message">Unable to load about. Please try again.</p>';
        }
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
                name: 'Adult',
                emoji: '👔',
                age: '30+ years',
                desc: 'Professional tone with career-focused examples, work-life balance insights, and mature perspectives on responsibility and leadership.'
            },
            'genz': {
                name: 'Youth',
                emoji: '📱',
                age: '15-30 years',
                desc: 'Casual and honest language with social media references, mental health awareness, and authentic perspectives on modern challenges.'
            },
            'genalpha': {
                name: 'Kids',
                emoji: '🎮',
                age: '5-15 years',
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
            'millennial': 'Adult',
            'genz': 'Youth',
            'genalpha': 'Kids'
        };
        
        this.showToast(`✅ Switched to ${names[this.flavor]} style`);
        this.closePersonaModal();

        if (this.currentShloka) {
            this.showShloka(this.currentShloka.chapter, this.currentShloka.verse, this.isDailyVerse);
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
            'millennial': '💼 For Adults',
            'genz': '📱 For Youth',
            'genalpha': '🎮 For Kids'
        };
        return titles[this.flavor] || '📱 Modern Explanation';
    }

    // Daily Shloka
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
            
            this.dailyShlokaInfo = { chapter: chapterNum, verse: verseNum };
            
            const sanskritPreview = shloka.sanskrit.length > 80 
                ? shloka.sanskrit.substring(0, 80) + '...' 
                : shloka.sanskrit;
            
            container.innerHTML = `
                <div class="daily-shloka-content-compact" onclick="app.showShloka(${chapterNum}, ${verseNum}, true)">
                    <div class="daily-header">
                        <span class="daily-label">📖 Today's Verse</span>
                        <span class="daily-reference">Ch ${chapterNum}, V ${verseNum}</span>
                    </div>
                    <div class="sanskrit-text-compact">${this.formatText(sanskritPreview)}</div>
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
            <div class="last-read-content-compact" onclick="app.showShloka(${chapter}, ${verse}, false)">
                <div class="continue-header">
                    <span class="continue-label">📚 Continue Reading</span>
                    <span class="continue-arrow">→</span>
                </div>
                <div class="continue-info">
                    <span class="continue-title">${chapterTitle}</span>
                    <span class="continue-verse">Verse ${verse}</span>
                </div>
            </div>
        `;
        
        document.getElementById('continueReading').style.display = 'block';
    }

    saveLastRead(chapter, verse, chapterTitle) {
        this.lastRead = { chapter, verse, chapterTitle };
        localStorage.setItem('lastRead', JSON.stringify(this.lastRead));
        
        // Update reading stats
        this.updateReadingStats(chapter, verse);
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
                <p class="chapter-intro">${this.formatText(chapter.introduction)}</p>
            </div>
            <div class="verses-list">
                ${chapter.shlokas.map(shloka => `
                    <div class="verse-item" onclick="app.showShloka(${chapter.number}, ${shloka.verse}, false)">
                        <div class="verse-num">Verse ${shloka.verse}</div>
                        <div class="verse-preview">${shloka.sanskrit.substring(0, 100).replace(/\n/g, ' ')}...</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Show Shloka with all features
    async showShloka(chapterNum, verseNum, isDailyVerse = false) {
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
        this.isDailyVerse = isDailyVerse;
        
        if (!isDailyVerse) {
            this.saveLastRead(chapterNum, verseNum, chapter.title);
        }

        const isBookmarked = this.isBookmarked(chapterNum, verseNum);
        const bookmarkNote = this.getBookmarkNote(chapterNum, verseNum);

        const navigationButtons = !isDailyVerse ? `
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
        ` : '';

        container.innerHTML = `
            <div class="shloka-content">
                <div class="shloka-header">
                    <h2>Chapter ${chapterNum}: ${chapter.title}</h2>
                    <p class="verse-number">Verse ${verseNum}${isDailyVerse ? ' - Today\'s Verse' : ''}</p>
                </div>

                <div class="sanskrit-section">
                    <div class="section-title">Sanskrit</div>
                    <div class="sanskrit-text">${this.formatText(shloka.sanskrit)}</div>
                </div>

                ${shloka.transliteration ? `
                    <div class="transliteration-section">
                        <div class="section-title">Transliteration</div>
                        <div class="transliteration-text">${this.formatText(shloka.transliteration)}</div>
                    </div>
                ` : ''}

                ${shloka.translation ? `
                    <div class="translation-section">
                        <div class="section-title">Translation</div>
                        <div class="translation-text">${this.formatText(shloka.translation)}</div>
                    </div>
                ` : ''}

                ${this.getModernExplanation(shloka) ? `
                    <div class="modern-explanation">
                        <div class="section-title">${this.getFlavorTitle()}</div>
                        <div class="modern-text">${this.formatText(this.getModernExplanation(shloka))}</div>
                    </div>
                ` : ''}

                ${bookmarkNote ? `
                    <div class="bookmark-note">
                        <div class="section-title">📝 Your Note</div>
                        <div class="note-content">${this.formatText(bookmarkNote.text)}</div>
                        ${bookmarkNote.tags.length > 0 ? `
                            <div class="note-tags">
                                ${bookmarkNote.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
                            </div>
                        ` : ''}
                        <button class="edit-note-btn" onclick="app.editBookmarkNote(${chapterNum}, ${verseNum})">✏️ Edit Note</button>
                    </div>
                ` : ''}

                <div style="margin-top: 2rem; display: flex; gap: 1rem; flex-wrap: wrap;">
                    <button class="bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" 
                            onclick="app.toggleBookmark(${chapterNum}, ${verseNum})">
                        ${isBookmarked ? '⭐ Bookmarked' : '☆ Bookmark'}
                    </button>
                    ${isBookmarked ? `
                        <button class="note-btn" onclick="app.openNoteModal(${chapterNum}, ${verseNum})">
                            ${bookmarkNote ? '✏️ Edit Note' : '📝 Add Note'}
                        </button>
                    ` : ''}
                    <button id="readAloudBtn" class="read-aloud-btn" onclick="app.toggleReadAloud(\`${this.getReadableText(shloka)}\`)">
                        🔊 Read Aloud
                    </button>
                    <button class="card-btn" onclick="app.showVerseCardCreator(${chapterNum}, ${verseNum})">
                        🎨 Create Card
                    </button>
                    <button class="share-btn" onclick="app.shareShloka(${chapterNum}, ${verseNum}, '${shloka.translation}')">
                        📤 Share
                    </button>
                </div>

                ${navigationButtons}
            </div>
        `;

        setTimeout(() => {
            this.setupSwipeNavigation();
        }, 100);
    }

    previousVerse() {
        if (!this.currentShloka || this.isDailyVerse) return;
        
        if (this.isSpeaking) {
            this.stopReading();
        }
        
        const { chapter, verse } = this.currentShloka;
        
        if (verse <= 1) {
            this.showToast('✅ You are at the first verse of this chapter');
            return;
        }
        
        this.showShloka(chapter, verse - 1, false);
    }

    nextVerse() {
        if (!this.currentShloka || this.isDailyVerse) return;
        
        if (this.isSpeaking) {
            this.stopReading();
        }
        
        const { chapter, verse } = this.currentShloka;
        
        // Check if at last verse
        this.loadChapter(chapter).then(currentChapter => {
            if (!currentChapter) return;
            
            if (verse >= currentChapter.shlokas.length) {
                this.showToast('✅ You have reached the last verse of this chapter');
                return;
            }
            
            this.showShloka(chapter, verse + 1, false);
        });
    }

    goBackFromShloka() {
        if (this.isSpeaking) {
            this.stopReading();
        }
        
        if (this.isDailyVerse) {
            this.goHome();
        } else if (this.currentChapter) {
            this.showChapterDetail(this.currentChapter.number);
        } else {
            this.goHome();
        }
    }

    // Bookmarks with Notes
    toggleBookmark(chapterNum, verseNum) {
        const bookmarks = this.getBookmarks();
        const key = `${chapterNum}-${verseNum}`;
        
        if (bookmarks[key]) {
            delete bookmarks[key];
            delete this.bookmarkNotes[key];
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
        localStorage.setItem('bookmarkNotes', JSON.stringify(this.bookmarkNotes));
        
        if (this.currentShloka) {
            this.showShloka(chapterNum, verseNum, this.isDailyVerse);
        }
    }

    isBookmarked(chapterNum, verseNum) {
        const bookmarks = this.getBookmarks();
        return !!bookmarks[`${chapterNum}-${verseNum}`];
    }

    getBookmarks() {
        return JSON.parse(localStorage.getItem('bookmarks') || '{}');
    }

    // Bookmark Notes
    openNoteModal(chapterNum, verseNum) {
        this.currentNoteChapter = chapterNum;
        this.currentNoteVerse = verseNum;
        
        const existingNote = this.getBookmarkNote(chapterNum, verseNum);
        const noteText = document.getElementById('noteText');
        const noteTags = document.getElementById('noteTags');
        
        if (existingNote) {
            noteText.value = existingNote.text;
            noteTags.value = existingNote.tags.join(', ');
        } else {
            noteText.value = '';
            noteTags.value = '';
        }
        
        document.getElementById('noteModal').classList.add('show');
    }

    closeNoteModal() {
        document.getElementById('noteModal').classList.remove('show');
        this.currentNoteChapter = null;
        this.currentNoteVerse = null;
    }

    saveNote() {
        const noteText = document.getElementById('noteText').value.trim();
        const noteTags = document.getElementById('noteTags').value
            .split(',')
            .map(tag => tag.trim().toLowerCase())
            .filter(tag => tag.length > 0);
        
        if (!noteText) {
            this.showToast('Please enter a note');
            return;
        }
        
        const key = `${this.currentNoteChapter}-${this.currentNoteVerse}`;
        this.bookmarkNotes[key] = {
            text: noteText,
            tags: noteTags,
            dateAdded: new Date().toISOString()
        };
        
        localStorage.setItem('bookmarkNotes', JSON.stringify(this.bookmarkNotes));
        this.showToast('📝 Note saved!');
        this.closeNoteModal();
        
        if (this.currentShloka) {
            this.showShloka(this.currentNoteChapter, this.currentNoteVerse, this.isDailyVerse);
        }
    }

    getBookmarkNote(chapterNum, verseNum) {
        const key = `${chapterNum}-${verseNum}`;
        return this.bookmarkNotes[key] || null;
    }

    editBookmarkNote(chapterNum, verseNum) {
        this.openNoteModal(chapterNum, verseNum);
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
            
            const note = this.getBookmarkNote(bm.chapter, bm.verse);
            
            return `
                <div class="bookmark-item" onclick="app.showShloka(${bm.chapter}, ${bm.verse}, false)">
                    <div class="bookmark-header">
                        <span class="bookmark-ref">Chapter ${bm.chapter}, Verse ${bm.verse}</span>
                        <button class="remove-bookmark" onclick="event.stopPropagation(); app.toggleBookmark(${bm.chapter}, ${bm.verse}); app.showBookmarks();">×</button>
                    </div>
                    <div class="bookmark-preview">${shloka.sanskrit.substring(0, 100).replace(/\n/g, ' ')}...</div>
                    ${note ? `<div class="bookmark-note-preview">📝 ${note.text.substring(0, 50)}...</div>` : ''}
                </div>
            `;
        }));
        
        container.innerHTML = bookmarkItems.join('');
    }

    shareShloka(chapterNum, verseNum, translation) {
        const url = 'https://bit.ly/sb-gita'; // URL
        const verseLink = `https://bit.ly/sb-gita/chapter/${chapterNum}/verse/${verseNum}`;
        
        const shareText = `📖 Bhagavad Gita - Chapter ${chapterNum}, Verse ${verseNum}\n\n"${translation}"\n\n🔗 Read more: `;
        
        if (navigator.share) {
            navigator.share({ 
                title: 'Bhagavad Gita', 
                text: shareText,
                url: url
            }).catch(err => console.log('Share failed', err));
        } else {
            navigator.clipboard.writeText(shareText);
            this.showToast('📋 Verse and link copied to clipboard!');
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
            <div class="search-result-item" onclick="app.showShloka(${r.chapter}, ${r.verse}, false)">
                <div class="result-ref">Chapter ${r.chapter}: ${r.chapterTitle} - Verse ${r.verse}</div>
                <div class="result-preview">${r.text.substring(0, 100).replace(/\n/g, ' ')}...</div>
            </div>
        `).join('');
    }

    // ===== VERSE CARD CREATOR =====
    cardBackgroundImage = 'none';
    cardCreatorData = {
        chapter: null,
        verse: null,
        shloka: null
    };
    
    async showVerseCardCreator(chapterNum, verseNum) {
        this.cardCreatorData.chapter = chapterNum;
        this.cardCreatorData.verse = verseNum;
        
        const chapter = await this.loadChapter(chapterNum);
        if (!chapter) {
            this.showToast('Error loading verse');
            return;
        }
        
        const shloka = chapter.shlokas.find(s => s.verse === verseNum);
        if (!shloka) {
            this.showToast('Verse not found');
            return;
        }
        
        this.cardCreatorData.shloka = shloka;
        
        document.getElementById('cardCreatorModal').classList.add('show');
        
        const previewContent = document.querySelector('.preview-content');
        previewContent.innerHTML = `
            <p class="preview-ref">Chapter ${chapterNum}, Verse ${verseNum}</p>
            <p class="preview-verse">${shloka.sanskrit.replace(/\n/g, '<br>')}</p>
            <p class="preview-translation">"${shloka.translation}"</p>
            <p class="card-footer">|| श्रीमद्भगवद्गीता || Shrimad Bhagavad Gita ||</p>
        `;
    }
    
    closeCardCreator() {
        document.getElementById('cardCreatorModal').classList.remove('show');
    }
    
    updateCardPreviewContent(shloka, chapterNum, verseNum) {
        const previewContent = document.querySelector('.preview-content');
        previewContent.innerHTML = `
            <p class="preview-ref">Chapter ${chapterNum}, Verse ${verseNum}</p>
            <p class="preview-verse">${shloka.sanskrit.replace(/\n/g, '<br>')}</p>
            <p class="preview-translation">"${shloka.translation}"</p>
        `;
    }
    
    updateCardPreview() {
        // Keep it simple - just show the verse
        // No styling updates needed
    }
    
    async downloadVerseCard() {
        if (!this.cardCreatorData.shloka) {
            this.showToast('Please select a verse first');
            return;
        }
        
        const preview = document.getElementById('cardPreview');
        const canvas = await html2canvas(preview, {
            backgroundColor: null,
            scale: 2
        });
        
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `verse-${this.cardCreatorData.chapter}-${this.cardCreatorData.verse}.png`;
        link.click();
        
        this.showToast('📥 Card downloaded!');
    }
    
    async shareVerseCard() {
        if (!this.cardCreatorData.shloka) {
            this.showToast('Please select a verse first');
            return;
        }
        
        const preview = document.getElementById('cardPreview');
        
        try {
            const canvas = await html2canvas(preview, {
                backgroundColor: null,
                scale: 2
            });
            
            canvas.toBlob(async (blob) => {
                if (navigator.share && navigator.canShare({ files: [new File([blob], 'verse-card.png', { type: 'image/png' })] })) {
                    const file = new File([blob], 'verse-card.png', { type: 'image/png' });
                    navigator.share({
                        files: [file],
                        title: 'Bhagavad Gita Verse Card'
                    });
                } else {
                    this.showToast('📋 Download the card to share');
                }
            });
        } catch (error) {
            console.error('Error sharing card:', error);
            this.showToast('❌ Error creating card');
        }
    }


    // ===== READING STATISTICS =====
    updateReadingStats(chapter, verse) {
        const today = new Date().toDateString();
        
        // Increment verses read
        this.readingStats.versesRead = (this.readingStats.versesRead || 0) + 1;
        
        // Update reading history
        if (!this.readingStats.readingHistory) {
            this.readingStats.readingHistory = [];
        }
        
        const todayEntry = this.readingStats.readingHistory.find(entry => entry.date === today);
        if (todayEntry) {
            todayEntry.count += 1;
        } else {
            this.readingStats.readingHistory.push({ date: today, count: 1 });
        }
        
        // Update streak
        const lastReadDate = this.readingStats.lastReadDate ? new Date(this.readingStats.lastReadDate) : null;
        const currentDate = new Date();
        
        if (lastReadDate) {
            const daysDifference = Math.floor((currentDate - lastReadDate) / (1000 * 60 * 60 * 24));
            if (daysDifference === 0) {
                // Same day, no change to streak
            } else if (daysDifference === 1) {
                this.readingStats.currentStreak = (this.readingStats.currentStreak || 0) + 1;
            } else {
                this.readingStats.currentStreak = 1;
            }
        } else {
            this.readingStats.currentStreak = 1;
        }
        
        this.readingStats.lastReadDate = currentDate.toISOString();
        
        localStorage.setItem('readingStats', JSON.stringify(this.readingStats));
        this.checkChallengeProgress();
    }

    async showStatistics() {
        this.showView('statistics');
        const container = document.getElementById('statisticsContent');
        
        const stats = this.readingStats;
        const totalChapters = this.chapters.length;
        const readPercentage = Math.round((stats.versesRead / 700) * 100); // Gita has ~700 verses
        
        let longestStreak = 0;
        let currentStreakCount = 0;
        let streakDays = [];
        
        if (stats.readingHistory && stats.readingHistory.length > 0) {
            stats.readingHistory.forEach(entry => {
                currentStreakCount += entry.count;
            });
            
            const sortedHistory = [...stats.readingHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
            let tempStreak = 1;
            for (let i = 1; i < sortedHistory.length; i++) {
                const prevDate = new Date(sortedHistory[i-1].date);
                const currDate = new Date(sortedHistory[i].date);
                const dayDiff = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
                
                if (dayDiff === 1) {
                    tempStreak++;
                } else {
                    longestStreak = Math.max(longestStreak, tempStreak);
                    tempStreak = 1;
                }
            }
            longestStreak = Math.max(longestStreak, tempStreak);
        }
        
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon">📖</div>
                    <div class="stat-label">Verses Read</div>
                    <div class="stat-value">${stats.versesRead || 0}</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">🔥</div>
                    <div class="stat-label">Current Streak</div>
                    <div class="stat-value">${stats.currentStreak || 0} days</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">⚡</div>
                    <div class="stat-label">Longest Streak</div>
                    <div class="stat-value">${longestStreak} days</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">⭐</div>
                    <div class="stat-label">Bookmarks</div>
                    <div class="stat-value">${Object.keys(this.getBookmarks()).length}</div>
                </div>
            </div>
            
            <div class="stats-progress">
                <h3>Progress Through Gita</h3>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${readPercentage}%"></div>
                </div>
                <p class="progress-text">${readPercentage}% complete (${stats.versesRead || 0}/700 verses)</p>
            </div>
            
            <div class="reading-history">
                <h3>📅 Reading Activity (Last 7 Days)</h3>
                <div class="history-list">
                    ${stats.readingHistory && stats.readingHistory.length > 0 ? 
                        stats.readingHistory.slice(-7).reverse().map(entry => `
                            <div class="history-item">
                                <span class="history-date">${new Date(entry.date).toLocaleDateString()}</span>
                                <span class="history-count">${entry.count} verse${entry.count > 1 ? 's' : ''}</span>
                            </div>
                        `).join('') : 
                        '<p class="empty-message">No reading history yet. Start reading to track your progress!</p>'
                    }
                </div>
            </div>
        `;
    }

    // ===== READING PLANS =====
    initializeReadingPlans() {
        const defaultPlans = {
            'one-verse-daily': {
                id: 'one-verse-daily',
                name: '1 Verse Daily',
                description: 'One verse every day',
                emoji: '📖',
                duration: 700,
                totalVerses: 700,
                dailyVersesRequired: 1,
                completed: false,
                difficulty: 'Easy',
                color: '#3498db'
            },
            'seven-verses-weekly': {
                id: 'seven-verses-weekly',
                name: 'Weekly Wisdom',
                description: '7 verses per week',
                emoji: '📚',
                duration: 100,
                totalVerses: 700,
                dailyVersesRequired: 1,
                completed: false,
                difficulty: 'Easy',
                color: '#2ecc71'
            },
            'one-chapter-weekly': {
                id: 'one-chapter-weekly',
                name: 'Chapter a Week',
                description: 'Complete one chapter weekly',
                emoji: '📕',
                duration: 18,
                totalVerses: 700,
                dailyVersesRequired: 39,
                completed: false,
                difficulty: 'Medium',
                color: '#f39c12'
            },
            'gita-18days': {
                id: 'gita-18days',
                name: 'Complete in 18 Days',
                description: 'One chapter daily',
                emoji: '⚡',
                duration: 18,
                totalVerses: 700,
                dailyVersesRequired: 39,
                completed: false,
                difficulty: 'Hard',
                color: '#e74c3c'
            },
            'intensive-week': {
                id: 'intensive-week',
                name: 'Intensive Week',
                description: '100 verses in 7 days',
                emoji: '🔥',
                duration: 7,
                totalVerses: 100,
                dailyVersesRequired: 14,
                completed: false,
                difficulty: 'Expert',
                color: '#c0392b'
            },
            'one-chapter-monthly': {
                id: 'one-chapter-monthly',
                name: 'Monthly Journey',
                description: 'One chapter every month',
                emoji: '🌙',
                duration: 18,
                totalVerses: 700,
                dailyVersesRequired: 1,
                completed: false,
                difficulty: 'Very Easy',
                color: '#9b59b6'
            }
        };
        
        if (Object.keys(this.readingPlans).length === 0) {
            this.readingPlans = defaultPlans;
            localStorage.setItem('readingPlans', JSON.stringify(this.readingPlans));
        }
    }

    async showReadingPlans() {
        this.showView('readingPlans');
        const container = document.getElementById('readingPlansContent');
        
        container.innerHTML = `
            <div class="plans-grid">
                ${Object.values(this.readingPlans).map(plan => `
                    <div class="plan-card">
                        <div class="plan-emoji">${plan.emoji}</div>
                        <h4 class="plan-name">${plan.name}</h4>
                        <p class="plan-description">${plan.description}</p>
                        <div class="plan-meta">
                            <span class="meta-item">
                                <span class="meta-label">Duration</span>
                                <span class="meta-value">${plan.duration} days</span>
                            </span>
                            <span class="meta-item">
                                <span class="meta-label">Difficulty</span>
                                <span class="meta-difficulty" style="background-color: ${plan.color}20; color: ${plan.color};">
                                    ${plan.difficulty}
                                </span>
                            </span>
                        </div>
                        <div class="plan-actions">
                            ${this.activeReadingPlan === plan.id ? 
                                `<button class="plan-btn active">✅ Active</button>` :
                                `<button class="plan-btn" onclick="app.startReadingPlan('${plan.id}')">Start</button>`
                            }
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    
        // Load badges below
        this.loadBadges();
    }

    startReadingPlan(planId) {
        this.activeReadingPlan = planId;
        localStorage.setItem('activeReadingPlan', planId);
        this.showToast(`✅ Started "${this.readingPlans[planId].name}"`);
        this.showReadingPlans();
    }

    // ===== CHALLENGES & BADGES =====
    initializeChallenges() {
        const defaultChallenges = [
            {
                id: 'first-verse',
                name: 'First Verse',
                description: 'Read your first verse',
                badge: '🌟',
                condition: () => this.readingStats.versesRead >= 1,
                reward: 10
            },
            {
                id: 'ten-verses',
                name: 'Verse Seeker',
                description: 'Read 10 verses',
                badge: '📚',
                condition: () => this.readingStats.versesRead >= 10,
                reward: 20
            },
            {
                id: 'fifty-verses',
                name: 'Wisdom Collector',
                description: 'Read 50 verses',
                badge: '🧠',
                condition: () => this.readingStats.versesRead >= 50,
                reward: 50
            },
            {
                id: 'chapter-complete',
                name: 'Chapter Master',
                description: 'Complete a full chapter',
                badge: '👑',
                condition: () => this.readingStats.versesRead >= 47,
                reward: 100
            },
            {
                id: 'full-gita',
                name: 'Gita Master',
                description: 'Read all 700 verses',
                badge: '🏆',
                condition: () => this.readingStats.versesRead >= 700,
                reward: 500
            },
            {
                id: 'seven-day-streak',
                name: 'Dedicated Reader',
                description: 'Read for 7 consecutive days',
                badge: '🔥',
                condition: () => this.readingStats.currentStreak >= 7,
                reward: 75
            },
            {
                id: 'bookmarks-10',
                name: 'Bookmark Master',
                description: 'Bookmark 10 verses',
                badge: '⭐',
                condition: () => Object.keys(this.getBookmarks()).length >= 10,
                reward: 30
            },
            {
                id: 'note-taker',
                name: 'Note Taker',
                description: 'Add a note to a bookmark',
                badge: '📝',
                condition: () => Object.keys(this.bookmarkNotes).length >= 1,
                reward: 15
            }
        ];
        
        defaultChallenges.forEach(challenge => {
            if (!this.challenges.completed.includes(challenge.id) && !this.challenges.inProgress.includes(challenge.id)) {
                this.challenges.inProgress.push(challenge.id);
            }
        });
        
        localStorage.setItem('challenges', JSON.stringify(this.challenges));
    }

    checkChallengeProgress() {
        const allChallenges = [
            {
                id: 'first-verse',
                condition: () => this.readingStats.versesRead >= 1
            },
            {
                id: 'ten-verses',
                condition: () => this.readingStats.versesRead >= 10
            },
            {
                id: 'fifty-verses',
                condition: () => this.readingStats.versesRead >= 50
            },
            {
                id: 'chapter-complete',
                condition: () => this.readingStats.versesRead >= 47
            },
            {
                id: 'full-gita',
                condition: () => this.readingStats.versesRead >= 700
            },
            {
                id: 'seven-day-streak',
                condition: () => this.readingStats.currentStreak >= 7
            },
            {
                id: 'bookmarks-10',
                condition: () => Object.keys(this.getBookmarks()).length >= 10
            },
            {
                id: 'note-taker',
                condition: () => Object.keys(this.bookmarkNotes).length >= 1
            }
        ];
        
        allChallenges.forEach(challenge => {
            if (!this.challenges.completed.includes(challenge.id) && challenge.condition()) {
                this.challenges.completed.push(challenge.id);
                const idx = this.challenges.inProgress.indexOf(challenge.id);
                if (idx > -1) {
                    this.challenges.inProgress.splice(idx, 1);
                }
                this.showToast(`🎉 Challenge completed: ${challenge.id}`);
            }
        });
        
        localStorage.setItem('challenges', JSON.stringify(this.challenges));
    }

    async showChallenges() {
        this.showView('readingPlans');
        document.getElementById('readingPlansContent').innerHTML = '';
        this.loadBadges();
    }
    
    async loadBadges() {
        const container = document.getElementById('challengesContent');
        
        const challengeData = [
            { id: 'first-verse', name: 'First Verse', badge: '🌟', desc: 'Read your first verse', points: 10 },
            { id: 'ten-verses', name: 'Verse Seeker', badge: '📚', desc: 'Read 10 verses', points: 20 },
            { id: 'fifty-verses', name: 'Wisdom Collector', badge: '🧠', desc: 'Read 50 verses', points: 50 },
            { id: 'chapter-complete', name: 'Chapter Master', badge: '👑', desc: 'Complete a chapter', points: 100 },
            { id: 'full-gita', name: 'Gita Master', badge: '🏆', desc: 'Read all 700 verses', points: 500 },
            { id: 'seven-day-streak', name: 'Dedicated', badge: '🔥', desc: '7 day streak', points: 75 },
            { id: 'bookmarks-10', name: 'Bookmarker', badge: '⭐', desc: '10 bookmarks', points: 30 },
            { id: 'note-taker', name: 'Note Taker', badge: '📝', desc: 'Add a note', points: 15 }
        ];
        
        const completedBadges = challengeData.filter(c => this.challenges.completed.includes(c.id));
        const inProgressBadges = challengeData.filter(c => this.challenges.inProgress.includes(c.id));
        
        let html = '';
        
        // Completed Badges
        if (completedBadges.length > 0) {
            html += `
                <div class="badges-group">
                    <h4 class="badges-group-title">✅ Completed</h4>
                    <div class="badges-grid">
                        ${completedBadges.map(b => `
                            <div class="badge-item completed" title="${b.desc}" onclick="app.showBadgeShare('${b.badge}', '${b.name}', '${b.desc}', ${b.points})">
                                <div class="badge-emoji">${b.badge}</div>
                                <div class="badge-name">${b.name}</div>
                                <div class="badge-points">+${b.points} pts</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        // In Progress Badges
        if (inProgressBadges.length > 0) {
            html += `
                <div class="badges-group">
                    <h4 class="badges-group-title">🎯 In Progress</h4>
                    <div class="badges-grid">
                        ${inProgressBadges.map(b => `
                            <div class="badge-item" title="${b.desc}" style="cursor: default; opacity: 0.6;">
                                <div class="badge-emoji">${b.badge}</div>
                                <div class="badge-name">${b.name}</div>
                                <div class="badge-points">+${b.points} pts</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        if (html === '') {
            html = '<p class="empty-message">Complete challenges to earn badges! 🎉</p>';
        }
        
        container.innerHTML = html;
    }

    // ===== BADGE SHARING =====
    showBadgeShare(emoji, name, desc, points) {
        document.getElementById('badgeShareEmoji').textContent = emoji;
        document.getElementById('badgeShareName').textContent = name;
        document.getElementById('badgeShareDesc').textContent = desc;
        document.getElementById('badgeSharePoints').textContent = `+${points} points`;
        document.getElementById('badgeShareModal').classList.add('show');
    }
    
    closeBadgeShare() {
        document.getElementById('badgeShareModal').classList.remove('show');
    }
    
    async downloadBadgeImage() {
        const badgeCard = document.getElementById('badgeShareCard');
        try {
            const canvas = await html2canvas(badgeCard, {
                backgroundColor: null,
                scale: 2
            });
            
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `gita-badge-${document.getElementById('badgeShareName').textContent.replace(/\s+/g, '-').toLowerCase()}.png`;
            link.click();
            
            this.showToast('📥 Badge downloaded!');
        } catch (error) {
            console.error('Error downloading badge:', error);
            this.showToast('❌ Error downloading badge');
        }
    }
    
    async shareBadgeImage() {
        const badgeCard = document.getElementById('badgeShareCard');
        try {
            const canvas = await html2canvas(badgeCard, {
                backgroundColor: null,
                scale: 2
            });
            
            canvas.toBlob(async (blob) => {
                if (navigator.share && navigator.canShare({ files: [new File([blob], 'badge.png', { type: 'image/png' })] })) {
                    const file = new File([blob], 'badge.png', { type: 'image/png' });
                    navigator.share({
                        files: [file],
                        title: 'My Bhagavad Gita Achievement',
                        text: 'I just earned a badge! Download the Bhagavad Gita app: https://bit.ly/sb-gita'
                    });
                } else {
                    this.showToast('📋 Download and share manually');
                }
            });
        } catch (error) {
            console.error('Error sharing badge:', error);
            this.showToast('❌ Error sharing badge');
        }
    }

    // ===== NOTIFICATIONS =====
    scheduleNotifications() {
        if (!('Notification' in window)) {
            console.log('This browser does not support notifications');
            return;
        }
        
        if (Notification.permission === 'granted') {
            this.setupDailyNotification();
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    this.setupDailyNotification();
                }
            });
        }
    }

    setupDailyNotification() {
        const notificationTime = 8; // 8 AM
        const now = new Date();
        const scheduledTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), notificationTime, 0, 0);
        
        if (now > scheduledTime) {
            scheduledTime.setDate(scheduledTime.getDate() + 1);
        }
        
        const timeUntilNotification = scheduledTime - now;
        
        setTimeout(() => {
            this.sendDailyNotification();
            setInterval(() => {
                this.sendDailyNotification();
            }, 24 * 60 * 60 * 1000);
        }, timeUntilNotification);
    }

    async sendDailyNotification() {
        if (this.dailyShlokaInfo) {
            const chapter = await this.loadChapter(this.dailyShlokaInfo.chapter);
            const shloka = chapter.shlokas.find(s => s.verse === this.dailyShlokaInfo.verse);
            
            if (shloka) {
                const notification = new Notification('📖 Today\'s Verse - Bhagavad Gita', {
                    body: shloka.translation.substring(0, 100) + '...',
                    icon: 'icon-192.png',
                    badge: 'icon-monochrome.png'
                });
                
                notification.onclick = () => {
                    window.focus();
                    this.showShloka(this.dailyShlokaInfo.chapter, this.dailyShlokaInfo.verse, true);
                };
            }
        }
    }

    // Reading Settings
    async showReadingSettings() {
        this.showView('readingSettings');
        
        const speedRange = document.getElementById('speedRange');
        const speedValue = document.getElementById('speedValue');
        if (speedRange && speedValue) {
            speedRange.value = this.readingSpeed;
            speedValue.textContent = this.readingSpeed + 'x';
        }
        
        document.getElementById('readSanskrit').checked = this.readingPreferences.readSanskrit;
        document.getElementById('readTranslation').checked = this.readingPreferences.readTranslation;
        document.getElementById('readExplanation').checked = this.readingPreferences.readExplanation;
        
        // Initialize voice selection
        this.initializeVoiceSettings();
    }

    async loadVoices() {
        return new Promise((resolve) => {
            let voices = this.speechSynthesis.getVoices();
            
            if (voices.length > 0) {
                this.populateVoiceList(voices);
                resolve();
            } else {
                this.speechSynthesis.onvoiceschanged = () => {
                    voices = this.speechSynthesis.getVoices();
                    this.populateVoiceList(voices);
                    resolve();
                };
            }
        });
    }

    populateVoiceList(voices) {
        const voiceSelect = document.getElementById('voiceSelect');
        if (!voiceSelect) return;
        
        voiceSelect.innerHTML = '<option value="">Default Voice</option>';
        
        const hindiVoices = voices.filter(v => v.lang.startsWith('hi'));
        const englishVoices = voices.filter(v => v.lang.startsWith('en'));
        const otherVoices = voices.filter(v => !v.lang.startsWith('hi') && !v.lang.startsWith('en'));
        
        const addVoiceGroup = (groupVoices, label) => {
            if (groupVoices.length > 0) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = label;
                groupVoices.forEach(voice => {
                    const option = document.createElement('option');
                    option.value = voice.name;
                    option.textContent = `${voice.name} (${voice.lang})`;
                    if (voice.name === this.selectedVoice) {
                        option.selected = true;
                    }
                    optgroup.appendChild(option);
                });
                voiceSelect.appendChild(optgroup);
            }
        };
        
        addVoiceGroup(hindiVoices, 'Hindi Voices');
        addVoiceGroup(englishVoices, 'English Voices');
        addVoiceGroup(otherVoices, 'Other Languages');
    }

    saveVoicePreference() {
        const voiceSelect = document.getElementById('voiceSelect');
        if (voiceSelect) {
            this.selectedVoice = voiceSelect.value || null;
            localStorage.setItem('selectedVoice', this.selectedVoice || '');
            this.showToast('✅ Voice preference saved');
        }
    }

    updateSpeedDisplay(value) {
        const speedValue = document.getElementById('speedValue');
        if (speedValue) {
            speedValue.textContent = parseFloat(value).toFixed(1) + 'x';
        }
    }

    saveSpeedPreference(value) {
        this.readingSpeed = parseFloat(value);
        localStorage.setItem('readingSpeed', this.readingSpeed);
        this.showToast('✅ Speed preference saved');
    }

    setSpeed(speed) {
        const speedRange = document.getElementById('speedRange');
        const speedValue = document.getElementById('speedValue');
        if (speedRange && speedValue) {
            speedRange.value = speed;
            speedValue.textContent = speed + 'x';
            this.saveSpeedPreference(speed);
        }
    }

    saveReadingPreferences() {
        this.readingPreferences = {
            readSanskrit: document.getElementById('readSanskrit').checked,
            readTranslation: document.getElementById('readTranslation').checked,
            readExplanation: document.getElementById('readExplanation').checked
        };
        localStorage.setItem('readingPreferences', JSON.stringify(this.readingPreferences));
        this.showToast('✅ Reading preferences saved');
    }

    testVoice() {
        const voiceName = this.selectedVoice === 'vyasa' ? 'Vyasa' : 'Gargi';
        const greeting = this.selectedVoice === 'vyasa' 
            ? `Namaste. I am Vyasa, the ancient sage. Welcome to explore the eternal teachings of the Bhagavad Gita. Let us begin our journey together.`
            : `Namaste. I am Gargi, the revered scholar. Welcome to the wisdom of the Bhagavad Gita. Let us explore its profound teachings together.`;
        
        // Use Web Speech API
        if ('speechSynthesis' in window) {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(greeting);
            
            // Select voice based on choice
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                if (this.selectedVoice === 'vyasa') {
                    // Male voice - prefer Indian English, then US English
                    const maleVoice = voices.find(v => 
                        // US English male voices
                        v.name.includes('Google US English') ||
                        v.name.includes('Daniel') ||
                        v.name.includes('Aaron') ||
                        v.name.includes('Arthur') ||
                        (v.lang === 'en-US' && (v.name.includes('Male') || v.name.includes('male')))
                    );
                    if (maleVoice) utterance.voice = maleVoice;
                } else {
                    // Female voice - prefer Indian English, then US English
                    const femaleVoice = voices.find(v => 
                        // Indian English female voices
                        (v.lang === 'en-IN' && v.name.includes('Female')) ||
                        (v.lang === 'en-IN' && (v.name.includes('Wavenet') || v.name.includes('Neural'))) ||
                        // US English female voices
                        v.name.includes('Google US English') ||
                        v.name.includes('Victoria') ||
                        v.name.includes('Samantha') ||
                        v.name.includes('Moira') ||
                        (v.lang === 'en-US' && (v.name.includes('Female') || v.name.includes('female')))
                    );
                    if (femaleVoice) utterance.voice = femaleVoice;
                }
            }
            
            utterance.rate = parseFloat(document.getElementById('speedRange').value);
            // VYASA (Male) = Deep voice, GARGI (Female) = High voice
            utterance.pitch = this.selectedVoice === 'vyasa' ? 0.8 : 1.2;
            utterance.volume = 1;
            
            window.speechSynthesis.speak(utterance);
            this.showToast(`🔊 Testing ${voiceName}'s voice...`);
        } else {
            this.showToast('❌ Speech synthesis not supported');
        }
    }
    
    // ===== READING SETTINGS - VOICE SELECTION =====
    selectVoice(voice) {
        this.selectedVoice = voice;
        localStorage.setItem('selectedVoice', voice);
        
        // Update UI
        document.getElementById('voice-vyasa').classList.toggle('active', voice === 'vyasa');
        document.getElementById('voice-gargi').classList.toggle('active', voice === 'gargi');
        document.getElementById('voiceNameDisplay').textContent = voice === 'vyasa' ? 'Vyasa' : 'Gargi';
        
        this.showToast(`✅ Voice changed to ${voice === 'vyasa' ? 'Vyasa' : 'Gargi'}`);
    }
    
    initializeVoiceSettings() {
        const savedVoice = localStorage.getItem('selectedVoice') || 'vyasa';
        this.selectVoice(savedVoice);
    }

    // Refresh Data
    showRefreshConfirmation() {
        const modalBody = document.getElementById('personaModalBody');
        modalBody.innerHTML = `
            <div class="refresh-warning">
                <div class="warning-icon">⚠️</div>
                <h4>Refresh Data?</h4>
                <p class="warning-message">
                    Your data will be refreshed and your progress will be reset. This will clear:
                </p>
                <ul class="warning-list">
                    <li>📖 Continue Reading progress</li>
                    <li>⭐ All bookmarks & notes</li>
                    <li>📊 Statistics & reading history</li>
                    <li>🎯 Challenges & reading plans</li>
                    <li>💾 Cached chapters</li>
                </ul>
                <p class="warning-note">
                    <strong>Note:</strong> Your theme preference and explanation style will be preserved.
                </p>
                <p class="warning-question">Do you want to continue?</p>
            </div>
        `;
        
        document.getElementById('personaModal').classList.add('show');
        
        const cancelBtn = document.querySelector('.btn-secondary');
        const confirmBtn = document.querySelector('.btn-primary');
        
        const originalCancelHandler = cancelBtn.onclick;
        const originalConfirmHandler = confirmBtn.onclick;
        
        cancelBtn.textContent = 'Go Back';
        confirmBtn.textContent = 'Continue';
        
        cancelBtn.onclick = () => {
            this.closeRefreshConfirmation();
            cancelBtn.textContent = 'Cancel';
            confirmBtn.textContent = 'Confirm';
            cancelBtn.onclick = originalCancelHandler;
            confirmBtn.onclick = originalConfirmHandler;
        };
        
        confirmBtn.onclick = () => {
            this.closeRefreshConfirmation();
            this.refreshData();
            cancelBtn.textContent = 'Cancel';
            confirmBtn.textContent = 'Confirm';
            cancelBtn.onclick = originalCancelHandler;
            confirmBtn.onclick = originalConfirmHandler;
        };
    }

    closeRefreshConfirmation() {
        document.getElementById('personaModal').classList.remove('show');
    }

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
            localStorage.clear();
            this.theme = currentTheme;
            this.flavor = currentFlavor;
            localStorage.setItem('theme', this.theme);
            localStorage.setItem('flavor', this.flavor);
            
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

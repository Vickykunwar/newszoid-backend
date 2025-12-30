// ============================================================
// COMPLETE AUTHENTICATION SYSTEM
// Handles login, registration, logout, and session management
// ============================================================

class AuthManager {
    constructor() {
        this.apiURL = '/api/auth';
        this.currentUser = null;
        this.token = null;
        this.init();
    }

    async init() {
        // Check if user is already logged in
        await this.checkSession();
        this.setupEventListeners();
        this.updateUI();
    }

    // ============================================================
    // SESSION MANAGEMENT
    // ============================================================
    async checkSession() {
        try {
            const response = await fetch(`${this.apiURL}/me`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.ok && data.user) {
                    this.currentUser = data.user;
                    localStorage.setItem('newszoid_loggedInUser', data.user.name);
                    return true;
                }
            }
        } catch (error) {
            console.warn('Session check failed:', error);
        }
        
        this.currentUser = null;
        localStorage.removeItem('newszoid_loggedInUser');
        return false;
    }

    isLoggedIn() {
        return !!this.currentUser;
    }

    getUser() {
        return this.currentUser;
    }

    // ============================================================
    // AUTHENTICATION METHODS
    // ============================================================
    async login(email, password) {
        if (!email || !password) {
            throw new Error('Email and password are required');
        }

        try {
            const response = await fetch(`${this.apiURL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            if (data.ok && data.user) {
                this.currentUser = data.user;
                localStorage.setItem('newszoid_loggedInUser', data.user.name);
                this.updateUI();
                
                // Trigger event for other components
                window.dispatchEvent(new CustomEvent('user-logged-in', { 
                    detail: { user: data.user } 
                }));

                return { success: true, user: data.user };
            }

            throw new Error('Invalid response from server');

        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    async register(name, email, password) {
        if (!name || !email || !password) {
            throw new Error('All fields are required');
        }

        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }

        try {
            const response = await fetch(`${this.apiURL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            if (data.ok && data.user) {
                this.currentUser = data.user;
                localStorage.setItem('newszoid_loggedInUser', data.user.name);
                this.updateUI();
                
                window.dispatchEvent(new CustomEvent('user-registered', { 
                    detail: { user: data.user } 
                }));

                return { success: true, user: data.user };
            }

            throw new Error('Invalid response from server');

        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }

    async logout() {
        try {
            await fetch(`${this.apiURL}/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.warn('Logout request failed:', error);
        }

        // Clear local state
        this.currentUser = null;
        localStorage.removeItem('newszoid_loggedInUser');
        this.updateUI();
        
        window.dispatchEvent(new CustomEvent('user-logged-out'));
        
        // Redirect to home
        window.location.href = '/';
    }

    // ============================================================
    // UI MANAGEMENT
    // ============================================================
    updateUI() {
        const userNameEl = document.getElementById('userName');
        const userInfoEl = document.getElementById('userInfo');
        const loginBtn = document.getElementById('loginBtn');

        if (this.isLoggedIn()) {
            // Show user info
            if (userNameEl) userNameEl.textContent = this.currentUser.name;
            if (userInfoEl) userInfoEl.style.display = 'flex';
            if (loginBtn) loginBtn.style.display = 'none';
        } else {
            // Show login button
            if (userInfoEl) userInfoEl.style.display = 'none';
            if (loginBtn) loginBtn.style.display = 'block';
        }
    }

    // ============================================================
    // EVENT LISTENERS
    // ============================================================
    setupEventListeners() {
        // Login button
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.openLoginModal());
        }

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLoginSubmit(e));
        }

        // Register form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegisterSubmit(e));
        }

        // Modal switches
        const showRegisterLink = document.getElementById('showRegisterLink');
        const showLoginLink = document.getElementById('showLoginLink');
        
        if (showRegisterLink) {
            showRegisterLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchToRegister();
            });
        }

        if (showLoginLink) {
            showLoginLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchToLogin();
            });
        }

        // Close modals
        document.querySelectorAll('.modal .close').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });

        // Close on background click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModals();
            }
        });

        // Social login buttons (placeholder - implement OAuth later)
        this.setupSocialLogin();
    }

    // ============================================================
    // FORM HANDLERS
    // ============================================================
    async handleLoginSubmit(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail')?.value.trim();
        const password = document.getElementById('loginPassword')?.value;
        const submitBtn = e.target.querySelector('button[type="submit"]');

        if (!email || !password) {
            this.showToast('Please enter email and password', 'error');
            return;
        }

        try {
            // Disable button
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Logging in...';
            }

            const result = await this.login(email, password);

            if (result.success) {
                this.showToast('Login successful!', 'success');
                this.closeModals();
                
                // Reset form
                e.target.reset();
            }

        } catch (error) {
            this.showToast(error.message || 'Login failed', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
            }
        }
    }

    async handleRegisterSubmit(e) {
        e.preventDefault();
        
        const name = document.getElementById('registerName')?.value.trim();
        const email = document.getElementById('registerEmail')?.value.trim();
        const password = document.getElementById('registerPassword')?.value;
        const confirmPassword = document.getElementById('registerConfirmPassword')?.value;
        const submitBtn = e.target.querySelector('button[type="submit"]');

        // Validation
        if (!name || !email || !password || !confirmPassword) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showToast('Passwords do not match', 'error');
            return;
        }

        if (password.length < 6) {
            this.showToast('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            // Disable button
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Registering...';
            }

            const result = await this.register(name, email, password);

            if (result.success) {
                this.showToast('Registration successful! Welcome!', 'success');
                this.closeModals();
                
                // Reset form
                e.target.reset();
            }

        } catch (error) {
            this.showToast(error.message || 'Registration failed', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Register';
            }
        }
    }

    async handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            try {
                await this.logout();
                this.showToast('Logged out successfully', 'success');
            } catch (error) {
                this.showToast('Logout failed', 'error');
            }
        }
    }

    // ============================================================
    // MODAL MANAGEMENT
    // ============================================================
    openLoginModal() {
        const modal = document.getElementById('loginModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.setAttribute('aria-hidden', 'false');
            
            // Focus first input
            setTimeout(() => {
                const firstInput = modal.querySelector('input');
                if (firstInput) firstInput.focus();
            }, 100);
        }
    }

    openRegisterModal() {
        const modal = document.getElementById('registerModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.setAttribute('aria-hidden', 'false');
            
            setTimeout(() => {
                const firstInput = modal.querySelector('input');
                if (firstInput) firstInput.focus();
            }, 100);
        }
    }

    switchToRegister() {
        this.closeModals();
        this.openRegisterModal();
    }

    switchToLogin() {
        this.closeModals();
        this.openLoginModal();
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
            
            // Reset forms
            const form = modal.querySelector('form');
            if (form) form.reset();
        });
    }

    // ============================================================
    // SOCIAL LOGIN (Placeholder)
    // ============================================================
    setupSocialLogin() {
        // Google login
        const googleBtn = document.querySelector('.google-login');
        if (googleBtn) {
            googleBtn.addEventListener('click', () => {
                this.showToast('Google login coming soon!', 'info');
                // TODO: Implement OAuth flow
                // window.location.href = '/api/auth/google';
            });
        }

        // Microsoft login
        const microsoftBtn = document.querySelector('.microsoft-login');
        if (microsoftBtn) {
            microsoftBtn.addEventListener('click', () => {
                this.showToast('Microsoft login coming soon!', 'info');
                // window.location.href = '/api/auth/microsoft';
            });
        }

        // Facebook login
        const facebookBtn = document.querySelector('.facebook-login');
        if (facebookBtn) {
            facebookBtn.addEventListener('click', () => {
                this.showToast('Facebook login coming soon!', 'info');
                // window.location.href = '/api/auth/facebook';
            });
        }
    }

    // ============================================================
    // UTILITIES
    // ============================================================
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');
        
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 16px 24px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            animation: slideInUp 0.3s ease-out;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// ============================================================
// INITIALIZE AUTH MANAGER
// ============================================================
const authManager = new AuthManager();

// Export for global access
window.authManager = authManager;
window.AuthClient = authManager; // For compatibility with existing code

// ============================================================
// PROTECTED ROUTE HELPER
// ============================================================
function requireAuth(callback) {
    if (!authManager.isLoggedIn()) {
        authManager.showToast('Please login to continue', 'warning');
        authManager.openLoginModal();
        return false;
    }
    callback();
    return true;
}

window.requireAuth = requireAuth;

console.log('✅ Auth Manager initialized');
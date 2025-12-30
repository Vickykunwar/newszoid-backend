(function () {
    'use strict';

    // ============================================================
    // INDIAN CITIES DATABASE
    // ============================================================
    const INDIAN_CITIES = [
        // Major Metro Cities
        { name: 'Delhi', state: 'Delhi', lat: 28.7041, lon: 77.1025 },
        { name: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lon: 72.8777 },
        { name: 'Bangalore', state: 'Karnataka', lat: 12.9716, lon: 77.5946 },
        { name: 'Hyderabad', state: 'Telangana', lat: 17.3850, lon: 78.4867 },
        { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lon: 80.2707 },
        { name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lon: 88.3639 },

        // Tier-1 Cities
        { name: 'Pune', state: 'Maharashtra', lat: 18.5204, lon: 73.8567 },
        { name: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lon: 72.5714 },
        { name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lon: 75.7873 },
        { name: 'Surat', state: 'Gujarat', lat: 21.1702, lon: 72.8311 },
        { name: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lon: 80.9462 },
        { name: 'Kanpur', state: 'Uttar Pradesh', lat: 26.4499, lon: 80.3319 },
        { name: 'Nagpur', state: 'Maharashtra', lat: 21.1458, lon: 79.0882 },
        { name: 'Indore', state: 'Madhya Pradesh', lat: 22.7196, lon: 75.8577 },
        { name: 'Thane', state: 'Maharashtra', lat: 19.2183, lon: 72.9781 },
        { name: 'Bhopal', state: 'Madhya Pradesh', lat: 23.2599, lon: 77.4126 },
        { name: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.6868, lon: 83.2185 },
        { name: 'Patna', state: 'Bihar', lat: 25.5941, lon: 85.1376 },

        // Other Important Cities
        { name: 'Vadodara', state: 'Gujarat', lat: 22.3072, lon: 73.1812 },
        { name: 'Ghaziabad', state: 'Uttar Pradesh', lat: 28.6692, lon: 77.4538 },
        { name: 'Ludhiana', state: 'Punjab', lat: 30.9010, lon: 75.8573 },
        { name: 'Agra', state: 'Uttar Pradesh', lat: 27.1767, lon: 78.0081 },
        { name: 'Nashik', state: 'Maharashtra', lat: 19.9975, lon: 73.7898 },
        { name: 'Faridabad', state: 'Haryana', lat: 28.4089, lon: 77.3178 },
        { name: 'Meerut', state: 'Uttar Pradesh', lat: 28.9845, lon: 77.7064 },
        { name: 'Rajkot', state: 'Gujarat', lat: 22.3039, lon: 70.8022 },
        { name: 'Varanasi', state: 'Uttar Pradesh', lat: 25.3176, lon: 82.9739 },
        { name: 'Amritsar', state: 'Punjab', lat: 31.6340, lon: 74.8723 },
        { name: 'Chandigarh', state: 'Chandigarh', lat: 30.7333, lon: 76.7794 },
        { name: 'Coimbatore', state: 'Tamil Nadu', lat: 11.0168, lon: 76.9558 },
        { name: 'Jodhpur', state: 'Rajasthan', lat: 26.2389, lon: 73.0243 },
        { name: 'Guwahati', state: 'Assam', lat: 26.1445, lon: 91.7362 },
        { name: 'Bhubaneswar', state: 'Odisha', lat: 20.2961, lon: 85.8245 },
        { name: 'Kochi', state: 'Kerala', lat: 9.9312, lon: 76.2673 },
        { name: 'Trivandrum', state: 'Kerala', lat: 8.5241, lon: 76.9366 }
    ];

    // ============================================================
    // GLOBAL STATE
    // ============================================================
    window.userLocation = { city: 'Delhi', lat: 28.7041, lon: 77.1025 };

    // ============================================================
    // INITIALIZE LOCATION SELECTOR
    // ============================================================
    function initLocationSelector() {
        // Get or create modal
        let modal = document.getElementById('locationModal');

        if (!modal) {
            // Create modal if it doesn't exist
            modal = createLocationModal();
            document.body.appendChild(modal);
        }

        // Populate cities
        populateCities();

        // Set up event listeners
        setupLocationEventListeners();

        // Load saved location
        loadSavedLocation();

        console.log('✅ Location selector initialized');
    }

    // ============================================================
    // CREATE LOCATION MODAL
    // ============================================================
    function createLocationModal() {
        const modal = document.createElement('div');
        modal.id = 'locationModal';
        modal.className = 'modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-labelledby', 'locationModalTitle');
        modal.setAttribute('aria-hidden', 'true');

        modal.innerHTML = `
      <div class="modal-content location-modal-content">
        <button class="close" aria-label="Close location modal">&times;</button>
        <h2 id="locationModalTitle">Select Your Location</h2>
        
        <div class="location-search">
          <input 
            type="text" 
            id="locationSearch" 
            placeholder="Search for your city..."
            autocomplete="off"
          >
          <div id="locationSuggestions" class="location-suggestions"></div>
        </div>
        
        <div class="popular-cities">
          <h3>Popular Cities</h3>
          <div class="cities-grid" id="popularCities"></div>
        </div>
        
        <button id="useCurrentLocationBtn" class="location-detect-btn">
          📍 Use Current Location
        </button>
      </div>
    `;

        return modal;
    }

    // ============================================================
    // POPULATE CITIES GRID
    // ============================================================
    function populateCities() {
        const container = document.getElementById('popularCities');
        if (!container) return;

        // Show top 12 cities
        const popularCities = INDIAN_CITIES.slice(0, 12);

        container.innerHTML = popularCities.map(city => `
      <button 
        class="city-btn" 
        data-city-name="${city.name}"
        data-city-lat="${city.lat}"
        data-city-lon="${city.lon}"
      >
        ${city.name}
      </button>
    `).join('');

        // Add click handlers
        container.querySelectorAll('.city-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cityName = btn.dataset.cityName;
                const lat = parseFloat(btn.dataset.cityLat);
                const lon = parseFloat(btn.dataset.cityLon);

                selectCity({ city: cityName, lat, lon });
            });
        });
    }

    // ============================================================
    // CITY SEARCH FUNCTIONALITY
    // ============================================================
    function setupCitySearch() {
        const searchInput = document.getElementById('locationSearch');
        const suggestions = document.getElementById('locationSuggestions');

        if (!searchInput || !suggestions) return;

        let searchTimeout;

        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim().toLowerCase();

            if (query.length < 2) {
                suggestions.innerHTML = '';
                suggestions.style.display = 'none';
                return;
            }

            searchTimeout = setTimeout(() => {
                const matches = INDIAN_CITIES.filter(city =>
                    city.name.toLowerCase().includes(query) ||
                    city.state.toLowerCase().includes(query)
                ).slice(0, 8);

                if (matches.length === 0) {
                    suggestions.innerHTML = '<div class="suggestion-item no-results">No cities found</div>';
                    suggestions.style.display = 'block';
                    return;
                }

                suggestions.innerHTML = matches.map(city => `
          <div 
            class="suggestion-item" 
            data-city-name="${city.name}"
            data-city-lat="${city.lat}"
            data-city-lon="${city.lon}"
            role="button"
            tabindex="0"
          >
            <strong>${city.name}</strong>, ${city.state}
          </div>
        `).join('');

                suggestions.style.display = 'block';

                // Add click handlers to suggestions
                suggestions.querySelectorAll('.suggestion-item').forEach(item => {
                    if (item.classList.contains('no-results')) return;

                    const selectCityFromSuggestion = () => {
                        const cityName = item.dataset.cityName;
                        const lat = parseFloat(item.dataset.cityLat);
                        const lon = parseFloat(item.dataset.cityLon);

                        selectCity({ city: cityName, lat, lon });
                        searchInput.value = '';
                        suggestions.style.display = 'none';
                    };

                    item.addEventListener('click', selectCityFromSuggestion);
                    item.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            selectCityFromSuggestion();
                        }
                    });
                });
            }, 300);
        });

        // Close suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !suggestions.contains(e.target)) {
                suggestions.style.display = 'none';
            }
        });
    }

    // ============================================================
    // SELECT CITY
    // ============================================================
    function selectCity(location) {
        if (!location || !location.city) {
            console.error('Invalid location data');
            return;
        }

        // Save to localStorage
        const locationData = {
            city: location.city,
            lat: location.lat || 0,
            lon: location.lon || 0,
            timestamp: Date.now()
        };

        try {
            localStorage.setItem('newszoid_userLocation', JSON.stringify(locationData));
        } catch (e) {
            console.warn('Failed to save location', e);
        }

        // Expose globally
        window.userLocation = locationData;

        // Update AppState if available
        if (window.AppState) {
            window.AppState.location = locationData;
        }

        // Update UI
        updateLocationDisplay(location.city);

        // Reload location-based content
        reloadLocationContent(location.city);

        // Close modal
        const modal = document.getElementById('locationModal');
        if (modal) {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
        }

        // Show success message
        if (typeof window.showToast === 'function') {
            window.showToast(`Location changed to ${location.city}`, 'success');
        } else {
            console.log(`📍 Location changed to ${location.city}`);
        }

        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('locationChanged', {
            detail: locationData
        }));
    }

    // ============================================================
    // UPDATE LOCATION DISPLAY
    // ============================================================
    function updateLocationDisplay(cityName) {
        // Update all location displays
        const elements = [
            document.getElementById('currentLocation'),
            document.getElementById('localNewsBadge'),
            document.getElementById('weatherCity'),
            document.getElementById('weatherLocation')
        ];

        elements.forEach(el => {
            if (el) el.textContent = cityName;
        });

        // Update location badge in header
        const locationBadges = document.querySelectorAll('.location-badge');
        locationBadges.forEach(badge => {
            badge.textContent = cityName;
        });
    }

    // ============================================================
    // RELOAD LOCATION-BASED CONTENT
    // ============================================================
    function reloadLocationContent(cityName) {
        // Reload local news
        if (typeof window.loadLocalNews === 'function') {
            window.loadLocalNews(cityName);
        }

        // Reload weather
        if (typeof window.loadWeather === 'function') {
            window.loadWeather(cityName);
        }

        // Refresh main news if location-aware
        if (typeof window.fetchNews === 'function') {
            window.fetchNews(cityName);
        }
    }

    // ============================================================
    // LOAD SAVED LOCATION
    // ============================================================
    function loadSavedLocation() {
        try {
            const saved = localStorage.getItem('newszoid_userLocation');
            if (saved) {
                const location = JSON.parse(saved);
                if (location.city) {
                    window.userLocation = location;
                    updateLocationDisplay(location.city);
                }
            }
        } catch (e) {
            console.warn('Failed to load saved location', e);
        }
    }

    // ============================================================
    // GEOLOCATION (AUTO-DETECT)
    // ============================================================
    function detectCurrentLocation() {
        const btn = document.getElementById('useCurrentLocationBtn');

        if (!navigator.geolocation) {
            if (typeof window.showToast === 'function') {
                window.showToast('Geolocation not supported by your browser', 'error');
            }
            return;
        }

        if (btn) {
            btn.textContent = '🔄 Detecting...';
            btn.disabled = true;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                try {
                    // Reverse geocoding using Nominatim (free, no API key needed)
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
                    );

                    const data = await response.json();
                    const city = data.address.city ||
                        data.address.town ||
                        data.address.village ||
                        data.address.state_district ||
                        'Unknown Location';

                    selectCity({
                        city: city,
                        lat: latitude,
                        lon: longitude
                    });

                } catch (error) {
                    console.error('Geocoding error:', error);
                    if (typeof window.showToast === 'function') {
                        window.showToast('Unable to detect city name', 'error');
                    }
                } finally {
                    if (btn) {
                        btn.textContent = '📍 Use Current Location';
                        btn.disabled = false;
                    }
                }
            },
            (error) => {
                console.error('Geolocation error:', error);
                if (typeof window.showToast === 'function') {
                    window.showToast('Unable to access your location', 'error');
                }

                if (btn) {
                    btn.textContent = '📍 Use Current Location';
                    btn.disabled = false;
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    }

    // ============================================================
    // SETUP EVENT LISTENERS
    // ============================================================
    function setupLocationEventListeners() {
        // Change location button (in header)
        const changeLocationBtn = document.getElementById('changeLocationBtn');
        if (changeLocationBtn) {
            changeLocationBtn.addEventListener('click', openLocationModal);
        }

        // Alternative: sidebar location button
        const sidebarLocation = document.getElementById('sidebarLocation');
        if (sidebarLocation) {
            sidebarLocation.addEventListener('click', (e) => {
                e.preventDefault();
                openLocationModal();
                // Close sidebar
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('overlay');
                if (sidebar) sidebar.classList.remove('active');
                if (overlay) overlay.classList.remove('active');
            });
        }

        // Modal close button
        const modal = document.getElementById('locationModal');
        if (modal) {
            const closeBtn = modal.querySelector('.close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                    modal.setAttribute('aria-hidden', 'true');
                });
            }

            // Close on background click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                    modal.setAttribute('aria-hidden', 'true');
                }
            });
        }

        // Use current location button
        const useLocationBtn = document.getElementById('useCurrentLocationBtn');
        if (useLocationBtn) {
            useLocationBtn.addEventListener('click', detectCurrentLocation);
        }

        // Setup search
        setupCitySearch();

        // ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && modal.style.display === 'block') {
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
            }
        });
    }

    // ============================================================
    // OPEN LOCATION MODAL
    // ============================================================
    function openLocationModal() {
        const modal = document.getElementById('locationModal');
        if (modal) {
            modal.style.display = 'block';
            modal.setAttribute('aria-hidden', 'false');

            // Focus on search input
            setTimeout(() => {
                const searchInput = document.getElementById('locationSearch');
                if (searchInput) searchInput.focus();
            }, 100);
        }
    }

    // ============================================================
    // EXPOSE TO GLOBAL SCOPE
    // ============================================================
    window.openLocationModal = openLocationModal;
    window.selectCity = selectCity;

    // ============================================================
    // AUTO-INITIALIZE
    // ============================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLocationSelector);
    } else {
        initLocationSelector();
    }

})();

console.log('📍 Location selector module loaded');

// ============================================================================
// UTILITY.JS - Common Utility Functions
// ============================================================================

// ============================================================================
// DATE AND TIME UTILITIES
// ============================================================================
function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString();
}

function formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString();
}

function formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString();
}

function getRelativeTime(date) {
    if (!date) return '';
    
    const now = new Date();
    const diff = now - new Date(date);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    
    return formatDate(date);
}

function isToday(date) {
    if (!date) return false;
    const today = new Date();
    const d = new Date(date);
    return d.toDateString() === today.toDateString();
}

function isYesterday(date) {
    if (!date) return false;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const d = new Date(date);
    return d.toDateString() === yesterday.toDateString();
}

// ============================================================================
// STRING UTILITIES
// ============================================================================
function sanitizeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function truncateText(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function capitalizeWords(str) {
    if (!str) return '';
    return str.split(' ').map(word => capitalizeFirst(word)).join(' ');
}

function slugify(text) {
    if (!text) return '';
    return text
        .toString()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

// ============================================================================
// ID GENERATION UTILITIES
// ============================================================================
function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateMessageId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateUniqueId(prefix = 'id') {
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateShortId(length = 8) {
    return Math.random().toString(36).substr(2, length);
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================
function isValidEmail(email) {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPassword(password, minLength = 6) {
    if (!password) return false;
    return password.length >= minLength;
}

function isValidUrl(url) {
    if (!url) return false;
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

function isValidPhoneNumber(phone) {
    if (!phone) return false;
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

// ============================================================================
// ARRAY UTILITIES
// ============================================================================
function removeDuplicates(array, key = null) {
    if (!Array.isArray(array)) return [];
    
    if (key) {
        return array.filter((item, index, self) => 
            index === self.findIndex(t => t[key] === item[key])
        );
    }
    
    return [...new Set(array)];
}

function groupBy(array, key) {
    if (!Array.isArray(array)) return {};
    
    return array.reduce((groups, item) => {
        const group = item[key];
        if (!groups[group]) {
            groups[group] = [];
        }
        groups[group].push(item);
        return groups;
    }, {});
}

function sortBy(array, key, order = 'asc') {
    if (!Array.isArray(array)) return [];
    
    return array.sort((a, b) => {
        let aVal = key ? a[key] : a;
        let bVal = key ? b[key] : b;
        
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }
        
        if (order === 'desc') {
            return bVal > aVal ? 1 : -1;
        }
        return aVal > bVal ? 1 : -1;
    });
}

function chunk(array, size) {
    if (!Array.isArray(array) || size <= 0) return [];
    
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

// ============================================================================
// OBJECT UTILITIES
// ============================================================================
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
}

function mergeObjects(...objects) {
    return Object.assign({}, ...objects);
}

function deepMerge(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                deepMerge(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }

    return deepMerge(target, ...sources);
}

function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}

function isEmpty(obj) {
    if (obj == null) return true;
    if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
    return Object.keys(obj).length === 0;
}

// ============================================================================
// DOM UTILITIES
// ============================================================================
function createElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);
    
    Object.keys(attributes).forEach(key => {
        if (key === 'className') {
            element.className = attributes[key];
        } else if (key === 'innerHTML') {
            element.innerHTML = attributes[key];
        } else {
            element.setAttribute(key, attributes[key]);
        }
    });
    
    if (content) {
        element.textContent = content;
    }
    
    return element;
}

function removeElement(selector) {
    const element = typeof selector === 'string' ? 
        document.querySelector(selector) : selector;
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
    }
}

function toggleClass(element, className) {
    if (!element) return;
    element.classList.toggle(className);
}

function addClass(element, className) {
    if (!element) return;
    element.classList.add(className);
}

function removeClass(element, className) {
    if (!element) return;
    element.classList.remove(className);
}

function hasClass(element, className) {
    if (!element) return false;
    return element.classList.contains(className);
}

// ============================================================================
// EVENT UTILITIES
// ============================================================================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ============================================================================
// STORAGE UTILITIES (Memory-based for Claude.ai compatibility)
// ============================================================================
const memoryStorage = {};

function setMemoryItem(key, value) {
    memoryStorage[key] = JSON.stringify(value);
}

function getMemoryItem(key) {
    const item = memoryStorage[key];
    try {
        return item ? JSON.parse(item) : null;
    } catch {
        return item;
    }
}

function removeMemoryItem(key) {
    delete memoryStorage[key];
}

function clearMemoryStorage() {
    Object.keys(memoryStorage).forEach(key => {
        delete memoryStorage[key];
    });
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================
function handleError(error, context = 'Application') {
    console.error(`${context} Error:`, error);
    
    // You can extend this to send errors to a logging service
    return {
        message: error.message || 'An unexpected error occurred',
        stack: error.stack,
        context: context,
        timestamp: new Date().toISOString()
    };
}

function showNotification(message, type = 'info', duration = 3000) {
    // Create notification element
    const notification = createElement('div', {
        className: `notification notification-${type}`,
        innerHTML: message
    });
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after duration
    setTimeout(() => {
        removeElement(notification);
    }, duration);
}

// ============================================================================
// LOADING UTILITIES
// ============================================================================
function showLoading(element, text = 'Loading...') {
    if (!element) return;
    
    const spinner = createElement('div', {
        className: 'spinner',
        innerHTML: `<div class="loading-text">${text}</div>`
    });
    
    element.appendChild(spinner);
    return spinner;
}

function hideLoading(element) {
    if (!element) return;
    
    const spinner = element.querySelector('.spinner');
    if (spinner) {
        removeElement(spinner);
    }
}

// ============================================================================
// EXPORT FOR MODULE USAGE
// ============================================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Date utilities
        formatDate,
        formatTime,
        formatDateTime,
        getRelativeTime,
        isToday,
        isYesterday,
        
        // String utilities
        sanitizeHtml,
        escapeHtml,
        truncateText,
        capitalizeFirst,
        capitalizeWords,
        slugify,
        
        // ID generation
        generateUserId,
        generateMessageId,
        generateUniqueId,
        generateShortId,
        
        // Validation
        isValidEmail,
        isValidPassword,
        isValidUrl,
        isValidPhoneNumber,
        
        // Array utilities
        removeDuplicates,
        groupBy,
        sortBy,
        chunk,
        
        // Object utilities
        deepClone,
        mergeObjects,
        deepMerge,
        isObject,
        isEmpty,
        
        // DOM utilities
        createElement,
        removeElement,
        toggleClass,
        addClass,
        removeClass,
        hasClass,
        
        // Event utilities
        debounce,
        throttle,
        
        // Storage utilities
        setMemoryItem,
        getMemoryItem,
        removeMemoryItem,
        clearMemoryStorage,
        
        // Error handling
        handleError,
        showNotification,
        
        // Loading utilities
        showLoading,
        hideLoading
    };
}
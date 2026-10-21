// LocalStorage Key
const STORAGE_KEY = 'shortylink_urls_v1';

// App State
let links = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let activeRedirectLink = null;
let redirectInterval = null;

// DOM Elements
const shortenForm = document.getElementById('shorten-form');
const originalUrlInput = document.getElementById('original-url');
const customAliasInput = document.getElementById('custom-alias');
const expirationSelect = document.getElementById('expiration-select');

const linksTbody = document.getElementById('links-tbody');
const emptyState = document.getElementById('empty-state');

const statTotalLinks = document.getElementById('stat-total-links');
const statTotalClicks = document.getElementById('stat-total-clicks');
const statActiveLinks = document.getElementById('stat-active-links');

const searchInput = document.getElementById('search-input');
const themeToggle = document.getElementById('theme-toggle');

const redirectModal = document.getElementById('redirect-modal');
const modalTargetUrl = document.getElementById('modal-target-url');
const countdownTimer = document.getElementById('countdown-timer');
const cancelRedirectBtn = document.getElementById('cancel-redirect-btn');
const confirmRedirectBtn = document.getElementById('confirm-redirect-btn');

const qrModal = document.getElementById('qr-modal');
const qrcodeContainer = document.getElementById('qrcode-container');
const qrLinkText = document.getElementById('qr-link-text');
const closeQrBtn = document.getElementById('close-qr-btn');

// --- Theme Initialization ---
if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
} else {
    document.documentElement.classList.remove('dark');
}

themeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
});

// --- Toast Notifications ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    const colors = {
        success: 'bg-emerald-600 text-white',
        error: 'bg-red-600 text-white',
        info: 'bg-brand-600 text-white'
    };

    toast.className = `px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transform transition-all duration-300 translate-y-2 opacity-0 ${colors[type] || colors.info}`;
    toast.innerHTML = `<span>${message}</span>`;
    
    container.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- Helper Functions ---
function generateSlug(length = 6) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function calculateExpiration(option) {
    if (option === 'never') return null;
    const now = Date.now();
    const map = {
        '1m': 60 * 1000,
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000
    };
    return now + (map[option] || 0);
}

function isExpired(link) {
    return link.expiresAt && Date.now() > link.expiresAt;
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
    render();
}

// --- Render Table & Stats ---
function render() {
    const query = searchInput.value.toLowerCase();
    const filteredLinks = links.filter(l => l.slug.toLowerCase().includes(query) || l.originalUrl.toLowerCase().includes(query));

    // Stats
    const totalLinks = links.length;
    const totalClicks = links.reduce((sum, l) => sum + l.clicks, 0);
    const activeLinks = links.filter(l => !isExpired(l)).length;

    statTotalLinks.textContent = totalLinks;
    statTotalClicks.textContent = totalClicks;
    statActiveLinks.textContent = activeLinks;

    // Table
    linksTbody.innerHTML = '';
    if (filteredLinks.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        filteredLinks.forEach(link => {
            const expired = isExpired(link);
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition';

            tr.innerHTML = `
                <td class="py-3.5 px-4 font-mono font-medium text-brand-600 dark:text-brand-400">
                    <button onclick="handleLinkClick('${link.id}')" class="hover:underline flex items-center gap-1.5 ${expired ? 'line-through text-gray-400' : ''}">
                        shorty.link/${link.slug}
                        <i class="fa-solid fa-arrow-up-right-from-square text-xs opacity-70"></i>
                    </button>
                </td>
                <td class="py-3.5 px-4 max-w-xs truncate text-gray-500 dark:text-gray-400" title="${link.originalUrl}">
                    ${link.originalUrl}
                </td>
                <td class="py-3.5 px-4 font-semibold">${link.clicks}</td>
                <td class="py-3.5 px-4 text-xs">
                    ${expired 
                        ? '<span class="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-md font-medium">Expired</span>' 
                        : (link.expiresAt ? new Date(link.expiresAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '<span class="text-gray-400">Never</span>')
                    }
                </td>
                <td class="py-3.5 px-4 text-right space-x-2">
                    <button onclick="copyToClipboard('https://shorty.link/${link.slug}')" class="p-1.5 text-gray-500 hover:text-brand-600 transition" title="Copy Short Link">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                    <button onclick="openQrModal('${link.slug}')" class="p-1.5 text-gray-500 hover:text-brand-600 transition" title="QR Code">
                        <i class="fa-solid fa-qrcode"></i>
                    </button>
                    <button onclick="deleteLink('${link.id}')" class="p-1.5 text-gray-500 hover:text-red-600 transition" title="Delete">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </td>
            `;
            linksTbody.appendChild(tr);
        });
    }
}

// --- Create Short Link ---
shortenForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const originalUrl = originalUrlInput.value.trim();
    let slug = customAliasInput.value.trim();

    if (!originalUrl) return;

    if (slug) {
        if (links.some(l => l.slug === slug)) {
            showToast('Custom alias is already taken!', 'error');
            return;
        }
    } else {
        slug = generateSlug();
    }

    const newLink = {
        id: Date.now().toString(),
        slug: slug,
        originalUrl: originalUrl,
        createdAt: Date.now(),
        expiresAt: calculateExpiration(expirationSelect.value),
        clicks: 0
    };

    links.unshift(newLink);
    saveState();
    
    originalUrlInput.value = '';
    customAliasInput.value = '';
    showToast('Short link created successfully!', 'success');
});

// --- Redirect Logic ---
window.handleLinkClick = function(id) {
    const link = links.find(l => l.id === id);
    if (!link) return;

    if (isExpired(link)) {
        showToast('This link has expired.', 'error');
        return;
    }

    activeRedirectLink = link;
    modalTargetUrl.textContent = link.originalUrl;
    redirectModal.classList.remove('hidden');

    let count = 3;
    countdownTimer.textContent = count;

    clearInterval(redirectInterval);
    redirectInterval = setInterval(() => {
        count--;
        countdownTimer.textContent = count;
        if (count <= 0) {
            executeRedirect();
        }
    }, 1000);
};

function executeRedirect() {
    clearInterval(redirectInterval);
    if (activeRedirectLink) {
        activeRedirectLink.clicks += 1;
        saveState();
        window.open(activeRedirectLink.originalUrl, '_blank');
    }
    closeRedirectModal();
}

function closeRedirectModal() {
    clearInterval(redirectInterval);
    redirectModal.classList.add('hidden');
    activeRedirectLink = null;
}

cancelRedirectBtn.addEventListener('click', closeRedirectModal);
confirmRedirectBtn.addEventListener('click', executeRedirect);

// --- Actions ---
window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text);
    showToast('Link copied to clipboard!', 'info');
};

window.deleteLink = function(id) {
    links = links.filter(l => l.id !== id);
    saveState();
    showToast('Link deleted.', 'info');
};

// --- QR Code Modal ---
window.openQrModal = function(slug) {
    const fullUrl = `https://shorty.link/${slug}`;
    qrcodeContainer.innerHTML = '';
    new QRCode(qrcodeContainer, {
        text: fullUrl,
        width: 160,
        height: 160
    });
    qrLinkText.textContent = fullUrl;
    qrModal.classList.remove('hidden');
};

closeQrBtn.addEventListener('click', () => {
    qrModal.classList.add('hidden');
});

// --- Search & Export ---
searchInput.addEventListener('input', render);

document.getElementById('export-json-btn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(links, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shortylink-export-${Date.now()}.json`;
    a.click();
});

document.getElementById('export-csv-btn').addEventListener('click', () => {
    if (links.length === 0) return showToast('No links to export.', 'error');
    const headers = ['ID', 'Slug', 'Original URL', 'Clicks', 'Created At', 'Expires At'];
    const rows = links.map(l => [
        l.id,
        l.slug,
        `"${l.originalUrl}"`,
        l.clicks,
        new Date(l.createdAt).toISOString(),
        l.expiresAt ? new Date(l.expiresAt).toISOString() : 'Never'
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('
');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shortylink-export-${Date.now()}.csv`;
    a.click();
});

document.getElementById('clear-all-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to delete all short links?')) {
        links = [];
        saveState();
        showToast('All links cleared.', 'info');
    }
});

// Initial Render
render();
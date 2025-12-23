document.addEventListener('DOMContentLoaded', () => {
    const fields = ['enabled', 'theme', 'overrideSelection', 'smartCopy', 'strictMode'];

    // Localize UI
    localizeUI();

    // Load current settings
    chrome.storage.sync.get({
        enabled: true,
        theme: 'auto',
        overrideSelection: true,
        smartCopy: true,
        strictMode: false
    }, (settings) => {
        fields.forEach(field => {
            const el = document.getElementById(field);
            if (el.type === 'checkbox') {
                el.checked = settings[field];
            } else {
                el.value = settings[field];
            }
        });
        applyTheme(settings.theme);
    });

    // Save on change
    fields.forEach(field => {
        const el = document.getElementById(field);
        el.addEventListener('change', () => {
            const value = el.type === 'checkbox' ? el.checked : el.value;
            chrome.storage.sync.set({ [field]: value });
            if (field === 'theme') {
                applyTheme(value);
            }
        });
    });

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-sle-theme', theme);
    }

    function localizeUI() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = chrome.i18n.getMessage(key);
            if (translation) {
                if (el.tagName === 'INPUT' && el.getAttribute('placeholder')) {
                    el.setAttribute('placeholder', translation);
                } else {
                    el.textContent = translation;
                }
            }
        });
    }
});

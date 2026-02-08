import { el } from '../renderer.js';
import { getState } from '../../core/game-state.js';
import { TEAMS } from '../../config/team-metadata.js';
import { navigate } from '../router.js';
import { formatRecord } from '../../engine/standings-manager.js';
import { eventBus } from '../../core/event-bus.js';

const NAV_ITEMS = [
    { section: 'Game', items: [
        { label: 'Dashboard', icon: '\u{1F3E0}', route: '/dashboard' },
        { label: 'Schedule', icon: '\u{1F4C5}', route: '/schedule' },
        { label: 'Game Day', icon: '\u{1F3C0}', route: '/game' },
    ]},
    { section: 'Team', items: [
        { label: 'Roster', icon: '\u{1F465}', route: '/roster' },
        { label: 'Standings', icon: '\u{1F4CA}', route: '/standings' },
    ]},
    { section: 'League', items: [
        { label: 'Playoffs', icon: '\u{1F3C6}', route: '/playoffs' },
        { label: 'Stats Leaders', icon: '\u{1F4C8}', route: '/stats' },
        { label: 'Awards', icon: '\u{2B50}', route: '/awards' },
    ]},
    { section: 'Management', items: [
        { label: 'Trade Center', icon: '\u{1F91D}', route: '/trade' },
        { label: 'Free Agency', icon: '\u{270F}', route: '/free-agency' },
        { label: 'Draft', icon: '\u{1F4DD}', route: '/draft' },
    ]},
    { section: 'System', items: [
        { label: 'Settings', icon: '\u{2699}', route: '/settings' },
    ]}
];

export function renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    sidebar.innerHTML = '';
    const state = getState();

    // Logo
    const logo = el('div', { className: 'sidebar-logo' });
    logo.appendChild(el('h1', {}, 'NBA MGR'));
    if (state.userTeamId) {
        const team = TEAMS[state.userTeamId];
        logo.appendChild(el('div', { className: 'season-info' },
            `${state.season}-${state.season + 1} Season`
        ));
    }
    sidebar.appendChild(logo);

    // Nav sections
    const nav = el('div', { className: 'sidebar-nav' });

    NAV_ITEMS.forEach(section => {
        const sectionEl = el('div', { className: 'nav-section' });
        sectionEl.appendChild(el('div', { className: 'nav-section-title' }, section.section));

        section.items.forEach(item => {
            const navItem = el('div', {
                className: 'nav-item',
                dataset: { route: item.route },
                onclick: () => navigate(item.route)
            });
            navItem.appendChild(el('span', { className: 'nav-icon' }, item.icon));
            navItem.appendChild(el('span', {}, item.label));
            sectionEl.appendChild(navItem);
        });

        nav.appendChild(sectionEl);
    });

    sidebar.appendChild(nav);

    // Team summary at bottom
    if (state.userTeamId) {
        const team = state.teams[state.userTeamId];
        const teamMeta = TEAMS[state.userTeamId];
        const summary = el('div', { className: 'team-summary' });
        summary.style.borderLeftColor = teamMeta.colors.primary;

        summary.appendChild(el('div', { style: { color: teamMeta.colors.primary, fontWeight: '700', fontSize: 'var(--font-sm)' } },
            `${teamMeta.city} ${teamMeta.name}`
        ));
        summary.appendChild(el('div', { className: 'team-record' },
            team ? formatRecord(team) : '0-0'
        ));
        summary.appendChild(el('div', { style: { color: 'var(--text-muted)', fontSize: 'var(--font-xs)', marginTop: '2px' } },
            `Phase: ${state.phase}`
        ));

        sidebar.appendChild(summary);
    }
}

export function updateSidebar() {
    renderSidebar();
}

// Subscribe to state changes
eventBus.on('stateChanged', () => {
    if (getState().userTeamId) renderSidebar();
});

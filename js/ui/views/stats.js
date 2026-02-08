import { el, renderTable, renderRatingBadge } from '../renderer.js';
import { getState } from '../../core/game-state.js';
import { TEAMS } from '../../config/team-metadata.js';
import { renderNavbar } from '../components/navbar.js';
import { navigate } from '../router.js';
import { getLeagueLeaders } from '../../stats/stat-tracker.js';

const STAT_CATEGORIES = [
    { key: 'ppg', label: 'Points', format: v => v.toFixed(1) },
    { key: 'rpg', label: 'Rebounds', format: v => v.toFixed(1) },
    { key: 'apg', label: 'Assists', format: v => v.toFixed(1) },
    { key: 'spg', label: 'Steals', format: v => v.toFixed(1) },
    { key: 'bpg', label: 'Blocks', format: v => v.toFixed(1) },
    { key: 'fgPct', label: 'FG%', format: v => (v * 100).toFixed(1) + '%' },
    { key: 'tpPct', label: '3P%', format: v => (v * 100).toFixed(1) + '%' },
    { key: 'ftPct', label: 'FT%', format: v => (v * 100).toFixed(1) + '%' },
];

let activeStat = 'ppg';

export function render(container) {
    const state = getState();
    renderNavbar('League Stats');

    const page = el('div', { className: 'animate-fade-in' });
    page.appendChild(el('h2', { className: 'mb-lg' }, 'League Leaders'));

    // Category tabs
    const tabs = el('div', { className: 'tabs' });
    STAT_CATEGORIES.forEach(cat => {
        tabs.appendChild(el('div', {
            className: `tab ${cat.key === activeStat ? 'active' : ''}`,
            onclick: () => {
                activeStat = cat.key;
                render(container);
            }
        }, cat.label));
    });
    page.appendChild(tabs);

    // Leaders table
    const cat = STAT_CATEGORIES.find(c => c.key === activeStat);
    const leaders = getLeagueLeaders(activeStat, 25);

    if (leaders.length === 0) {
        page.appendChild(el('div', { className: 'empty-state' }, el('h3', {}, 'No stats available yet. Play some games first!')));
        container.appendChild(page);
        return;
    }

    const columns = [
        { key: 'rank', label: '#', render: (_, i) => `${i + 1}` },
        { key: 'player', label: 'Player', render: (row) => {
            const nameEl = el('span', { className: 'player-name', onclick: () => navigate(`/player/${row.playerId}`) });
            nameEl.textContent = `${row.player.firstName} ${row.player.lastName}`;
            return nameEl;
        }},
        { key: 'team', label: 'Team', render: (row) => row.player.team || '-' },
        { key: 'pos', label: 'Pos', render: (row) => row.player.position },
        { key: 'gp', label: 'GP', align: 'right', render: (row) => row.avg?.gp || '-' },
        { key: 'value', label: cat.label, align: 'right', render: (row) => {
            return el('span', { style: { fontWeight: '700', color: 'var(--accent)' } }, cat.format(row.value));
        }},
        { key: 'ppg', label: 'PPG', align: 'right', render: (row) => row.avg?.ppg || '-' },
        { key: 'rpg', label: 'RPG', align: 'right', render: (row) => row.avg?.rpg || '-' },
        { key: 'apg', label: 'APG', align: 'right', render: (row) => row.avg?.apg || '-' }
    ];

    page.appendChild(renderTable(columns, leaders));
    container.appendChild(page);
}

export function destroy() { activeStat = 'ppg'; }

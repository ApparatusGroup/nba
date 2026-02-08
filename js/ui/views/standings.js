import { el, renderTable } from '../renderer.js';
import { getState } from '../../core/game-state.js';
import { TEAMS } from '../../config/team-metadata.js';
import { renderNavbar } from '../components/navbar.js';
import { navigate } from '../router.js';
import { getConferenceStandings, formatRecord, formatStreak, formatLast10 } from '../../engine/standings-manager.js';

export function render(container) {
    const state = getState();
    renderNavbar('Standings');

    const page = el('div', { className: 'animate-fade-in' });
    page.appendChild(el('h2', { className: 'mb-lg' }, `${state.season}-${state.season + 1} Standings`));

    const standingsContainer = el('div', { className: 'standings-container' });

    for (const conf of ['East', 'West']) {
        const confDiv = el('div');
        confDiv.appendChild(el('h3', { className: 'mb-md' }, `${conf}ern Conference`));

        const standings = getConferenceStandings(conf);
        const columns = [
            { key: 'seed', label: '#', render: (_, i) => `${i + 1}` },
            { key: 'team', label: 'Team', render: (row) => {
                const isUser = row.id === state.userTeamId;
                const nameEl = el('span', {
                    className: isUser ? 'user-team' : '',
                    style: { fontWeight: '600', cursor: 'pointer' },
                    onclick: () => navigate(`/team/${row.id}`)
                }, `${row.city} ${row.name}`);
                return nameEl;
            }},
            { key: 'record', label: 'W-L', render: (row) => formatRecord(row) },
            { key: 'pct', label: 'PCT', align: 'right', render: (row) => (row.winPct || 0).toFixed(3) },
            { key: 'gb', label: 'GB', align: 'right', render: (row) => row.gb === 0 ? '-' : row.gb.toFixed(1) },
            { key: 'streak', label: 'STRK', render: (row) => formatStreak(row) },
            { key: 'l10', label: 'L10', render: (row) => formatLast10(row) }
        ];

        const table = renderTable(columns, standings, {
            rowClass: (row, i) => {
                let cls = '';
                if (i === 5) cls += 'playoff-line ';
                if (i === 9) cls += 'playin-line ';
                if (row.id === state.userTeamId) cls += 'user-team ';
                return cls.trim();
            }
        });
        table.className += ' standings-table';

        confDiv.appendChild(table);

        // Legend
        const legend = el('div', { style: { fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-sm)' } });
        legend.innerHTML = '<span style="color:var(--accent)">--- Playoff cutoff (1-6)</span> &nbsp; <span style="color:var(--warning)">--- Play-In cutoff (7-10)</span>';
        confDiv.appendChild(legend);

        standingsContainer.appendChild(confDiv);
    }

    page.appendChild(standingsContainer);
    container.appendChild(page);
}

export function destroy() {}

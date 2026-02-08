import { el } from '../renderer.js';
import { getState } from '../../core/game-state.js';
import { TEAMS } from '../../config/team-metadata.js';
import { renderNavbar } from '../components/navbar.js';
import { navigate } from '../router.js';

export function render(container) {
    const state = getState();
    renderNavbar('Schedule');

    const page = el('div', { className: 'animate-fade-in' });
    page.appendChild(el('h2', { className: 'mb-lg' }, `${state.season}-${state.season + 1} Schedule`));

    // Filter tabs
    const tabs = el('div', { className: 'tabs' });
    ['All Games', 'My Games', 'Results', 'Upcoming'].forEach((tab, i) => {
        tabs.appendChild(el('div', {
            className: `tab ${i === 1 ? 'active' : ''}`,
            onclick: (e) => {
                tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                renderScheduleList(page.querySelector('.schedule-list'), state, i);
            }
        }, tab));
    });
    page.appendChild(tabs);

    const listContainer = el('div', { className: 'schedule-list' });
    renderScheduleList(listContainer, state, 1); // Default: My Games
    page.appendChild(listContainer);

    container.appendChild(page);
}

function renderScheduleList(container, state, filter) {
    container.innerHTML = '';

    state.schedule.forEach(day => {
        let games = day.games;

        if (filter === 1) {
            games = games.filter(g => g.home === state.userTeamId || g.away === state.userTeamId);
        } else if (filter === 2) {
            games = games.filter(g => g.played);
        } else if (filter === 3) {
            games = games.filter(g => !g.played);
        }

        if (games.length === 0) return;

        const dayHeader = el('div', { style: { fontSize: 'var(--font-sm)', fontWeight: '600', color: 'var(--text-muted)', padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--border-color)', marginTop: 'var(--space-md)' } }, day.date);
        container.appendChild(dayHeader);

        games.forEach(game => {
            const homeMeta = TEAMS[game.home];
            const awayMeta = TEAMS[game.away];
            const isUserGame = game.home === state.userTeamId || game.away === state.userTeamId;

            const row = el('div', {
                style: {
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr auto',
                    alignItems: 'center',
                    gap: 'var(--space-md)',
                    padding: 'var(--space-sm) var(--space-md)',
                    background: isUserGame ? 'var(--accent-light)' : 'transparent',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-sm)',
                    cursor: game.played ? 'pointer' : 'default'
                },
                onclick: game.played ? () => navigate(`/game-result/${game.id}`) : null
            });

            // Away team
            const awayEl = el('div', { style: { textAlign: 'right' } });
            awayEl.appendChild(el('span', { style: { fontWeight: game.result?.winner === game.away ? '700' : '400' } },
                `${awayMeta.city} ${awayMeta.name}`
            ));
            row.appendChild(awayEl);

            // Score or @
            if (game.played && game.result) {
                const userWon = game.result.winner === state.userTeamId;
                const scoreEl = el('div', {
                    style: { fontFamily: 'var(--font-mono)', fontWeight: '700', textAlign: 'center', minWidth: '80px' }
                });
                scoreEl.textContent = `${game.result.awayScore} - ${game.result.homeScore}`;
                row.appendChild(scoreEl);
            } else {
                row.appendChild(el('div', { style: { textAlign: 'center', color: 'var(--text-muted)', minWidth: '80px' } }, '@'));
            }

            // Home team
            const homeEl = el('div');
            homeEl.appendChild(el('span', { style: { fontWeight: game.result?.winner === game.home ? '700' : '400' } },
                `${homeMeta.city} ${homeMeta.name}`
            ));
            row.appendChild(homeEl);

            // Result badge
            if (game.played && isUserGame) {
                const won = game.result.winner === state.userTeamId;
                row.appendChild(el('span', {
                    className: `badge ${won ? 'badge-success' : 'badge-danger'}`,
                    style: { minWidth: '24px', textAlign: 'center' }
                }, won ? 'W' : 'L'));
            } else {
                row.appendChild(el('div'));
            }

            container.appendChild(row);
        });
    });

    if (container.children.length === 0) {
        container.appendChild(el('div', { className: 'empty-state' }, el('h3', {}, 'No games to display')));
    }
}

export function destroy() {}

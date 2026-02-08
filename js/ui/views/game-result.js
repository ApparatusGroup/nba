import { el } from '../renderer.js';
import { getState } from '../../core/game-state.js';
import { TEAMS } from '../../config/team-metadata.js';
import { renderNavbar } from '../components/navbar.js';
import { navigate } from '../router.js';

export function render(container, gameId) {
    const state = getState();
    renderNavbar('Game Result');

    const page = el('div', { className: 'game-sim-container animate-fade-in' });

    // Find the game in schedule
    let game = null;
    for (const day of state.schedule) {
        game = day.games.find(g => g.id === gameId);
        if (game) break;
    }

    if (!game || !game.result) {
        page.appendChild(el('div', { className: 'empty-state' }, el('h3', {}, 'Game not found')));
        container.appendChild(page);
        return;
    }

    const homeMeta = TEAMS[game.home];
    const awayMeta = TEAMS[game.away];

    const scoreboard = el('div', { className: 'scoreboard' });

    const awaySide = el('div', { className: 'team-side' });
    const awayAbbr = el('div', { className: 'team-abbr' }, game.away);
    awayAbbr.style.color = awayMeta.colors.primary;
    awaySide.appendChild(awayAbbr);
    awaySide.appendChild(el('div', { style: { fontSize: 'var(--font-sm)' } }, `${awayMeta.city} ${awayMeta.name}`));
    awaySide.appendChild(el('div', { className: 'score' }, `${game.result.awayScore}`));

    const gi = el('div', { className: 'game-info' });
    gi.appendChild(el('div', { className: 'quarter', style: { color: 'var(--success)' } }, 'FINAL'));

    const homeSide = el('div', { className: 'team-side' });
    const homeAbbr = el('div', { className: 'team-abbr' }, game.home);
    homeAbbr.style.color = homeMeta.colors.primary;
    homeSide.appendChild(homeAbbr);
    homeSide.appendChild(el('div', { style: { fontSize: 'var(--font-sm)' } }, `${homeMeta.city} ${homeMeta.name}`));
    homeSide.appendChild(el('div', { className: 'score' }, `${game.result.homeScore}`));

    scoreboard.appendChild(awaySide);
    scoreboard.appendChild(gi);
    scoreboard.appendChild(homeSide);
    page.appendChild(scoreboard);

    // Winner highlight
    const winner = game.result.winner;
    const winnerMeta = TEAMS[winner];
    page.appendChild(el('div', {
        style: { textAlign: 'center', margin: 'var(--space-lg)', fontSize: 'var(--font-lg)', color: winnerMeta.colors.primary, fontWeight: '700' }
    }, `${winnerMeta.city} ${winnerMeta.name} Win!`));

    page.appendChild(el('div', { style: { textAlign: 'center' } },
        el('button', { className: 'btn btn-outline', onclick: () => navigate('/schedule') }, 'Back to Schedule')
    ));

    container.appendChild(page);
}

export function destroy() {}

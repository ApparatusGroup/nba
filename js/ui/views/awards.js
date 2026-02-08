import { el, renderRatingBadge } from '../renderer.js';
import { getState } from '../../core/game-state.js';
import { TEAMS } from '../../config/team-metadata.js';
import { renderNavbar } from '../components/navbar.js';
import { navigate } from '../router.js';
import { getAwardPlayerName } from '../../systems/awards.js';

export function render(container) {
    const state = getState();
    renderNavbar('Awards');

    const page = el('div', { className: 'animate-fade-in' });
    page.appendChild(el('h2', { className: 'mb-lg' }, `${state.season}-${state.season + 1} Season Awards`));

    const awards = state.awards;

    // Individual awards
    const awardsList = [
        { key: 'mvp', label: 'Most Valuable Player', icon: '\u{1F3C6}' },
        { key: 'dpoy', label: 'Defensive Player of the Year', icon: '\u{1F6E1}' },
        { key: 'roy', label: 'Rookie of the Year', icon: '\u{2B50}' },
        { key: 'mip', label: 'Most Improved Player', icon: '\u{1F4C8}' },
        { key: 'sixthMan', label: 'Sixth Man of the Year', icon: '\u{1F4AA}' }
    ];

    const awardsGrid = el('div', { className: 'grid grid-3', style: { marginBottom: 'var(--space-xl)' } });

    awardsList.forEach(award => {
        const card = el('div', { className: 'card', style: { textAlign: 'center' } });
        card.appendChild(el('div', { style: { fontSize: '2rem', marginBottom: 'var(--space-sm)' } }, award.icon));
        card.appendChild(el('div', { style: { fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' } }, award.label));

        const winnerId = awards[award.key];
        if (winnerId) {
            const player = state.players[winnerId];
            if (player) {
                const team = TEAMS[player.team];
                card.appendChild(el('div', {
                    style: { fontSize: 'var(--font-lg)', fontWeight: '700', marginTop: 'var(--space-sm)', cursor: 'pointer', color: 'var(--accent)' },
                    onclick: () => navigate(`/player/${winnerId}`)
                }, `${player.firstName} ${player.lastName}`));
                if (team) card.appendChild(el('div', { style: { fontSize: 'var(--font-sm)', color: team.colors.primary } }, team.name));
            }
        } else {
            card.appendChild(el('div', { style: { color: 'var(--text-muted)', marginTop: 'var(--space-sm)' } }, 'TBD'));
        }

        awardsGrid.appendChild(card);
    });

    page.appendChild(awardsGrid);

    // All-NBA Teams
    if (awards.allNBA) {
        const allNbaCard = el('div', { className: 'card mb-lg' });
        allNbaCard.appendChild(el('h3', { className: 'card-title mb-md' }, 'All-NBA Teams'));

        ['first', 'second', 'third'].forEach(team => {
            const ids = awards.allNBA[team] || [];
            if (ids.length === 0) return;

            allNbaCard.appendChild(el('h4', { style: { color: 'var(--text-secondary)', marginTop: 'var(--space-md)', marginBottom: 'var(--space-sm)', textTransform: 'capitalize' } }, `${team} Team`));

            const row = el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)' } });
            ids.forEach(pid => {
                const player = state.players[pid];
                if (!player) return;
                const badge = el('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', padding: 'var(--space-xs) var(--space-md)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', fontSize: 'var(--font-sm)', cursor: 'pointer' }, onclick: () => navigate(`/player/${pid}`) });
                badge.appendChild(el('span', { style: { fontWeight: '600' } }, `${player.firstName} ${player.lastName}`));
                badge.appendChild(renderRatingBadge(player.ratings.overall));
                row.appendChild(badge);
            });
            allNbaCard.appendChild(row);
        });

        page.appendChild(allNbaCard);
    }

    // All-Star
    if (awards.allStar) {
        const allStarCard = el('div', { className: 'card mb-lg' });
        allStarCard.appendChild(el('h3', { className: 'card-title mb-md' }, 'All-Star Selections'));

        ['East', 'West'].forEach(conf => {
            const ids = awards.allStar[conf] || [];
            if (ids.length === 0) return;

            allStarCard.appendChild(el('h4', { style: { color: 'var(--text-secondary)', marginTop: 'var(--space-md)', marginBottom: 'var(--space-sm)' } }, `${conf}ern Conference`));

            const row = el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' } });
            ids.forEach(pid => {
                const player = state.players[pid];
                if (!player) return;
                row.appendChild(el('span', {
                    style: { padding: 'var(--space-xs) var(--space-md)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', fontSize: 'var(--font-xs)', cursor: 'pointer' },
                    onclick: () => navigate(`/player/${pid}`)
                }, `${player.firstName.charAt(0)}. ${player.lastName}`));
            });
            allStarCard.appendChild(row);
        });

        page.appendChild(allStarCard);
    }

    // Historical
    if (state.history && state.history.length > 0) {
        const histCard = el('div', { className: 'card' });
        histCard.appendChild(el('h3', { className: 'card-title mb-md' }, 'Championship History'));

        state.history.forEach(h => {
            const row = el('div', { style: { display: 'flex', justifyContent: 'space-between', padding: 'var(--space-xs) 0', fontSize: 'var(--font-sm)', borderBottom: '1px solid var(--border-color)' } });
            row.appendChild(el('span', {}, `${h.season}-${h.season + 1}`));
            row.appendChild(el('span', { style: { fontWeight: '600' } }, TEAMS[h.champion]?.name || h.champion));
            histCard.appendChild(row);
        });

        page.appendChild(histCard);
    }

    container.appendChild(page);
}

export function destroy() {}

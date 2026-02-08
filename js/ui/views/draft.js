import { el, renderRatingBadge, showToast } from '../renderer.js';
import { getState } from '../../core/game-state.js';
import { TEAMS } from '../../config/team-metadata.js';
import { renderNavbar } from '../components/navbar.js';

export function render(container) {
    const state = getState();
    renderNavbar('NBA Draft');

    const page = el('div', { className: 'animate-fade-in' });
    page.appendChild(el('h2', { className: 'mb-lg' }, `${state.season + 1} NBA Draft`));

    const results = state.draftResults;

    if (!results || results.length === 0) {
        page.appendChild(el('div', { className: 'empty-state' },
            el('h3', {}, 'Draft has not occurred yet'),
            el('p', {}, 'The NBA Draft happens during the offseason.')
        ));
        container.appendChild(page);
        return;
    }

    // Draft board layout
    const board = el('div', { className: 'draft-board' });

    // Pick list
    const pickList = el('div', { className: 'draft-order' });
    pickList.appendChild(el('h3', { className: 'mb-md' }, 'Draft Results'));

    results.forEach(pick => {
        const teamMeta = TEAMS[pick.team];
        const isUser = pick.team === state.userTeamId;

        const pickEl = el('div', {
            className: `draft-pick ${isUser ? 'current' : 'completed'}`,
            style: { background: isUser ? 'var(--accent-light)' : '' }
        });
        pickEl.appendChild(el('span', { className: 'pick-num' }, `${pick.round}-${pick.pick}`));
        pickEl.appendChild(el('span', { style: { flex: 1 } },
            `${teamMeta.name}: ${pick.player.firstName} ${pick.player.lastName}`
        ));
        pickEl.appendChild(renderRatingBadge(pick.player.ratings.overall));
        pickList.appendChild(pickEl);
    });

    board.appendChild(pickList);

    // Prospect details
    const detailsPanel = el('div');
    detailsPanel.appendChild(el('h3', { className: 'mb-md' }, 'Prospects'));

    const draftBoard = state.draftBoard || [];
    draftBoard.sort((a, b) => b.ratings.overall - a.ratings.overall);

    draftBoard.slice(0, 20).forEach((prospect, i) => {
        const card = el('div', { className: 'prospect-card', style: { marginBottom: 'var(--space-md)' } });
        const header = el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } });
        header.appendChild(el('div', { className: 'prospect-name' }, `${i + 1}. ${prospect.firstName} ${prospect.lastName}`));
        header.appendChild(renderRatingBadge(prospect.ratings.overall));
        card.appendChild(header);

        card.appendChild(el('div', { style: { fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', margin: 'var(--space-xs) 0' } },
            `${prospect.position} | Age ${prospect.age} | ${prospect.country || 'USA'} | POT: ${prospect.potential}`
        ));

        if (prospect.scoutingReport) {
            card.appendChild(el('div', { style: { fontSize: 'var(--font-xs)', color: 'var(--text-muted)', fontStyle: 'italic' } }, prospect.scoutingReport));
        }

        // Key ratings
        const ratings = el('div', { className: 'prospect-ratings', style: { gridTemplateColumns: 'repeat(5, 1fr)' } });
        ['offense', 'defense', 'threePoint', 'inside', 'passing'].forEach(key => {
            const item = el('div', { className: 'prospect-rating-item' });
            item.appendChild(el('div', { className: 'rating-label' }, key === 'threePoint' ? '3PT' : key.substring(0, 3).toUpperCase()));
            item.appendChild(el('div', { className: 'rating-value' }, `${prospect.ratings[key]}`));
            ratings.appendChild(item);
        });
        card.appendChild(ratings);

        // Show which team drafted
        const drafted = results.find(r => r.player.id === prospect.id);
        if (drafted) {
            const draftedMeta = TEAMS[drafted.team];
            card.appendChild(el('div', {
                style: { fontSize: 'var(--font-xs)', marginTop: 'var(--space-sm)', color: drafted.team === state.userTeamId ? 'var(--accent)' : 'var(--text-muted)' }
            }, `Drafted by ${draftedMeta.name} (Round ${drafted.round}, Pick ${drafted.pick})`));
        }

        detailsPanel.appendChild(card);
    });

    board.appendChild(detailsPanel);
    page.appendChild(board);

    container.appendChild(page);
}

export function destroy() {}

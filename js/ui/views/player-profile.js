import { el, renderRatingBadge, renderCard } from '../renderer.js';
import { getState } from '../../core/game-state.js';
import { TEAMS } from '../../config/team-metadata.js';
import { renderNavbar } from '../components/navbar.js';
import { navigate } from '../router.js';
import { getPlayerSeasonAvg } from '../../stats/stat-tracker.js';
import { formatSalary, heightToString, ratingClass } from '../../core/utils.js';

export function render(container, playerId) {
    const state = getState();
    const player = state.players[playerId];

    if (!player) {
        container.appendChild(el('div', { className: 'empty-state' }, el('h3', {}, 'Player not found')));
        return;
    }

    const teamMeta = player.team ? TEAMS[player.team] : null;
    renderNavbar(`${player.firstName} ${player.lastName}`);

    const page = el('div', { className: 'animate-fade-in' });

    // Player header
    const header = el('div', { className: 'player-header' });
    const avatar = el('div', { className: 'player-avatar', style: { background: teamMeta ? teamMeta.colors.primary : 'var(--accent)' } });
    avatar.textContent = player.firstName.charAt(0) + player.lastName.charAt(0);
    header.appendChild(avatar);

    const bio = el('div', { className: 'player-bio' });
    bio.appendChild(el('h1', {}, `${player.firstName} ${player.lastName}`));

    const details = el('div', { className: 'player-details' });
    details.appendChild(el('span', {}, `${player.position}${player.secondaryPos ? '/' + player.secondaryPos : ''}`));
    if (teamMeta) details.appendChild(el('span', { style: { color: teamMeta.colors.primary } }, `${teamMeta.city} ${teamMeta.name}`));
    details.appendChild(el('span', {}, `Age: ${player.age}`));
    details.appendChild(el('span', {}, heightToString(player.height)));
    details.appendChild(el('span', {}, `${player.weight} lbs`));
    details.appendChild(el('span', {}, `${player.yearsPro} yrs exp`));
    details.appendChild(el('span', {}, player.country || 'USA'));
    bio.appendChild(details);

    const contractInfo = el('div', { style: { marginTop: 'var(--space-sm)', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' } });
    contractInfo.textContent = `Contract: ${formatSalary(player.salary)} / ${player.contractYears} yrs`;
    bio.appendChild(contractInfo);

    header.appendChild(bio);

    // Overall badge
    const ovrBadge = el('div', { style: { marginLeft: 'auto', textAlign: 'center' } });
    ovrBadge.appendChild(el('div', { style: { fontSize: 'var(--font-3xl)', fontWeight: '800', fontFamily: 'var(--font-mono)' }, className: ratingClass(player.ratings.overall) }, `${player.ratings.overall}`));
    ovrBadge.appendChild(el('div', { style: { fontSize: 'var(--font-xs)', color: 'var(--text-muted)' } }, 'OVERALL'));
    if (player.potential > player.ratings.overall) {
        ovrBadge.appendChild(el('div', { style: { fontSize: 'var(--font-sm)', color: 'var(--success)', marginTop: 'var(--space-xs)' } }, `POT: ${player.potential}`));
    }
    header.appendChild(ovrBadge);

    page.appendChild(header);

    // Ratings grid
    page.appendChild(el('h3', { className: 'mb-md mt-lg' }, 'Ratings'));
    const ratingsGrid = el('div', { className: 'ratings-grid' });

    const ratingLabels = {
        offense: 'Offense', defense: 'Defense', threePoint: '3-Point', midRange: 'Mid-Range',
        inside: 'Inside', rebounding: 'Rebound', passing: 'Passing', speed: 'Speed',
        stamina: 'Stamina', basketballIQ: 'BBall IQ'
    };

    Object.entries(ratingLabels).forEach(([key, label]) => {
        const item = el('div', { className: 'rating-item' });
        item.appendChild(el('div', { className: 'rating-name' }, label));
        const num = el('div', { className: `rating-number` });
        num.textContent = player.ratings[key] || 0;
        num.style.color = getRatingColor(player.ratings[key] || 0);
        item.appendChild(num);
        ratingsGrid.appendChild(item);
    });

    page.appendChild(ratingsGrid);

    // Season stats
    const avg = getPlayerSeasonAvg(playerId);
    if (avg) {
        page.appendChild(el('h3', { className: 'mb-md mt-lg' }, 'Season Stats'));
        const statsGrid = el('div', { className: 'ratings-grid' });

        const statLabels = { ppg: 'PPG', rpg: 'RPG', apg: 'APG', spg: 'SPG', bpg: 'BPG', fgPct: 'FG%', tpPct: '3P%', ftPct: 'FT%' };
        Object.entries(statLabels).forEach(([key, label]) => {
            const item = el('div', { className: 'rating-item' });
            item.appendChild(el('div', { className: 'rating-name' }, label));
            item.appendChild(el('div', { className: 'rating-number' }, avg[key] ? `${avg[key]}` : '-'));
            statsGrid.appendChild(item);
        });

        const gpItem = el('div', { className: 'rating-item' });
        gpItem.appendChild(el('div', { className: 'rating-name' }, 'Games'));
        gpItem.appendChild(el('div', { className: 'rating-number' }, `${avg.gp}`));
        statsGrid.appendChild(gpItem);

        const mpgItem = el('div', { className: 'rating-item' });
        mpgItem.appendChild(el('div', { className: 'rating-name' }, 'MPG'));
        mpgItem.appendChild(el('div', { className: 'rating-number' }, `${avg.mpg}`));
        statsGrid.appendChild(mpgItem);

        page.appendChild(statsGrid);
    }

    // Back button
    page.appendChild(el('div', { style: { marginTop: 'var(--space-xl)' } },
        el('button', { className: 'btn btn-outline', onclick: () => window.history.back() }, 'Back')
    ));

    container.appendChild(page);
}

function getRatingColor(value) {
    if (value >= 90) return 'var(--success)';
    if (value >= 80) return '#84cc16';
    if (value >= 70) return 'var(--warning)';
    if (value >= 60) return '#f97316';
    return 'var(--danger)';
}

export function destroy() {}

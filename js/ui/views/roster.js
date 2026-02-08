import { el, renderTable, renderRatingBadge, showToast, showModal } from '../renderer.js';
import { getState, getTeamRoster } from '../../core/game-state.js';
import { TEAMS } from '../../config/team-metadata.js';
import { renderNavbar } from '../components/navbar.js';
import { navigate } from '../router.js';
import { getPlayerSeasonAvg } from '../../stats/stat-tracker.js';
import { formatSalary, ratingClass, heightToString } from '../../core/utils.js';
import { autoSetLineups } from '../../systems/ai-gm.js';

export function render(container, teamId) {
    const state = getState();
    const tid = teamId || state.userTeamId;
    const teamMeta = TEAMS[tid];
    const team = state.teams[tid];

    renderNavbar(`${teamMeta.city} ${teamMeta.name} - Roster`);

    const page = el('div', { className: 'animate-fade-in' });

    // Starting lineup
    const startersSection = el('div', { className: 'roster-section' });
    startersSection.appendChild(el('div', { className: 'flex-between mb-md' },
        el('h2', {}, 'Starting Lineup'),
        el('button', { className: 'btn btn-outline btn-sm', onclick: () => {
            autoSetLineups(tid);
            render(container, tid);
            showToast('Lineup auto-set based on ratings', 'info');
        }}, 'Auto-Set Lineup')
    ));

    const lineupGrid = el('div', { className: 'lineup-grid' });
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
    const starters = team?.starters || [];

    positions.forEach((pos, i) => {
        const playerId = starters[i];
        const player = playerId ? state.players[playerId] : null;
        const slot = el('div', { className: `lineup-slot ${player ? 'filled' : ''}` });

        slot.appendChild(el('div', { className: 'position-label' }, pos));

        if (player) {
            slot.style.borderColor = teamMeta.colors.primary;
            const nameEl = el('div', { className: 'player-name', onclick: () => navigate(`/player/${player.id}`) }, `${player.firstName.charAt(0)}. ${player.lastName}`);
            slot.appendChild(nameEl);
            slot.appendChild(renderRatingBadge(player.ratings.overall));

            // Click to change starter
            if (tid === state.userTeamId) {
                slot.appendChild(el('button', { className: 'btn btn-outline btn-sm', style: { marginTop: 'var(--space-xs)', fontSize: 'var(--font-xs)' }, onclick: () => showStarterPicker(pos, i, tid, container) }, 'Change'));
            }
        } else {
            slot.appendChild(el('div', { style: { color: 'var(--text-muted)', fontSize: 'var(--font-sm)' } }, 'Empty'));
            if (tid === state.userTeamId) {
                slot.appendChild(el('button', { className: 'btn btn-primary btn-sm', onclick: () => showStarterPicker(pos, i, tid, container) }, 'Set'));
            }
        }

        lineupGrid.appendChild(slot);
    });

    startersSection.appendChild(lineupGrid);
    page.appendChild(startersSection);

    // Full roster table
    const rosterSection = el('div', { className: 'roster-section' });
    rosterSection.appendChild(el('h2', { className: 'mb-md' }, 'Full Roster'));

    const roster = getTeamRoster(tid);
    const columns = [
        { key: 'name', label: 'Player', render: (row) => {
            const nameEl = el('span', { className: 'player-name', onclick: () => navigate(`/player/${row.id}`) });
            nameEl.textContent = `${row.firstName} ${row.lastName}`;
            return nameEl;
        }},
        { key: 'position', label: 'Pos' },
        { key: 'age', label: 'Age', align: 'right' },
        { key: 'overall', label: 'OVR', render: (row) => renderRatingBadge(row.ratings.overall) },
        { key: 'height', label: 'Ht', render: (row) => heightToString(row.height) },
        { key: 'ppg', label: 'PPG', align: 'right', render: (row) => row.avg?.ppg || '-' },
        { key: 'rpg', label: 'RPG', align: 'right', render: (row) => row.avg?.rpg || '-' },
        { key: 'apg', label: 'APG', align: 'right', render: (row) => row.avg?.apg || '-' },
        { key: 'salary', label: 'Salary', align: 'right', render: (row) => formatSalary(row.salary) },
        { key: 'contract', label: 'Yrs', align: 'right', render: (row) => `${row.contractYears}` }
    ];

    const rows = roster.map(p => ({
        ...p,
        avg: getPlayerSeasonAvg(p.id)
    })).sort((a, b) => b.ratings.overall - a.ratings.overall);

    const table = renderTable(columns, rows, {
        rowClass: (row) => {
            if (starters.includes(row.id)) return 'user-team';
            return '';
        }
    });

    rosterSection.appendChild(table);
    page.appendChild(rosterSection);

    container.appendChild(page);
}

function showStarterPicker(position, slotIndex, teamId, container) {
    const state = getState();
    const team = state.teams[teamId];
    const roster = getTeamRoster(teamId);
    const eligible = roster.filter(p =>
        (p.position === position || p.secondaryPos === position) ||
        true // allow any player for flexibility
    ).sort((a, b) => b.ratings.overall - a.ratings.overall);

    const list = el('div');
    eligible.forEach(p => {
        const row = el('div', {
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-sm)', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' },
            onclick: () => {
                const starters = [...(team.starters || [null, null, null, null, null])];
                while (starters.length < 5) starters.push(null);
                // Remove player from other positions
                const existIdx = starters.indexOf(p.id);
                if (existIdx >= 0) starters[existIdx] = null;
                starters[slotIndex] = p.id;
                team.starters = starters;

                // Update rotation
                const rotationSet = new Set(starters.filter(Boolean));
                (team.rotation || []).forEach(id => rotationSet.add(id));
                roster.forEach(pl => rotationSet.add(pl.id));
                team.rotation = [...rotationSet].slice(0, 10);

                // Close modal
                const overlay = document.getElementById('modal-overlay');
                if (overlay) { overlay.className = 'hidden'; overlay.innerHTML = ''; }
                render(container, teamId);
                showToast(`${p.firstName} ${p.lastName} set as ${position} starter`, 'success');
            }
        });
        row.appendChild(el('span', { style: { fontWeight: '600' } }, `${p.firstName} ${p.lastName} (${p.position})`));
        row.appendChild(renderRatingBadge(p.ratings.overall));
        list.appendChild(row);
    });

    showModal(`Select ${position} Starter`, list);
}

export function destroy() {}

import { el } from '../renderer.js';
import { getState } from '../../core/game-state.js';
import { TEAMS } from '../../config/team-metadata.js';
import { formatSalary } from '../../core/utils.js';
import { calculateTeamSalary, getCapSpace } from '../../systems/salary-cap.js';
import { saveGame } from '../../core/storage.js';
import { showToast } from '../renderer.js';

export function renderNavbar(title = '') {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    navbar.innerHTML = '';
    const state = getState();

    // Left side: hamburger + title
    const leftSide = el('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' } });

    // Hamburger menu (visible on mobile via CSS .menu-toggle)
    leftSide.appendChild(el('button', {
        className: 'menu-toggle',
        onclick: () => {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.querySelector('.sidebar-overlay');
            if (sidebar) sidebar.classList.toggle('open');
            if (overlay) overlay.classList.toggle('active');
        }
    }, '\u2630'));

    leftSide.appendChild(el('div', { className: 'nav-title' }, title || getPhaseTitle(state)));
    navbar.appendChild(leftSide);

    // Actions
    const actions = el('div', { className: 'nav-actions' });

    if (state.userTeamId) {
        // Cap space
        const capSpace = getCapSpace(state.userTeamId);
        actions.appendChild(el('span', {
            style: { fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }
        }, `Cap: ${formatSalary(capSpace)}`));

        // Save button
        actions.appendChild(el('button', {
            className: 'btn btn-outline btn-sm',
            onclick: () => {
                saveGame(0);
                showToast('Game saved!', 'success');
            }
        }, 'Save'));
    }

    navbar.appendChild(actions);
}

function getPhaseTitle(state) {
    switch (state.phase) {
        case 'setup': return 'New Game';
        case 'regular': return `${state.season}-${state.season + 1} Regular Season`;
        case 'playIn': return 'Play-In Tournament';
        case 'playoffs': return `${state.season}-${state.season + 1} Playoffs`;
        case 'offseason': return `${state.season} Offseason`;
        default: return 'NBA Manager';
    }
}

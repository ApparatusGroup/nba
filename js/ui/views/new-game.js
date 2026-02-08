import { el, showToast } from '../renderer.js';
import { TEAMS } from '../../config/team-metadata.js';
import { getState, setState } from '../../core/game-state.js';
import { navigate } from '../router.js';
import { renderSidebar } from '../components/sidebar.js';
import { renderNavbar } from '../components/navbar.js';
import { loadGame, getAllSaveInfo } from '../../core/storage.js';

let selectedTeam = null;

export function render(container) {
    renderNavbar('NBA Manager');
    container.innerHTML = '';

    const screen = el('div', { className: 'team-select-screen animate-fade-in' });
    screen.appendChild(el('h1', {}, 'NBA MANAGER'));
    screen.appendChild(el('p', { className: 'subtitle' }, 'Select your team and lead them to a championship'));

    // Load game section
    const saves = getAllSaveInfo();
    const hasSaves = saves.some(s => s !== null);

    if (hasSaves) {
        const loadSection = el('div', { className: 'card', style: { marginBottom: 'var(--space-xl)', textAlign: 'left' } });
        loadSection.appendChild(el('h3', { style: { marginBottom: 'var(--space-md)' } }, 'Continue Game'));
        const slotsDiv = el('div', { className: 'save-slots' });

        saves.forEach((save, i) => {
            if (!save) return;
            const team = TEAMS[save.userTeamId];
            const slot = el('div', {
                className: 'save-slot occupied',
                onclick: () => {
                    loadGame(i);
                    renderSidebar();
                    navigate('/dashboard');
                }
            });
            slot.appendChild(el('div', { style: { fontWeight: '700', fontSize: 'var(--font-lg)' } }, team ? `${team.city} ${team.name}` : save.userTeamId));
            slot.appendChild(el('div', { className: 'text-muted', style: { fontSize: 'var(--font-xs)' } }, `${save.record} | ${save.phase} | ${save.season}-${save.season + 1}`));
            slotsDiv.appendChild(slot);
        });

        loadSection.appendChild(slotsDiv);
        screen.appendChild(loadSection);
    }

    // Difficulty selection
    const diffSection = el('div', { style: { marginBottom: 'var(--space-xl)' } });
    diffSection.appendChild(el('h3', { style: { marginBottom: 'var(--space-md)' } }, 'Difficulty'));
    const diffRow = el('div', { className: 'flex flex-center gap-md' });
    ['easy', 'normal', 'hard', 'legendary'].forEach(diff => {
        const btn = el('button', {
            className: `btn ${diff === 'normal' ? 'btn-primary' : 'btn-outline'}`,
            id: `diff-${diff}`,
            onclick: () => {
                document.querySelectorAll('[id^="diff-"]').forEach(b => b.className = 'btn btn-outline');
                btn.className = 'btn btn-primary';
                setState({ difficulty: diff });
            }
        }, diff.charAt(0).toUpperCase() + diff.slice(1));
        diffRow.appendChild(btn);
    });
    diffSection.appendChild(diffRow);
    screen.appendChild(diffSection);

    // Team selection
    for (const conf of ['East', 'West']) {
        const section = el('div', { className: 'conference-section' });
        section.appendChild(el('h2', {}, `${conf}ern Conference`));

        const grid = el('div', { className: 'team-grid' });

        Object.entries(TEAMS)
            .filter(([_, t]) => t.conference === conf)
            .sort((a, b) => a[1].city.localeCompare(b[1].city))
            .forEach(([abbr, team]) => {
                const card = el('div', {
                    className: 'team-select-card',
                    onclick: () => selectTeam(abbr, container)
                });
                card.id = `team-card-${abbr}`;
                card.style.borderColor = selectedTeam === abbr ? team.colors.primary : '';

                const abbrEl = el('div', { className: 'team-abbr' }, abbr);
                abbrEl.style.color = team.colors.primary;
                card.appendChild(abbrEl);
                card.appendChild(el('div', { className: 'team-name' }, team.name));
                card.appendChild(el('div', { className: 'team-city' }, team.city));
                grid.appendChild(card);
            });

        section.appendChild(grid);
        screen.appendChild(section);
    }

    // Start button
    const startSection = el('div', { style: { marginTop: 'var(--space-xl)' } });
    const startBtn = el('button', {
        className: 'btn btn-primary btn-lg',
        id: 'start-btn',
        disabled: true,
        onclick: startGame
    }, 'Start Game');
    startSection.appendChild(startBtn);
    screen.appendChild(startSection);

    container.appendChild(screen);
}

function selectTeam(abbr) {
    selectedTeam = abbr;

    // Update visuals
    document.querySelectorAll('.team-select-card').forEach(card => {
        card.classList.remove('selected');
        card.style.borderColor = '';
    });

    const card = document.getElementById(`team-card-${abbr}`);
    if (card) {
        card.classList.add('selected');
        card.style.borderColor = TEAMS[abbr].colors.primary;
    }

    const btn = document.getElementById('start-btn');
    if (btn) btn.disabled = false;
}

function startGame() {
    if (!selectedTeam) return;

    setState({ userTeamId: selectedTeam });
    renderSidebar();
    showToast(`You are now the GM of the ${TEAMS[selectedTeam].city} ${TEAMS[selectedTeam].name}!`, 'success');
    navigate('/dashboard');
}

export function destroy() {
    selectedTeam = null;
}

import { el, showToast } from '../renderer.js';
import { getState, setState } from '../../core/game-state.js';
import { renderNavbar } from '../components/navbar.js';
import { saveGame, loadGame, deleteSave, getAllSaveInfo } from '../../core/storage.js';
import { renderSidebar } from '../components/sidebar.js';
import { navigate } from '../router.js';
import { TEAMS } from '../../config/team-metadata.js';

export function render(container) {
    const state = getState();
    renderNavbar('Settings');

    const page = el('div', { className: 'animate-fade-in', style: { maxWidth: '800px' } });
    page.appendChild(el('h2', { className: 'mb-lg' }, 'Settings'));

    // Difficulty
    const diffSection = el('div', { className: 'settings-section' });
    diffSection.appendChild(el('h3', {}, 'Difficulty'));
    const diffRow = el('div', { className: 'setting-row' });
    diffRow.appendChild(el('span', {}, 'Game Difficulty'));
    const diffSelect = el('select', {
        onchange: (e) => {
            setState({ difficulty: e.target.value });
            showToast(`Difficulty set to ${e.target.value}`, 'info');
        }
    });
    ['easy', 'normal', 'hard', 'legendary'].forEach(d => {
        const opt = el('option', { value: d }, d.charAt(0).toUpperCase() + d.slice(1));
        if (d === state.difficulty) opt.selected = true;
        diffSelect.appendChild(opt);
    });
    diffRow.appendChild(diffSelect);
    diffSection.appendChild(diffRow);
    page.appendChild(diffSection);

    // Save/Load
    const saveSection = el('div', { className: 'settings-section' });
    saveSection.appendChild(el('h3', {}, 'Save & Load'));

    const saves = getAllSaveInfo();
    const slotsDiv = el('div', { className: 'save-slots' });

    [0, 1, 2].forEach(slot => {
        const save = saves[slot];
        const slotEl = el('div', { className: `save-slot ${save ? 'occupied' : ''}` });

        slotEl.appendChild(el('div', { style: { fontWeight: '700', marginBottom: 'var(--space-sm)' } }, `Slot ${slot + 1}`));

        if (save) {
            const team = TEAMS[save.userTeamId];
            slotEl.appendChild(el('div', { style: { fontSize: 'var(--font-sm)' } }, team ? `${team.name} (${save.record})` : save.userTeamId));
            slotEl.appendChild(el('div', { style: { fontSize: 'var(--font-xs)', color: 'var(--text-muted)' } },
                `${save.phase} | Season ${save.season}`
            ));
            if (save.savedAt) {
                slotEl.appendChild(el('div', { style: { fontSize: 'var(--font-xs)', color: 'var(--text-muted)' } },
                    new Date(save.savedAt).toLocaleString()
                ));
            }

            const btns = el('div', { style: { display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)', justifyContent: 'center' } });
            btns.appendChild(el('button', { className: 'btn btn-primary btn-sm', onclick: () => {
                if (loadGame(slot)) {
                    renderSidebar();
                    showToast('Game loaded!', 'success');
                    navigate('/dashboard');
                }
            }}, 'Load'));
            btns.appendChild(el('button', { className: 'btn btn-outline btn-sm', onclick: () => {
                saveGame(slot);
                showToast(`Saved to slot ${slot + 1}!`, 'success');
                render(container);
            }}, 'Overwrite'));
            btns.appendChild(el('button', { className: 'btn btn-danger btn-sm', onclick: () => {
                if (confirm('Delete this save?')) {
                    deleteSave(slot);
                    showToast('Save deleted', 'info');
                    render(container);
                }
            }}, 'Delete'));
            slotEl.appendChild(btns);
        } else {
            slotEl.appendChild(el('div', { style: { color: 'var(--text-muted)', fontSize: 'var(--font-sm)' } }, 'Empty'));
            slotEl.appendChild(el('button', { className: 'btn btn-primary btn-sm', style: { marginTop: 'var(--space-md)' }, onclick: () => {
                saveGame(slot);
                showToast(`Saved to slot ${slot + 1}!`, 'success');
                render(container);
            }}, 'Save Here'));
        }

        slotsDiv.appendChild(slotEl);
    });

    saveSection.appendChild(slotsDiv);
    page.appendChild(saveSection);

    // New Game
    const newGameSection = el('div', { className: 'settings-section' });
    newGameSection.appendChild(el('h3', {}, 'New Game'));
    newGameSection.appendChild(el('button', {
        className: 'btn btn-danger',
        onclick: () => {
            if (confirm('Start a new game? Current unsaved progress will be lost.')) {
                import('../../core/game-state.js').then(m => m.resetState());
                navigate('/new-game');
            }
        }
    }, 'Start New Game'));
    page.appendChild(newGameSection);

    container.appendChild(page);
}

export function destroy() {}

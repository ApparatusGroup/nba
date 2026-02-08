import { el } from '../renderer.js';
import { getState } from '../../core/game-state.js';
import { TEAMS } from '../../config/team-metadata.js';
import { renderNavbar } from '../components/navbar.js';
import { navigate } from '../router.js';
import { formatRecord, getWinPct } from '../../engine/standings-manager.js';
import { calculateTeamSalary, getCapSpace, getLuxuryTaxBill } from '../../systems/salary-cap.js';
import { formatSalary } from '../../core/utils.js';

export function render(container, teamId) {
    const state = getState();
    const tid = teamId || state.userTeamId;
    const teamMeta = TEAMS[tid];
    const team = state.teams[tid];

    if (!teamMeta) {
        container.appendChild(el('div', { className: 'empty-state' }, el('h3', {}, 'Team not found')));
        return;
    }

    renderNavbar(`${teamMeta.city} ${teamMeta.name}`);

    const page = el('div', { className: 'animate-fade-in' });

    // Team header
    const header = el('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' } });
    const logo = el('div', {
        style: { width: '80px', height: '80px', borderRadius: '50%', background: teamMeta.colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--font-2xl)', fontWeight: '800', color: 'white' }
    }, tid);
    header.appendChild(logo);

    const info = el('div');
    info.appendChild(el('h1', { style: { color: teamMeta.colors.primary } }, `${teamMeta.city} ${teamMeta.name}`));
    info.appendChild(el('div', { className: 'text-muted' }, `${teamMeta.arena} | ${teamMeta.conference}ern Conference | ${teamMeta.division} Division`));
    if (team) info.appendChild(el('div', { style: { fontSize: 'var(--font-2xl)', fontWeight: '800', marginTop: 'var(--space-sm)' } }, formatRecord(team)));
    header.appendChild(info);
    page.appendChild(header);

    // Financial overview
    const finCard = el('div', { className: 'card mb-lg' });
    finCard.appendChild(el('h3', { className: 'card-title mb-md' }, 'Finances'));
    const salary = calculateTeamSalary(tid);
    const capSpace = getCapSpace(tid);
    const taxBill = getLuxuryTaxBill(tid);

    const finGrid = el('div', { className: 'grid grid-4' });
    finGrid.appendChild(createFinItem('Total Payroll', formatSalary(salary)));
    finGrid.appendChild(createFinItem('Cap Space', formatSalary(capSpace), capSpace > 0 ? 'success' : 'danger'));
    finGrid.appendChild(createFinItem('Luxury Tax', formatSalary(taxBill), taxBill > 0 ? 'danger' : 'success'));
    finGrid.appendChild(createFinItem('Roster Size', `${team?.roster?.length || 0}/15`));
    finCard.appendChild(finGrid);
    page.appendChild(finCard);

    // Roster button
    page.appendChild(el('button', {
        className: 'btn btn-primary mb-lg',
        onclick: () => navigate(`/roster/${tid}`)
    }, 'View Full Roster'));

    // Back button
    page.appendChild(el('button', { className: 'btn btn-outline', onclick: () => window.history.back() }, 'Back'));

    container.appendChild(page);
}

function createFinItem(label, value, color) {
    const item = el('div', { className: 'stat-box' });
    const valEl = el('div', { className: 'stat-value', style: { fontSize: 'var(--font-lg)' } }, value);
    if (color) valEl.style.color = `var(--${color})`;
    item.appendChild(valEl);
    item.appendChild(el('div', { className: 'stat-label' }, label));
    return item;
}

export function destroy() {}

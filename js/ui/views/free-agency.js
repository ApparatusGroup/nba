import { el, renderRatingBadge, showToast, showModal, hideModal } from '../renderer.js';
import { getState } from '../../core/game-state.js';
import { TEAMS } from '../../config/team-metadata.js';
import { renderNavbar } from '../components/navbar.js';
import { navigate } from '../router.js';
import { getAvailableFreeAgents, signFreeAgent } from '../../systems/free-agency.js';
import { formatSalary, heightToString } from '../../core/utils.js';
import { getCapSpace, getVetMinimum, getMaxSalary } from '../../systems/salary-cap.js';

export function render(container) {
    const state = getState();
    renderNavbar('Free Agency');

    const page = el('div', { className: 'animate-fade-in' });
    page.appendChild(el('h2', { className: 'mb-lg' }, 'Free Agent Market'));

    // Cap space info
    const capInfo = el('div', { className: 'card mb-lg' });
    const capSpace = getCapSpace(state.userTeamId);
    capInfo.appendChild(el('div', { style: { display: 'flex', justifyContent: 'space-around' } },
        el('div', { className: 'stat-box' },
            el('div', { className: 'stat-value', style: { fontSize: 'var(--font-lg)', color: capSpace > 0 ? 'var(--success)' : 'var(--danger)' } }, formatSalary(capSpace)),
            el('div', { className: 'stat-label' }, 'Available Cap Space')
        ),
        el('div', { className: 'stat-box' },
            el('div', { className: 'stat-value', style: { fontSize: 'var(--font-lg)' } }, `${state.teams[state.userTeamId]?.roster?.length || 0}/15`),
            el('div', { className: 'stat-label' }, 'Roster Spots')
        )
    ));
    page.appendChild(capInfo);

    // Free agents list
    const freeAgents = getAvailableFreeAgents();

    if (freeAgents.length === 0) {
        page.appendChild(el('div', { className: 'empty-state' },
            el('h3', {}, 'No free agents available'),
            el('p', {}, 'Free agents become available during the offseason.')
        ));
        container.appendChild(page);
        return;
    }

    freeAgents.forEach(player => {
        const card = el('div', { className: 'fa-player' });

        const infoSection = el('div');
        const nameRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-md)' } });
        nameRow.appendChild(el('span', { style: { fontWeight: '700', cursor: 'pointer' }, onclick: () => navigate(`/player/${player.id}`) }, `${player.firstName} ${player.lastName}`));
        nameRow.appendChild(renderRatingBadge(player.ratings.overall));
        nameRow.appendChild(el('span', { className: 'badge badge-primary' }, player.position));
        infoSection.appendChild(nameRow);

        infoSection.appendChild(el('div', { style: { fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' } },
            `Age ${player.age} | ${heightToString(player.height)} | ${player.weight}lbs | ${player.yearsPro}yr exp`
        ));
        card.appendChild(infoSection);

        // Sign button
        card.appendChild(el('button', {
            className: 'btn btn-primary btn-sm',
            onclick: () => showSignModal(player, container)
        }, 'Sign'));

        page.appendChild(card);
    });

    container.appendChild(page);
}

function showSignModal(player, container) {
    const state = getState();
    const maxSal = getMaxSalary(player.yearsPro);
    const vetMin = getVetMinimum(player.yearsPro);

    const body = el('div');
    body.appendChild(el('div', { style: { marginBottom: 'var(--space-md)' } },
        `Sign ${player.firstName} ${player.lastName} (OVR: ${player.ratings.overall})`
    ));

    body.appendChild(el('label', { style: { display: 'block', marginBottom: 'var(--space-xs)', fontSize: 'var(--font-sm)' } }, 'Years:'));
    const yearsInput = el('input', { type: 'number', min: '1', max: '5', value: '2', style: { width: '100px', marginBottom: 'var(--space-md)' } });
    body.appendChild(yearsInput);

    body.appendChild(el('label', { style: { display: 'block', marginBottom: 'var(--space-xs)', fontSize: 'var(--font-sm)' } },
        `Salary (${formatSalary(vetMin)} - ${formatSalary(maxSal)}):`
    ));
    const salaryInput = el('input', { type: 'number', min: String(vetMin), max: String(maxSal), value: String(vetMin), style: { width: '200px' } });
    body.appendChild(salaryInput);

    showModal('Sign Free Agent', body, [
        { label: 'Cancel', className: 'btn btn-outline' },
        { label: 'Sign Player', className: 'btn btn-primary', onClick: () => {
            const years = parseInt(yearsInput.value) || 1;
            const salary = parseInt(salaryInput.value) || vetMin;
            const result = signFreeAgent(state.userTeamId, player.id, years, salary);
            if (result.success) {
                showToast(`Signed ${player.firstName} ${player.lastName}!`, 'success');
            } else {
                showToast(result.reason, 'error');
            }
            render(container);
        }}
    ]);
}

export function destroy() {}

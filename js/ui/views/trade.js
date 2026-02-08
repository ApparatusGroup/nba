import { el, renderRatingBadge, showToast, showModal } from '../renderer.js';
import { getState, getTeamRoster } from '../../core/game-state.js';
import { TEAMS } from '../../config/team-metadata.js';
import { renderNavbar } from '../components/navbar.js';
import { navigate } from '../router.js';
import { proposeTrade, evaluatePlayer, evaluateTrade, generateAITradeOffer } from '../../systems/trade-engine.js';
import { formatSalary } from '../../core/utils.js';

let selectedTeam = null;
let userOffering = [];
let theirOffering = [];

export function render(container) {
    const state = getState();
    renderNavbar('Trade Center');
    selectedTeam = selectedTeam || Object.keys(state.teams).find(t => t !== state.userTeamId);

    const page = el('div', { className: 'animate-fade-in' });
    page.appendChild(el('h2', { className: 'mb-lg' }, 'Trade Center'));

    // Team selector
    const teamSelect = el('select', {
        style: { marginBottom: 'var(--space-lg)', padding: 'var(--space-sm) var(--space-md)', minWidth: '250px' },
        onchange: (e) => {
            selectedTeam = e.target.value;
            userOffering = [];
            theirOffering = [];
            render(container);
        }
    });
    Object.keys(state.teams).filter(t => t !== state.userTeamId).forEach(tid => {
        const meta = TEAMS[tid];
        const opt = el('option', { value: tid }, `${meta.city} ${meta.name}`);
        if (tid === selectedTeam) opt.selected = true;
        teamSelect.appendChild(opt);
    });
    page.appendChild(teamSelect);

    // Trade panels
    const panels = el('div', { className: 'trade-panels' });

    // User panel
    panels.appendChild(renderTradePanel(state.userTeamId, userOffering, true, container));
    panels.appendChild(el('div', { className: 'trade-arrow' }, '\u21C4'));
    panels.appendChild(renderTradePanel(selectedTeam, theirOffering, false, container));

    page.appendChild(panels);

    // Trade evaluation
    if (userOffering.length > 0 && theirOffering.length > 0) {
        const userPlayers = userOffering.map(id => state.players[id]);
        const theirPlayers = theirOffering.map(id => state.players[id]);
        const evaluation = evaluateTrade(userPlayers, theirPlayers);

        const evalCard = el('div', { className: 'card', style: { marginTop: 'var(--space-lg)' } });
        evalCard.appendChild(el('h3', { className: 'card-title mb-md' }, 'Trade Evaluation'));

        const fairness = evaluation.fairness;
        const meterDiv = el('div', { className: 'trade-value-meter' });
        const fillDiv = el('div', { className: 'trade-value-fill', style: { width: `${fairness * 100}%`, background: fairness > 0.8 ? 'var(--success)' : fairness > 0.6 ? 'var(--warning)' : 'var(--danger)' } });
        meterDiv.appendChild(fillDiv);
        evalCard.appendChild(meterDiv);

        const fairLabel = fairness > 0.9 ? 'Very Fair' : fairness > 0.75 ? 'Slightly Unbalanced' : fairness > 0.6 ? 'Unbalanced' : 'Very Lopsided';
        evalCard.appendChild(el('div', { style: { textAlign: 'center', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' } }, `Trade Fairness: ${fairLabel} (${(fairness * 100).toFixed(0)}%)`));

        const salaryInfo = el('div', { style: { display: 'flex', justifyContent: 'space-around', marginTop: 'var(--space-md)', fontSize: 'var(--font-sm)' } });
        const userSalary = userOffering.reduce((s, id) => s + (state.players[id]?.salary || 0), 0);
        const theirSalary = theirOffering.reduce((s, id) => s + (state.players[id]?.salary || 0), 0);
        salaryInfo.appendChild(el('span', {}, `Your outgoing: ${formatSalary(userSalary)}`));
        salaryInfo.appendChild(el('span', {}, `Their outgoing: ${formatSalary(theirSalary)}`));
        evalCard.appendChild(salaryInfo);

        // Propose button
        evalCard.appendChild(el('div', { style: { textAlign: 'center', marginTop: 'var(--space-lg)' } },
            el('button', { className: 'btn btn-primary btn-lg', onclick: () => executeTradeProp(container) }, 'Propose Trade')
        ));

        page.appendChild(evalCard);
    }

    // Incoming offers
    const offer = generateAITradeOffer(state.userTeamId);
    if (offer) {
        const offerCard = el('div', { className: 'card', style: { marginTop: 'var(--space-lg)' } });
        offerCard.appendChild(el('h3', { className: 'card-title mb-md' }, `Incoming Offer from ${TEAMS[offer.fromTeam].name}`));

        const offerDetails = el('div', { style: { display: 'flex', gap: 'var(--space-lg)' } });

        const theyOffer = el('div');
        theyOffer.appendChild(el('h4', { className: 'text-muted mb-sm' }, 'They Offer:'));
        offer.offering.forEach(pid => {
            const p = state.players[pid];
            if (p) theyOffer.appendChild(el('div', { className: 'trade-player' },
                el('span', {}, `${p.firstName} ${p.lastName} (${p.ratings.overall})`),
                el('span', { className: 'text-muted' }, formatSalary(p.salary))
            ));
        });
        offerDetails.appendChild(theyOffer);

        const theyWant = el('div');
        theyWant.appendChild(el('h4', { className: 'text-muted mb-sm' }, 'They Want:'));
        offer.requesting.forEach(pid => {
            const p = state.players[pid];
            if (p) theyWant.appendChild(el('div', { className: 'trade-player' },
                el('span', {}, `${p.firstName} ${p.lastName} (${p.ratings.overall})`),
                el('span', { className: 'text-muted' }, formatSalary(p.salary))
            ));
        });
        offerDetails.appendChild(theyWant);

        offerCard.appendChild(offerDetails);

        const offerBtns = el('div', { style: { display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-md)' } });
        offerBtns.appendChild(el('button', { className: 'btn btn-success', onclick: () => {
            import('../../systems/trade-engine.js').then(m => {
                m.executeTrade(offer.fromTeam, offer.offering, state.userTeamId, offer.requesting);
            });
            showToast('Trade accepted!', 'success');
            render(container);
        }}, 'Accept'));
        offerBtns.appendChild(el('button', { className: 'btn btn-danger', onclick: () => {
            showToast('Trade rejected.', 'info');
            render(container);
        }}, 'Reject'));
        offerCard.appendChild(offerBtns);

        page.appendChild(offerCard);
    }

    container.appendChild(page);
}

function renderTradePanel(teamId, selectedPlayers, isUser, container) {
    const state = getState();
    const meta = TEAMS[teamId];
    const panel = el('div', { className: 'trade-panel' });

    panel.appendChild(el('h3', { style: { color: meta.colors.primary, marginBottom: 'var(--space-md)' } },
        `${meta.city} ${meta.name}`
    ));

    // Selected players
    if (selectedPlayers.length > 0) {
        selectedPlayers.forEach(pid => {
            const p = state.players[pid];
            if (!p) return;
            const row = el('div', { className: 'trade-player' });
            row.appendChild(el('span', {}, `${p.firstName} ${p.lastName} (${p.ratings.overall})`));
            row.appendChild(el('button', {
                className: 'btn btn-danger btn-sm',
                onclick: () => {
                    const idx = selectedPlayers.indexOf(pid);
                    if (idx >= 0) selectedPlayers.splice(idx, 1);
                    render(container);
                }
            }, '\u2715'));
            panel.appendChild(row);
        });
    }

    // Available players
    panel.appendChild(el('h4', { className: 'text-muted', style: { marginTop: 'var(--space-md)', marginBottom: 'var(--space-sm)', fontSize: 'var(--font-xs)' } }, 'Add Player:'));

    const roster = getTeamRoster(teamId)
        .filter(p => !selectedPlayers.includes(p.id))
        .sort((a, b) => b.ratings.overall - a.ratings.overall);

    const list = el('div', { style: { maxHeight: '250px', overflowY: 'auto' } });
    roster.forEach(p => {
        const row = el('div', {
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-xs) 0', fontSize: 'var(--font-xs)', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' },
            onclick: () => {
                selectedPlayers.push(p.id);
                render(container);
            }
        });
        row.appendChild(el('span', {}, `${p.firstName.charAt(0)}. ${p.lastName} ${p.position} (${p.ratings.overall})`));
        row.appendChild(el('span', { className: 'text-muted' }, formatSalary(p.salary)));
        list.appendChild(row);
    });
    panel.appendChild(list);

    return panel;
}

function executeTradeProp(container) {
    const state = getState();
    const result = proposeTrade(state.userTeamId, userOffering, selectedTeam, theirOffering);

    if (result.success) {
        showToast('Trade completed!', 'success');
        userOffering = [];
        theirOffering = [];
    } else {
        showToast(result.reason, 'error');
    }

    render(container);
}

export function destroy() {
    selectedTeam = null;
    userOffering = [];
    theirOffering = [];
}

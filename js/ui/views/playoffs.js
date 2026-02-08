import { el, showToast } from '../renderer.js';
import { getState } from '../../core/game-state.js';
import { TEAMS } from '../../config/team-metadata.js';
import { renderNavbar } from '../components/navbar.js';
import { navigate } from '../router.js';
import { simulatePlayoffGame, advancePlayoffRound, getActiveSeries, isPlayoffsComplete, getChampion, getCurrentRoundName } from '../../engine/playoff-manager.js';
import { startOffseason } from '../../engine/season-manager.js';

export function render(container) {
    const state = getState();
    renderNavbar('Playoffs');

    const page = el('div', { className: 'animate-fade-in' });
    page.appendChild(el('h2', { className: 'mb-lg' }, `${state.season}-${state.season + 1} NBA Playoffs`));

    if (state.phase !== 'playoffs') {
        page.appendChild(el('div', { className: 'empty-state' }, el('h3', {}, 'Playoffs have not started yet')));
        container.appendChild(page);
        return;
    }

    const bracket = state.playoffs.bracket;
    const roundName = getCurrentRoundName();

    page.appendChild(el('div', { style: { textAlign: 'center', marginBottom: 'var(--space-lg)', color: 'var(--accent)', fontSize: 'var(--font-lg)', fontWeight: '700' } }, roundName));

    // Champion banner
    if (isPlayoffsComplete()) {
        const champion = getChampion();
        const champMeta = TEAMS[champion];
        const banner = el('div', { style: { textAlign: 'center', padding: 'var(--space-xl)', background: 'linear-gradient(135deg, var(--gold), var(--warning))', borderRadius: 'var(--radius-xl)', marginBottom: 'var(--space-xl)', color: '#000' } });
        banner.appendChild(el('div', { style: { fontSize: 'var(--font-3xl)', fontWeight: '800' } }, 'NBA CHAMPIONS'));
        banner.appendChild(el('div', { style: { fontSize: 'var(--font-xl)', fontWeight: '700', marginTop: 'var(--space-sm)' } },
            `${champMeta.city} ${champMeta.name}`
        ));
        page.appendChild(banner);

        if (champion === state.userTeamId) {
            page.appendChild(el('div', { style: { textAlign: 'center', fontSize: 'var(--font-xl)', color: 'var(--success)', fontWeight: '800', marginBottom: 'var(--space-lg)' } }, 'Congratulations! You won the championship!'));
        }

        page.appendChild(el('div', { style: { textAlign: 'center' } },
            el('button', { className: 'btn btn-primary btn-lg', onclick: () => {
                startOffseason();
                navigate('/dashboard');
            }}, 'Continue to Offseason')
        ));
    }

    // Bracket display
    const bracketContainer = el('div', { className: 'bracket-container' });
    const bracketEl = el('div', { className: 'bracket' });

    // For each conference
    for (const conf of ['East', 'West']) {
        const confSection = el('div', { style: { marginBottom: 'var(--space-xl)' } });
        confSection.appendChild(el('h3', { style: { marginBottom: 'var(--space-md)' } }, `${conf}ern Conference`));

        const confBracket = el('div', { className: 'bracket' });

        // Round 1
        const r1 = bracket.round1.filter(s => s.conference === conf);
        const r1Col = el('div', { className: 'bracket-round' });
        r1Col.appendChild(el('div', { className: 'bracket-round-title' }, 'First Round'));
        r1.forEach(s => r1Col.appendChild(renderSeriesCard(s, state)));
        confBracket.appendChild(r1Col);

        // Conf Semis
        const cs = bracket.confSemis.filter(s => s.conference === conf);
        const csCol = el('div', { className: 'bracket-round' });
        csCol.appendChild(el('div', { className: 'bracket-round-title' }, 'Conf. Semis'));
        if (cs.length > 0) {
            cs.forEach(s => csCol.appendChild(renderSeriesCard(s, state)));
        } else {
            csCol.appendChild(el('div', { className: 'series-card', style: { opacity: '0.3' } }, el('div', { className: 'series-team' }, 'TBD')));
        }
        confBracket.appendChild(csCol);

        // Conf Finals
        const cf = bracket.confFinals.filter(s => s.conference === conf);
        const cfCol = el('div', { className: 'bracket-round' });
        cfCol.appendChild(el('div', { className: 'bracket-round-title' }, 'Conf. Finals'));
        if (cf.length > 0) {
            cf.forEach(s => cfCol.appendChild(renderSeriesCard(s, state)));
        } else {
            cfCol.appendChild(el('div', { className: 'series-card', style: { opacity: '0.3' } }, el('div', { className: 'series-team' }, 'TBD')));
        }
        confBracket.appendChild(cfCol);

        confSection.appendChild(confBracket);
        page.appendChild(confSection);
    }

    // Finals
    if (bracket.finals) {
        const finalsSection = el('div', { style: { marginBottom: 'var(--space-xl)' } });
        finalsSection.appendChild(el('h3', { style: { marginBottom: 'var(--space-md)' } }, 'NBA Finals'));
        finalsSection.appendChild(renderSeriesCard(bracket.finals, state));
        page.appendChild(finalsSection);
    }

    // Sim buttons
    if (!isPlayoffsComplete()) {
        const controls = el('div', { className: 'sim-controls', style: { marginTop: 'var(--space-xl)' } });

        controls.appendChild(el('button', {
            className: 'btn btn-primary btn-lg',
            onclick: () => {
                const activeSeries = getActiveSeries();
                for (const series of activeSeries) {
                    simulatePlayoffGame(series);
                }
                advancePlayoffRound();
                render(container);
            }
        }, 'Sim Next Games'));

        controls.appendChild(el('button', {
            className: 'btn btn-warning',
            onclick: () => {
                let maxIterations = 200;
                while (!isPlayoffsComplete() && maxIterations > 0) {
                    const activeSeries = getActiveSeries();
                    for (const series of activeSeries) {
                        simulatePlayoffGame(series);
                    }
                    advancePlayoffRound();
                    maxIterations--;
                }
                render(container);
            }
        }, 'Sim All Playoffs'));

        page.appendChild(controls);
    }

    container.appendChild(page);
}

function renderSeriesCard(series, state) {
    const card = el('div', { className: 'series-card' });
    const meta1 = TEAMS[series.team1];
    const meta2 = TEAMS[series.team2];

    const team1Row = el('div', { className: `series-team ${series.winner === series.team1 ? 'winner' : ''}` });
    const name1 = el('span', { style: { fontWeight: series.team1 === state.userTeamId ? '700' : '400' } });
    name1.style.color = series.team1 === state.userTeamId ? 'var(--accent)' : '';
    name1.textContent = meta1 ? `${meta1.city} ${meta1.name}` : series.team1;
    team1Row.appendChild(name1);
    team1Row.appendChild(el('span', { className: 'series-wins' }, `${series.team1Wins}`));

    const team2Row = el('div', { className: `series-team ${series.winner === series.team2 ? 'winner' : ''}` });
    const name2 = el('span', { style: { fontWeight: series.team2 === state.userTeamId ? '700' : '400' } });
    name2.style.color = series.team2 === state.userTeamId ? 'var(--accent)' : '';
    name2.textContent = meta2 ? `${meta2.city} ${meta2.name}` : series.team2;
    team2Row.appendChild(name2);
    team2Row.appendChild(el('span', { className: 'series-wins' }, `${series.team2Wins}`));

    card.appendChild(team1Row);
    card.appendChild(team2Row);

    return card;
}

export function destroy() {}

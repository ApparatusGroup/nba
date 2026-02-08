import { el, renderCard, renderStatBox, showToast } from '../renderer.js';
import { getState } from '../../core/game-state.js';
import { TEAMS } from '../../config/team-metadata.js';
import { navigate } from '../router.js';
import { renderNavbar } from '../components/navbar.js';
import { getUserNextGame, simToNextUserGame, simulateUserGame, simulateDay, startNewSeason, isSeasonComplete, checkSeasonEnd, simWeek, getSeasonProgress, runPlayIn, startOffseason, runOffseason } from '../../engine/season-manager.js';
import { formatRecord, formatStreak, formatLast10, getConferenceStandings, getWinPct } from '../../engine/standings-manager.js';
import { getPlayerSeasonAvg } from '../../stats/stat-tracker.js';
import { formatSalary } from '../../core/utils.js';
import { calculateTeamSalary, getCapSpace } from '../../systems/salary-cap.js';

export function render(container) {
    const state = getState();
    renderNavbar();

    if (state.phase === 'setup') {
        // Need to start a new season first
        startNewSeason();
    }

    const dashboard = el('div', { className: 'animate-fade-in' });

    // Stats row
    const team = state.teams[state.userTeamId];
    const teamMeta = TEAMS[state.userTeamId];
    const progress = getSeasonProgress();

    const statsRow = el('div', { className: 'stats-row' });
    statsRow.appendChild(renderStatBox('Record', team ? formatRecord(team) : '0-0'));
    statsRow.appendChild(renderStatBox('Win %', team ? (getWinPct(team) * 100).toFixed(1) + '%' : '0%'));
    statsRow.appendChild(renderStatBox('Streak', team ? formatStreak(team) : '-'));
    statsRow.appendChild(renderStatBox('Games', `${(team?.wins || 0) + (team?.losses || 0)}/82`));
    dashboard.appendChild(statsRow);

    const grid = el('div', { className: 'dashboard-grid' });

    // Left column
    const leftCol = el('div');

    // Next game card
    if (state.phase === 'regular') {
        const nextGame = getUserNextGame();
        if (nextGame) {
            const game = nextGame.game;
            const isHome = game.home === state.userTeamId;
            const oppId = isHome ? game.away : game.home;
            const oppMeta = TEAMS[oppId];
            const oppTeam = state.teams[oppId];

            const gameCard = el('div', { className: 'next-game-card' });
            gameCard.appendChild(el('div', { style: { textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' } },
                `Next Game - ${nextGame.day?.date || ''} ${isHome ? '(HOME)' : '(AWAY)'}`
            ));

            const matchup = el('div', { className: 'matchup' });

            const homeInfo = el('div', { className: 'team-info' });
            const homeAbbrEl = el('div', { className: 'team-abbr-big' }, isHome ? state.userTeamId : oppId);
            homeAbbrEl.style.color = isHome ? teamMeta.colors.primary : oppMeta.colors.primary;
            homeInfo.appendChild(homeAbbrEl);
            homeInfo.appendChild(el('div', { style: { color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' } },
                isHome ? formatRecord(team) : formatRecord(oppTeam)
            ));

            const vsEl = el('div', { className: 'vs' }, 'VS');

            const awayInfo = el('div', { className: 'team-info' });
            const awayAbbrEl = el('div', { className: 'team-abbr-big' }, isHome ? oppId : state.userTeamId);
            awayAbbrEl.style.color = isHome ? oppMeta.colors.primary : teamMeta.colors.primary;
            awayInfo.appendChild(awayAbbrEl);
            awayInfo.appendChild(el('div', { style: { color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' } },
                isHome ? formatRecord(oppTeam) : formatRecord(team)
            ));

            matchup.appendChild(homeInfo);
            matchup.appendChild(vsEl);
            matchup.appendChild(awayInfo);
            gameCard.appendChild(matchup);

            // Action buttons
            const actions = el('div', { className: 'quick-actions', style: { justifyContent: 'center' } });
            actions.appendChild(el('button', {
                className: 'btn btn-primary btn-lg',
                onclick: () => {
                    const result = simulateUserGame(game.id, true);
                    if (result) {
                        navigate(`/game-result/${game.id}`);
                        checkSeasonEnd();
                    }
                }
            }, 'Play Game'));
            actions.appendChild(el('button', {
                className: 'btn btn-outline',
                onclick: () => {
                    const result = simulateUserGame(game.id, false);
                    if (result) {
                        showToast(`${result.winner === state.userTeamId ? 'WIN' : 'LOSS'}: ${result.homeScore}-${result.awayScore}`, result.winner === state.userTeamId ? 'success' : 'error');
                        render(container);
                        checkSeasonEnd();
                    }
                }
            }, 'Quick Sim'));
            gameCard.appendChild(actions);

            leftCol.appendChild(gameCard);
        }

        // Sim controls
        const simControls = el('div', { className: 'card', style: { marginTop: 'var(--space-lg)' } });
        simControls.appendChild(el('h3', { className: 'card-title', style: { marginBottom: 'var(--space-md)' } }, 'Simulation'));

        const simBtns = el('div', { className: 'quick-actions' });
        simBtns.appendChild(el('button', { className: 'btn btn-outline', onclick: () => { simToNextUserGame(); render(container); } }, 'Sim to Next Game'));
        simBtns.appendChild(el('button', { className: 'btn btn-outline', onclick: () => { simWeek(); render(container); } }, 'Sim Week'));
        simBtns.appendChild(el('button', { className: 'btn btn-warning', onclick: () => {
            if (confirm('Simulate the rest of the regular season?')) {
                const complete = simRestOfRegularSeason();
                render(container);
            }
        }}, 'Sim Rest of Season'));
        simControls.appendChild(simBtns);

        // Season progress
        const progBar = el('div', { className: 'progress-bar', style: { marginTop: 'var(--space-md)' } });
        progBar.appendChild(el('div', { className: 'progress-bar-fill', style: { width: `${progress.pct * 100}%` } }));
        simControls.appendChild(progBar);
        simControls.appendChild(el('div', { style: { fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-xs)' } },
            `${progress.played} / ${progress.total} games played (${(progress.pct * 100).toFixed(0)}%)`
        ));

        leftCol.appendChild(simControls);
    }

    // Post-season / offseason controls
    if (state.phase === 'regular' && isSeasonComplete()) {
        const btn = el('button', { className: 'btn btn-primary btn-lg', onclick: () => { runPlayIn(); render(container); } }, 'Start Playoffs');
        leftCol.appendChild(el('div', { className: 'card', style: { marginTop: 'var(--space-lg)', textAlign: 'center' } }, btn));
    }

    if (state.phase === 'playIn') {
        const btn = el('button', { className: 'btn btn-primary btn-lg', onclick: () => { runPlayIn(); navigate('/playoffs'); } }, 'Run Play-In Tournament');
        leftCol.appendChild(el('div', { className: 'card', style: { marginTop: 'var(--space-lg)', textAlign: 'center' } }, btn));
    }

    if (state.phase === 'playoffs') {
        leftCol.appendChild(el('div', { className: 'card', style: { marginTop: 'var(--space-lg)', textAlign: 'center' } },
            el('button', { className: 'btn btn-primary btn-lg', onclick: () => navigate('/playoffs') }, 'Go to Playoffs')
        ));
    }

    if (state.phase === 'offseason') {
        const offseasonCard = el('div', { className: 'card', style: { marginTop: 'var(--space-lg)', textAlign: 'center' } });
        offseasonCard.appendChild(el('h3', {}, 'Offseason'));
        offseasonCard.appendChild(el('button', { className: 'btn btn-primary btn-lg', style: { marginTop: 'var(--space-md)' }, onclick: () => {
            runOffseason();
            startNewSeason();
            render(container);
            showToast('New season started!', 'success');
        } }, 'Advance to Next Season'));
        leftCol.appendChild(offseasonCard);
    }

    grid.appendChild(leftCol);

    // Right column
    const rightCol = el('div');

    // Team info
    const teamCard = renderCard(`${teamMeta.city} ${teamMeta.name}`, el('div'));
    const teamInfo = teamCard.querySelector('div:last-child');
    teamInfo.appendChild(el('div', { style: { fontSize: 'var(--font-sm)' } }, `Arena: ${teamMeta.arena}`));
    teamInfo.appendChild(el('div', { style: { fontSize: 'var(--font-sm)' } }, `Payroll: ${formatSalary(calculateTeamSalary(state.userTeamId))}`));
    teamInfo.appendChild(el('div', { style: { fontSize: 'var(--font-sm)' } }, `Cap Space: ${formatSalary(getCapSpace(state.userTeamId))}`));
    teamInfo.appendChild(el('div', { style: { fontSize: 'var(--font-sm)' } }, `Conference: ${teamMeta.conference}ern`));
    teamInfo.appendChild(el('div', { style: { fontSize: 'var(--font-sm)' } }, `Division: ${teamMeta.division}`));
    rightCol.appendChild(teamCard);

    // Top performers
    if (team && team.roster) {
        const perfCard = renderCard('Top Performers', el('div'));
        const perfContent = perfCard.querySelector('div:last-child');

        const rosterAvgs = team.roster
            .map(pid => ({ player: state.players[pid], avg: getPlayerSeasonAvg(pid) }))
            .filter(x => x.player && x.avg)
            .sort((a, b) => parseFloat(b.avg.ppg) - parseFloat(a.avg.ppg))
            .slice(0, 5);

        if (rosterAvgs.length > 0) {
            rosterAvgs.forEach(({ player, avg }) => {
                const row = el('div', { style: { display: 'flex', justifyContent: 'space-between', padding: 'var(--space-xs) 0', fontSize: 'var(--font-sm)', borderBottom: '1px solid var(--border-color)' } });
                row.appendChild(el('span', { style: { fontWeight: '600' } }, `${player.firstName.charAt(0)}. ${player.lastName}`));
                row.appendChild(el('span', { className: 'text-muted' }, `${avg.ppg}p ${avg.rpg}r ${avg.apg}a`));
                perfContent.appendChild(row);
            });
        } else {
            perfContent.appendChild(el('div', { className: 'text-muted', style: { fontSize: 'var(--font-sm)' } }, 'No stats yet'));
        }

        rightCol.appendChild(el('div', { style: { marginTop: 'var(--space-lg)' } }, perfCard));
    }

    // Recent news
    const newsCard = renderCard('News', el('div'));
    const newsContent = newsCard.querySelector('div:last-child');
    const news = state.newsLog.slice(0, 8);
    if (news.length > 0) {
        news.forEach(item => {
            const row = el('div', { style: { padding: 'var(--space-xs) 0', fontSize: 'var(--font-xs)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' } });
            row.textContent = item.text;
            newsContent.appendChild(row);
        });
    } else {
        newsContent.appendChild(el('div', { className: 'text-muted', style: { fontSize: 'var(--font-sm)' } }, 'No news yet'));
    }
    rightCol.appendChild(el('div', { style: { marginTop: 'var(--space-lg)' } }, newsCard));

    grid.appendChild(rightCol);
    dashboard.appendChild(grid);
    container.appendChild(dashboard);
}

function simRestOfRegularSeason() {
    let count = 0;
    while (!isSeasonComplete() && count < 2000) {
        simulateDay();
        count++;
    }
}

export function destroy() {}

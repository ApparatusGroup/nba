import { el, showToast } from '../renderer.js';
import { getState } from '../../core/game-state.js';
import { TEAMS } from '../../config/team-metadata.js';
import { renderNavbar } from '../components/navbar.js';
import { navigate } from '../router.js';
import { getUserNextGame, simulateUserGame, checkSeasonEnd } from '../../engine/season-manager.js';
import { formatRecord } from '../../engine/standings-manager.js';

export function render(container) {
    const state = getState();
    renderNavbar('Game Day');

    const page = el('div', { className: 'game-sim-container animate-fade-in' });
    const nextGame = getUserNextGame();

    if (!nextGame) {
        page.appendChild(el('div', { className: 'empty-state' },
            el('h3', {}, 'No upcoming games'),
            el('p', {}, 'The season may be complete.')
        ));
        container.appendChild(page);
        return;
    }

    const game = nextGame.game;
    const isHome = game.home === state.userTeamId;
    const oppId = isHome ? game.away : game.home;
    const oppMeta = TEAMS[oppId];
    const userMeta = TEAMS[state.userTeamId];
    const userTeam = state.teams[state.userTeamId];
    const oppTeam = state.teams[oppId];

    // Scoreboard pre-game
    const scoreboard = el('div', { className: 'scoreboard' });

    const awaySide = el('div', { className: 'team-side' });
    const awayAbbr = el('div', { className: 'team-abbr' }, isHome ? oppId : state.userTeamId);
    awayAbbr.style.color = isHome ? oppMeta.colors.primary : userMeta.colors.primary;
    awaySide.appendChild(awayAbbr);
    awaySide.appendChild(el('div', { className: 'team-record' },
        `${isHome ? oppMeta.name : userMeta.name} (${formatRecord(isHome ? oppTeam : userTeam)})`
    ));

    const gameInfo = el('div', { className: 'game-info' });
    gameInfo.appendChild(el('div', { className: 'quarter' }, nextGame.day?.date || ''));
    gameInfo.appendChild(el('div', { style: { fontSize: 'var(--font-sm)', color: 'var(--text-muted)' } }, isHome ? 'HOME' : 'AWAY'));
    gameInfo.appendChild(el('div', { style: { fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-xs)' } },
        isHome ? userMeta.arena : oppMeta.arena
    ));

    const homeSide = el('div', { className: 'team-side' });
    const homeAbbr = el('div', { className: 'team-abbr' }, isHome ? state.userTeamId : oppId);
    homeAbbr.style.color = isHome ? userMeta.colors.primary : oppMeta.colors.primary;
    homeSide.appendChild(homeAbbr);
    homeSide.appendChild(el('div', { className: 'team-record' },
        `${isHome ? userMeta.name : oppMeta.name} (${formatRecord(isHome ? userTeam : oppTeam)})`
    ));

    scoreboard.appendChild(awaySide);
    scoreboard.appendChild(gameInfo);
    scoreboard.appendChild(homeSide);
    page.appendChild(scoreboard);

    // Action buttons
    const actions = el('div', { className: 'sim-controls' });

    actions.appendChild(el('button', {
        className: 'btn btn-primary btn-lg',
        onclick: () => {
            const result = simulateUserGame(game.id, true);
            if (result) {
                showGameResult(page, result, state);
                checkSeasonEnd();
            }
        }
    }, 'Play Game (Live Sim)'));

    actions.appendChild(el('button', {
        className: 'btn btn-outline btn-lg',
        onclick: () => {
            const result = simulateUserGame(game.id, false);
            if (result) {
                showGameResult(page, result, state);
                checkSeasonEnd();
            }
        }
    }, 'Quick Sim'));

    page.appendChild(actions);

    // Matchup preview
    const preview = el('div', { className: 'card', style: { marginTop: 'var(--space-lg)' } });
    preview.appendChild(el('h3', { className: 'card-title mb-md' }, 'Starting Lineups'));

    const lineupGrid = el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' } });

    [state.userTeamId, oppId].forEach(tid => {
        const col = el('div');
        const meta = TEAMS[tid];
        col.appendChild(el('h4', { style: { marginBottom: 'var(--space-sm)', color: meta.colors.primary } }, meta.name));

        const team = state.teams[tid];
        const starters = (team?.starters || team?.roster?.slice(0, 5) || []);

        starters.forEach(pid => {
            const p = state.players[pid];
            if (!p) return;
            const row = el('div', { style: { display: 'flex', justifyContent: 'space-between', padding: 'var(--space-xs) 0', fontSize: 'var(--font-sm)' } });
            row.appendChild(el('span', {}, `${p.position} - ${p.firstName} ${p.lastName}`));
            row.appendChild(el('span', { className: `rating-badge ${ratingClassForValue(p.ratings.overall)}`, style: { fontSize: 'var(--font-xs)' } }, `${p.ratings.overall}`));
            col.appendChild(row);
        });

        lineupGrid.appendChild(col);
    });

    preview.appendChild(lineupGrid);
    page.appendChild(preview);

    container.appendChild(page);
}

function ratingClassForValue(ovr) {
    if (ovr >= 90) return 'rating-elite';
    if (ovr >= 80) return 'rating-great';
    if (ovr >= 70) return 'rating-good';
    if (ovr >= 60) return 'rating-avg';
    return 'rating-below';
}

function showGameResult(page, result, state) {
    page.innerHTML = '';

    const scoreboard = el('div', { className: 'scoreboard' });
    const awayMeta = TEAMS[result.awayTeamId];
    const homeMeta = TEAMS[result.homeTeamId];

    const awaySide = el('div', { className: 'team-side' });
    const awayAbbr = el('div', { className: 'team-abbr' }, result.awayTeamId);
    awayAbbr.style.color = awayMeta.colors.primary;
    awaySide.appendChild(awayAbbr);
    awaySide.appendChild(el('div', { className: 'score' }, `${result.awayScore}`));

    const gameInfo = el('div', { className: 'game-info' });
    gameInfo.appendChild(el('div', { className: 'quarter', style: { color: 'var(--success)' } }, 'FINAL'));
    if (result.overtime > 0) gameInfo.appendChild(el('div', { style: { fontSize: 'var(--font-sm)', color: 'var(--text-muted)' } }, `(${result.overtime}OT)`));

    const homeSide = el('div', { className: 'team-side' });
    const homeAbbr = el('div', { className: 'team-abbr' }, result.homeTeamId);
    homeAbbr.style.color = homeMeta.colors.primary;
    homeSide.appendChild(homeAbbr);
    homeSide.appendChild(el('div', { className: 'score' }, `${result.homeScore}`));

    scoreboard.appendChild(awaySide);
    scoreboard.appendChild(gameInfo);
    scoreboard.appendChild(homeSide);
    page.appendChild(scoreboard);

    // Quarter scores
    const qScores = el('div', { className: 'quarter-scores' });
    const maxQ = Math.max(result.awayBox.quarterScores.length, result.homeBox.quarterScores.length);
    for (let i = 0; i < maxQ; i++) {
        qScores.appendChild(el('div', { className: 'q-score' },
            `Q${i + 1}: ${result.awayBox.quarterScores[i] || 0}-${result.homeBox.quarterScores[i] || 0}`
        ));
    }
    page.appendChild(qScores);

    // Win/loss message
    const userWon = result.winner === state.userTeamId;
    page.appendChild(el('div', {
        style: { textAlign: 'center', margin: 'var(--space-lg) 0', fontSize: 'var(--font-xl)', fontWeight: '800', color: userWon ? 'var(--success)' : 'var(--danger)' }
    }, userWon ? 'VICTORY!' : 'DEFEAT'));

    // Box score for both teams
    [result.awayBox, result.homeBox].forEach(box => {
        const teamMeta = TEAMS[box.teamId];
        const section = el('div', { className: 'box-score-team' });
        section.appendChild(el('h3', { style: { color: teamMeta.colors.primary } }, `${teamMeta.city} ${teamMeta.name} - ${box.totalScore} pts`));

        const rows = Object.entries(box.players)
            .map(([pid, stats]) => ({ player: state.players[pid], stats }))
            .filter(r => r.player && r.stats.min > 0)
            .sort((a, b) => b.stats.min - a.stats.min);

        const table = el('table', { className: 'data-table' });
        const thead = el('thead');
        const headerRow = el('tr');
        ['Player', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TO', 'FG', '3P', 'FT'].forEach(h => {
            headerRow.appendChild(el('th', {}, h));
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = el('tbody');
        rows.forEach(({ player, stats }) => {
            const tr = el('tr');
            tr.appendChild(el('td', { style: { fontWeight: '600' } }, `${player.firstName.charAt(0)}. ${player.lastName}`));
            tr.appendChild(el('td', { className: 'num' }, Math.round(stats.min).toString()));
            tr.appendChild(el('td', { className: 'num', style: { fontWeight: '700' } }, stats.pts.toString()));
            tr.appendChild(el('td', { className: 'num' }, stats.reb.toString()));
            tr.appendChild(el('td', { className: 'num' }, stats.ast.toString()));
            tr.appendChild(el('td', { className: 'num' }, stats.stl.toString()));
            tr.appendChild(el('td', { className: 'num' }, stats.blk.toString()));
            tr.appendChild(el('td', { className: 'num' }, stats.to.toString()));
            tr.appendChild(el('td', { className: 'num' }, `${stats.fgm}-${stats.fga}`));
            tr.appendChild(el('td', { className: 'num' }, `${stats.tpm}-${stats.tpa}`));
            tr.appendChild(el('td', { className: 'num' }, `${stats.ftm}-${stats.fta}`));
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        section.appendChild(table);
        page.appendChild(section);
    });

    // Play-by-play
    if (result.playByPlay && result.playByPlay.length > 0) {
        const pbpSection = el('div', { style: { marginTop: 'var(--space-lg)' } });
        pbpSection.appendChild(el('h3', { className: 'mb-md' }, 'Play-by-Play'));
        const pbpDiv = el('div', { className: 'play-by-play' });

        result.playByPlay.slice(-50).forEach(play => {
            const playEl = el('div', { className: 'play' });
            playEl.appendChild(el('span', { className: 'play-time' }, `Q${play.quarter}`));
            playEl.appendChild(el('span', { className: 'play-score' }, `${play.awayScore}-${play.homeScore}`));
            playEl.appendChild(el('span', {}, play.text));
            pbpDiv.appendChild(playEl);
        });

        pbpSection.appendChild(pbpDiv);
        page.appendChild(pbpSection);
    }

    // Continue button
    page.appendChild(el('div', { style: { textAlign: 'center', marginTop: 'var(--space-xl)' } },
        el('button', { className: 'btn btn-primary btn-lg', onclick: () => navigate('/dashboard') }, 'Continue')
    ));
}

export function destroy() {}

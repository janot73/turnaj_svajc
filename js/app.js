class App {
    constructor() {
        this.db = new DB();
        this.engine = new SwissEngine(this.db);
        this.pairingView = new PairingView(this.db, this);
        this.printLogic = new PrintLogic(this.db);
        
        this.currentTourId = null;
        this.activeModalMatchId = null;

        this.initDOM();
        this.bindEvents();
        this.renderDashboard();
    }

    initDOM() {
        this.views = document.querySelectorAll('.view');
        this.themeToggle = document.getElementById('themeToggle');
    }

    bindEvents() {
        // Navigation links
        document.querySelectorAll('a[data-nav]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigate(el.dataset.nav);
            });
        });

        // Theme
        this.themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
        });

        // Dashboard
        document.getElementById('btn-new-tour').addEventListener('click', () => {
            const name = prompt('Názov turnaja:', 'Nový Turnaj ' + new Date().toLocaleDateString());
            if(name) {
                const tour = this.db.createTournament(name, 10);
                this.openTournament(tour.id);
            }
        });

        // Setup
        document.getElementById('add-player-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('player-name');
            const seedInput = document.getElementById('player-seed');
            this.db.addPlayer(this.currentTourId, nameInput.value, parseInt(seedInput.value) || 0);
            nameInput.value = ''; seedInput.value = '0';
            this.renderSetupPlayers();
        });

        document.getElementById('btn-start-tour').addEventListener('click', () => {
            const players = this.db.getPlayers(this.currentTourId);
            if(players.length < 2) {
                alert('Pre štart turnaja potrebujete aspoň 2 hráčov.');
                return;
            }
            const maxR = parseInt(document.getElementById('tour-max-rounds').value) || 5;
            this.db.updateTournament(this.currentTourId, { state: 'InProgress', max_rounds: maxR });
            this.openTournament(this.currentTourId);
        });

        // Active Tour
        document.getElementById('btn-next-round').addEventListener('click', () => {
             this.generateNextRound();
        });
        document.getElementById('btn-standings').addEventListener('click', () => {
             this.renderStandings();
             this.navigate('standings');
        });
        document.getElementById('standings-back').addEventListener('click', (e) => {
             e.preventDefault();
             this.navigate(this.db.getTournament(this.currentTourId).state === 'Draft' ? 'tour-setup' : 'tour-active');
        });
        document.getElementById('btn-print-standings').addEventListener('click', () => {
             const stats = this.engine.calculateStandings(this.currentTourId);
             const tourName = this.db.getTournament(this.currentTourId).name;
             const rounds = this.db.getRounds(this.currentTourId);
             const roundNum = rounds.length > 0 ? rounds[rounds.length - 1].number : 0;
             this.printLogic.generateStandingsDOM(tourName, stats, roundNum);
             this.printLogic.print();
        });

        // Modal (Score mapping)
        document.getElementById('btn-score-cancel').addEventListener('click', () => {
            document.getElementById('modal-overlay').style.display = 'none';
            document.getElementById('score-modal').style.display = 'none';
            this.activeModalMatchId = null;
        });

        document.getElementById('btn-score-save').addEventListener('click', () => {
            this.saveScore();
        });
    }

    navigate(viewId) {
        this.views.forEach(v => v.classList.remove('active'));
        const target = document.getElementById('view-' + viewId);
        if(target) target.classList.add('active');
    }

    renderDashboard() {
        const list = document.getElementById('tournaments-list');
        list.innerHTML = '';
        const tours = Object.values(this.db.data.tournaments);
        
        if (tours.length === 0) list.innerHTML = '<p class="text-muted">Nemáte zatiaľ žiadne turnaje.</p>';
        tours.forEach(tour => {
             const card = document.createElement('div');
             card.className = 'card';
             card.innerHTML = `
                <h3>${tour.name}</h3>
                <p class="text-muted">Stav: ${tour.state}</p>
                <div style="margin-top: 1rem; display: flex; justify-content: space-between;">
                    <button class="btn btn-primary btn-open">Otvoriť</button>
                    <button class="btn btn-danger btn-delete badge">Zmazať</button>
                </div>
             `;
             card.querySelector('.btn-open').addEventListener('click', () => this.openTournament(tour.id));
             card.querySelector('.btn-delete').addEventListener('click', () => {
                 if(confirm(`Naozaj chcete natrvalo zmazať turnaj "${tour.name}" a celú jeho históriu?`)) {
                     this.db.deleteTournament(tour.id);
                     this.renderDashboard();
                 }
             });
             list.appendChild(card);
        });
        this.navigate('dashboard');
    }

    openTournament(tourId) {
        this.currentTourId = tourId;
        const tour = this.db.getTournament(tourId);
        if (!tour) return;

        if (tour.state === 'Draft') {
            document.getElementById('tour-setup-title').innerText = tour.name;
            document.getElementById('tour-max-rounds').value = tour.max_rounds || 5;
            this.renderSetupPlayers();
            this.navigate('tour-setup');
        } else {
            document.getElementById('active-tour-title').innerHTML = `${tour.name} <span class="badge" style="font-size:0.6em; background: var(--c-surface); border: 1px solid var(--c-border); color: var(--c-text); vertical-align: middle; margin-left: 0.5rem; font-weight: normal;">Max. kôl: ${tour.max_rounds || 5}</span>`;
            this.renderActiveTournament();
            this.navigate('tour-active');
        }
    }

    renderSetupPlayers() {
        const list = document.getElementById('setup-player-list');
        list.innerHTML = '';
        const players = this.db.getPlayers(this.currentTourId);
        document.getElementById('player-count').innerText = players.length;
        
        // Logika pre odporúčaný počet kôl švajčiarskeho systému (log2 z počtu hráčov)
        const recSpan = document.getElementById('tour-rec-rounds');
        if (players.length >= 2) {
            const recommended = Math.max(1, Math.ceil(Math.log2(players.length)));
            recSpan.innerText = `Odporúča sa: ${recommended} kôl`;
        } else {
            recSpan.innerText = `Odporúča sa: zatiaľ neznáme`;
        }

        players.forEach(p => {
             const li = document.createElement('li');
             li.innerHTML = `
                <div style="display:flex; align-items:center; gap: 1rem; flex-wrap: wrap;">
                    <strong>${p.name}</strong>
                    <div style="display:flex; align-items:center; gap: 0.5rem; font-size: 0.9em;">
                        <label>Nasadenie:</label>
                        <input type="number" class="player-seed-edit" value="${p.seed_rating}" style="width: 70px; padding: 0.3rem; border-radius: 4px; border: 1px solid var(--c-border); background: var(--c-bg); color: var(--c-text);">
                    </div>
                </div>
                <button class="btn btn-danger btn-withdraw">Odobrať</button>
             `;
             li.querySelector('.btn-withdraw').addEventListener('click', () => {
                 this.db.withdrawPlayer(p.id);
                 this.renderSetupPlayers(); // re-render
             });
             li.querySelector('.player-seed-edit').addEventListener('change', (e) => {
                 this.db.updatePlayer(p.id, { seed_rating: parseInt(e.target.value) || 0 });
             });
             list.appendChild(li);
        });
    }

    renderActiveTournament() {
        const container = document.getElementById('rounds-container');
        container.innerHTML = '';
        
        const rounds = this.db.getRounds(this.currentTourId).sort((a,b) => b.number - a.number); // Najnovšie hore
        const players = this.db.getPlayers(this.currentTourId, true); // incl withdrawn
        const tour = this.db.getTournament(this.currentTourId);

        document.getElementById('btn-next-round').style.display = 'block';

        if(rounds.length === 0) {
            container.innerHTML = '<p class="text-muted">Zatiaľ žiadne kolá. Spustite generovanie priebehu.</p>';
            return;
        }

        rounds.forEach((round, i) => {
            const matches = this.db.getMatches(round.id);
            const rContainer = document.createElement('div');
            
            // Add Print and Accept buttons to active round
            if (round.status === 'Draft') {
                rContainer.innerHTML = `
                    <div style="margin-bottom: 0.5rem; display: flex; gap: 0.5rem;">
                         <button class="btn btn-secondary btn-print" data-rid="${round.id}">🖨️ Tlačiť Scorecards</button>
                         <button class="btn btn-success btn-accept" data-rid="${round.id}">✅ Schváliť Kolo (Koniec drag&drop)</button>
                    </div>
                `;
            } else if (round.status === 'InProgress' && i === 0) { // Only newest round can finish
                 rContainer.innerHTML = `
                    <div style="margin-bottom: 0.5rem;">
                         <button class="btn btn-primary btn-finish" data-rid="${round.id}">Zatvoriť kolo (Všetky výsl. zadané)</button>
                    </div>
                 `;
            }

            const mockInner = document.createElement('div');
            rContainer.appendChild(mockInner);
            container.appendChild(rContainer);

            this.pairingView.renderRoundMatches(mockInner, round, matches, players);

            // Bind actions dynamically for this round
            if(round.status === 'Draft') {
                document.getElementById('btn-next-round').style.display = 'none'; // nemoze spustit dalsie kym je toto draft

                rContainer.querySelector('.btn-print').addEventListener('click', () => {
                    this.printLogic.generateScorecardsDOM(tour.name, round.number, matches, players);
                    this.printLogic.print();
                });
                rContainer.querySelector('.btn-accept').addEventListener('click', () => {
                    this.db.updateRound(round.id, { status: 'InProgress' });
                    this.renderActiveTournament();
                });
            }
            if(round.status === 'InProgress') {
                 document.getElementById('btn-next-round').style.display = 'none';
                 if(rContainer.querySelector('.btn-finish')) {
                     rContainer.querySelector('.btn-finish').addEventListener('click', () => {
                         this.db.updateRound(round.id, { status: 'Finished' });
                         if (tour.max_rounds && round.number >= tour.max_rounds) {
                             this.db.updateTournament(this.currentTourId, { state: 'Dokončený' });
                         }
                         this.renderActiveTournament();
                     });
                 }
            }
        });
    }

    generateNextRound() {
        const rounds = this.db.getRounds(this.currentTourId);
        const lastRnd = rounds[rounds.length - 1];
        const tour = this.db.getTournament(this.currentTourId);
        
        if(lastRnd && lastRnd.status !== 'Finished') {
            alert('Predchádzajúce kolo musí byť zatvorené (Finished)!');
            return;
        }

        const newNum = lastRnd ? lastRnd.number + 1 : 1;
        
        if(tour.max_rounds && newNum > tour.max_rounds) {
            if(!confirm(`Pozor, turnaj mal nastavených iba ${tour.max_rounds} kôl. Naozaj chcete pridať extra kolo nad pôvodný plán?`)) {
                return;
            }
        }
        
        const pairs = this.engine.generateNextRound(this.currentTourId);
        if(!pairs || pairs.length === 0) {
            alert('Nedá sa vygenerovať kolo - nie sú aktívni hráči alebo kritická chyba systému.');
            return;
        }

        // Ak užívateľ manuálne potvrdil pridanie kola nad limit, udržíme turnaj InProgress
        this.db.updateTournament(this.currentTourId, { state: 'InProgress' });

        const roundData = this.db.createRound(this.currentTourId, newNum);
        pairs.forEach(pair => {
             this.db.createMatch(roundData.id, pair.p1, pair.p2);
        });

        this.renderActiveTournament();
    }

    openScoreModal(matchId) {
        const match = this.db.data.matches[matchId];
        const round = this.db.data.rounds[match.round_id];
        if (round.status === 'Draft' || round.status === 'Finished') return;

        this.activeModalMatchId = matchId;
        const p1 = this.db.data.players[match.p1_id];
        const p2 = match.p2_id ? this.db.data.players[match.p2_id] : { name: '[Voľný Žreb]' };

        document.getElementById('score-match-names').innerText = `${p1.name} vs ${p2.name}`;
        document.getElementById('score-name-a').innerText = p1.name;
        document.getElementById('score-name-b').innerText = p2.name;

        document.getElementById('input-sets-a').value = match.p1_sets;
        document.getElementById('input-points-a').value = match.p1_points;
        if(match.p2_id) {
            document.getElementById('input-sets-b').value = match.p2_sets;
            document.getElementById('input-points-b').value = match.p2_points;
            document.getElementById('input-sets-b').disabled = false;
            document.getElementById('input-points-b').disabled = false;
        } else {
             // Bye default win setup
             document.getElementById('input-sets-a').value = 3;
             document.getElementById('input-points-a').value = 0;
             document.getElementById('input-sets-b').value = 0;
             document.getElementById('input-points-b').value = 0;
             document.getElementById('input-sets-b').disabled = true;
             document.getElementById('input-points-b').disabled = true;
        }

        document.getElementById('modal-overlay').style.display = 'block';
        document.getElementById('score-modal').style.display = 'block';
    }

    saveScore() {
        if (!this.activeModalMatchId) return;

        const p1sets = parseInt(document.getElementById('input-sets-a').value) || 0;
        const p1pts = parseInt(document.getElementById('input-points-a').value) || 0;
        const p2sets = parseInt(document.getElementById('input-sets-b').value) || 0;
        const p2pts = parseInt(document.getElementById('input-points-b').value) || 0;

        this.db.updateMatch(this.activeModalMatchId, {
            p1_sets: p1sets, p1_points: p1pts,
            p2_sets: p2sets, p2_points: p2pts
        });

        document.getElementById('modal-overlay').style.display = 'none';
        document.getElementById('score-modal').style.display = 'none';
        this.activeModalMatchId = null;
        
        this.renderActiveTournament();
    }

    renderStandings() {
        const tbody = document.getElementById('standings-body');
        tbody.innerHTML = '';
        
        const rounds = this.db.getRounds(this.currentTourId);
        const roundNum = rounds.length > 0 ? rounds[rounds.length - 1].number : 0;
        const h2 = document.querySelector('#view-standings h2');
        if (h2) h2.innerText = `Priebežné poradie (po ${roundNum}. kole)`;
        
        // Compute current live standings
        const stats = this.engine.calculateStandings(this.currentTourId);
        
        stats.forEach((s, idx) => {
             const playerObj = this.db.data.players[s.id];
             const isWithdrawn = playerObj.status === 'Withdrawn';
             
             const tr = document.createElement('tr');
             if(isWithdrawn) tr.classList.add('withdrawn');
             
             tr.innerHTML = `
                <td><strong>${idx + 1}.</strong></td>
                <td>
                    ${s.name} ${isWithdrawn ? '(Odstúpil)' : ''}
                    <div style="font-size:0.7em;color:var(--c-text-muted)">Nasadenie: ${s.seed}</div>
                </td>
                <td style="font-weight:bold;color:var(--c-primary)">${s.points}</td>
                <td>${s.bh1.toFixed(1)}</td>
                <td>${s.setsWon} : ${s.setsLost} <span class="text-muted">(${s.setRatio.toFixed(2)})</span></td>
                <td>${s.pointsWon} : ${s.pointsLost} <span class="text-muted">(${s.pointRatio.toFixed(2)})</span></td>
                <td>
                    ${!isWithdrawn ? `<button class="btn btn-danger badge" onclick="window.dispatchEvent(new CustomEvent('app-withdraw', {detail:'${s.id}'}))">Withdraw</button>` : ''}
                </td>
             `;
             tbody.appendChild(tr);
        });
    }
}

// Instantiate App on load
document.addEventListener('DOMContentLoaded', () => {
    window.appInstance = new App();

    // Global listener for withdraw from standings table
    window.addEventListener('app-withdraw', (e) => {
        if(confirm('Naozaj odhlásiť hráča z ďalšieho žrebovania?')) {
            window.appInstance.db.withdrawPlayer(e.detail);
            window.appInstance.renderStandings(); // re-render immediate
        }
    });
});

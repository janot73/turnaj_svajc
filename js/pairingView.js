class PairingView {
    constructor(dbContainer, appReference) {
        this.db = dbContainer;
        this.app = appReference;
        this.draggedMatch = null;
        this.draggedPlayer = null; // { id, isP1 }
        this.draggedFromElement = null; // element representing player slot
    }

    renderRoundMatches(container, round, matches, players) {
        container.innerHTML = `
            <div class="round-card card" data-round-id="${round.id}">
                <div class="round-header">
                    <h3>Kolo ${round.number}</h3>
                    <div class="round-status badge ${round.status === 'Draft' ? 'badge-draft' : 'badge-active'}">${round.status}</div>
                </div>
                <div class="match-grid" id="grid-${round.id}"></div>
            </div>
        `;
        
        const grid = container.querySelector('.match-grid');
        const listContainer = document.createElement('div');
        listContainer.className = 'match-list-container';
        if (round.status !== 'Draft') {
            grid.style.display = 'none'; // Skryjeme grid
            container.appendChild(listContainer);
        }
        
        matches.forEach((match, index) => {
            const p1 = players.find(p => p.id === match.p1_id) || { name: 'Neznámy' };
            const p2 = match.p2_id ? players.find(p => p.id === match.p2_id) : { name: '[Voľný Žreb]' };
            
            if (round.status === 'Draft') {
                // Klasické DRAFT Grid zobrazenie (pre drag and drop)
                const matchEl = document.createElement('div');
                matchEl.className = 'match-item';
                matchEl.dataset.matchId = match.id;
                
                const p1Row = document.createElement('div');
                p1Row.className = 'match-player-row player-slot';
                p1Row.dataset.playerId = match.p1_id;
                p1Row.dataset.isP1 = "true";
                p1Row.draggable = true;
                p1Row.innerHTML = `<span>${p1.name}</span><span class="score-badge p1-score">${match.p1_sets}</span>`;
                
                const p2Row = document.createElement('div');
                p2Row.className = 'match-player-row player-slot';
                p2Row.dataset.playerId = match.p2_id || 'bye';
                p2Row.dataset.isP1 = "false";
                p2Row.draggable = !!match.p2_id;
                p2Row.innerHTML = `<span>${p2.name}</span><span class="score-badge p2-score">${match.p2_sets}</span>`;
                
                matchEl.appendChild(p1Row);
                matchEl.appendChild(p2Row);
                grid.appendChild(matchEl);
                
                this.attachDragEvents(p1Row, matchEl, round.id);
                if(match.p2_id) this.attachDragEvents(p2Row, matchEl, round.id);
            } else {
                const rowEl = document.createElement('div');
                const isBye = !match.p2_id;
                const disabled = isBye ? 'disabled' : '';
                
                const isFinished = (match.p1_sets >= 3 || match.p2_sets >= 3 || isBye);
                const bgStyle = isFinished ? 'background: rgba(16, 185, 129, 0.05); border-color: var(--c-success);' : 'background: var(--c-surface); border-color: var(--c-border);';
                
                rowEl.style.cssText = `display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: 0.5rem 1rem; margin-bottom: 0.5rem; border-radius: var(--radius-md); gap: 1rem; border-width: 1px; border-style: solid; transition: all 0.3s; ${bgStyle}`;
                
                rowEl.innerHTML = `
                    <div style="flex: 1; display:flex; align-items:center; gap: 0.5rem;">
                        <span style="font-size:0.85em; color:var(--c-text-muted);">Stôl:</span>
                        <input type="text" class="match-table-input" value="${match.table_name || (index + 1)}" style="width: 50px; padding: 0.2rem; border-radius:4px; border:1px solid var(--c-border); background:var(--c-bg); color:var(--c-text);" ${round.status === 'Finished' ? 'disabled' : ''}>
                    </div>
                    <div style="flex: 3; display: flex; align-items: center; justify-content: center; gap: 1rem; font-weight: 600;">
                        <span style="flex:1; text-align:right;">${p1.name}</span>
                        <div style="display:flex; flex-direction:column; align-items:center; gap:0.4rem;">
                            <div style="display:flex; gap: 0.2rem;" class="sets-row">
                                ${[0,1,2,3,4].map(i => `<input type="text" class="set-score-inp" data-idx="${i}" value="${(match.set_scores || ['', '', '', '', ''])[i] || ''}" placeholder="x" style="width:40px; text-align:center; padding:0.2rem; border-radius:4px; border:1px solid var(--c-border); background:var(--c-bg); color:var(--c-text); font-size:0.9em;" ${disabled || round.status === 'Finished' ? 'disabled' : ''}>`).join('')}
                            </div>
                            <div style="font-size:0.85em; color:var(--c-primary);" class="calc-tot">
                                Sety: <span class="c-sets">${isBye ? '3 : 0' : `${match.p1_sets} : ${match.p2_sets}`}</span> 
                                <span class="text-muted" style="font-size:0.8em;">(${isBye ? '33:0' : `${match.p1_points}:${match.p2_points}`})</span>
                            </div>
                        </div>
                        <span style="flex:1; text-align:left;">${p2.name} ${isBye ? '(Bye)' : ''}</span>
                    </div>
                    <div style="flex: 1; text-align: right;">
                        <span class="save-status" style="opacity:0; transition:opacity 0.3s; font-size:0.85em; color:var(--c-success); font-weight:bold;">✓ Uložené</span>
                    </div>
                `;
                
                if (round.status === 'InProgress' && !isBye) {
                    const inps = rowEl.querySelectorAll('.set-score-inp');
                    const tableInp = rowEl.querySelector('.match-table-input');
                    const saveStatus = rowEl.querySelector('.save-status');
                    
                    const saveMatchData = () => {
                        let sets1 = 0, sets2 = 0, pts1 = 0, pts2 = 0;
                        let ssc = ['', '', '', '', ''];
                        
                        inps.forEach((inp, i) => {
                            ssc[i] = inp.value;
                            let res = this.parseSetScoreInput(inp.value);
                            if(res) {
                                pts1 += res.p1;
                                pts2 += res.p2;
                                if(res.p1 > res.p2) sets1++;
                                else if(res.p2 > res.p1) sets2++;
                            }
                        });
                        
                        // Update DOM calculations
                        rowEl.querySelector('.c-sets').innerText = `${sets1} : ${sets2}`;
                        rowEl.querySelector('.calc-tot .text-muted').innerText = `(${pts1}:${pts2})`;
                        
                        // Update colors if finished
                        const finished = (sets1 >= 3 || sets2 >= 3);
                        if (finished) {
                            rowEl.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';
                            rowEl.style.borderColor = 'var(--c-success)';
                        } else {
                            rowEl.style.backgroundColor = 'var(--c-surface)';
                            rowEl.style.borderColor = 'var(--c-border)';
                        }

                        // Save to DB
                        this.db.updateMatch(match.id, {
                            table_name: tableInp.value,
                            p1_sets: sets1,
                            p2_sets: sets2,
                            p1_points: pts1,
                            p2_points: pts2,
                            set_scores: ssc
                        });
                        
                        // Status flash
                        saveStatus.style.opacity = 1;
                        clearTimeout(rowEl.fadeTimer);
                        rowEl.fadeTimer = setTimeout(() => saveStatus.style.opacity = 0, 1500);
                    };

                    // Bind events for auto-save
                    inps.forEach(inp => {
                        inp.addEventListener('input', saveMatchData);
                    });
                    tableInp.addEventListener('input', saveMatchData);
                }
                listContainer.appendChild(rowEl);
            }
        });
    }

    attachDragEvents(slotEl, matchEl, roundId) {
        slotEl.addEventListener('dragstart', (e) => {
            this.draggedMatch = matchEl.dataset.matchId;
            this.draggedPlayer = {
                id: slotEl.dataset.playerId,
                isP1: slotEl.dataset.isP1 === "true"
            };
            this.draggedFromElement = slotEl;
            e.dataTransfer.setData('text/plain', slotEl.dataset.playerId);
            slotEl.parentElement.classList.add('dragging');
        });

        slotEl.addEventListener('dragend', () => {
            document.querySelectorAll('.match-item').forEach(el => {
                el.classList.remove('drag-over', 'drag-invalid', 'dragging');
            });
            this.draggedMatch = null;
            this.draggedPlayer = null;
        });

        slotEl.addEventListener('dragover', (e) => {
            e.preventDefault(); // allow drop
            const targetMatchItem = slotEl.closest('.match-item');
            if (targetMatchItem.dataset.matchId !== this.draggedMatch) {
                targetMatchItem.classList.add('drag-over');
                
                // Real-time collision check visual
                const targetMatchId = targetMatchItem.dataset.matchId;
                const playerAid = this.draggedPlayer.id;
                const playerBid = slotEl.dataset.playerId;
                
                const m1 = this.db.getMatches(roundId).find(m => m.id === this.draggedMatch);
                const m2 = this.db.getMatches(roundId).find(m => m.id === targetMatchId);
                
                if (m1 && m2) {
                    const oppA = this.draggedPlayer.isP1 ? m1.p2_id : m1.p1_id;
                    const targetIsP1 = slotEl.dataset.isP1 === "true";
                    const oppB = targetIsP1 ? m2.p2_id : m2.p1_id;
                    
                    const hasCol1 = oppB && oppB !== 'bye' ? this.checkCollision(playerAid, oppB, roundId) : false;
                    const hasCol2 = oppA && oppA !== 'bye' ? this.checkCollision(playerBid, oppA, roundId) : false;

                    if(hasCol1 || hasCol2) {
                       targetMatchItem.classList.add('drag-invalid');
                    } else {
                       targetMatchItem.classList.remove('drag-invalid');
                    }
                }
            }
        });

        slotEl.addEventListener('dragleave', (e) => {
             const targetMatchItem = slotEl.closest('.match-item');
             targetMatchItem.classList.remove('drag-over', 'drag-invalid');
        });

        slotEl.addEventListener('drop', (e) => {
            e.preventDefault();
            const targetMatchItem = slotEl.closest('.match-item');
            const targetMatchId = targetMatchItem.dataset.matchId;
            
            if (targetMatchId === this.draggedMatch) return; // Same match
            
            const playerAid = this.draggedPlayer.id;
            const playerBid = slotEl.dataset.playerId;
            
            if (playerBid === 'bye') return; // For simplicity, don't allow dropping onto a bye directly without special logic

            const m1 = this.db.getMatches(roundId).find(m => m.id === this.draggedMatch);
            const m2 = this.db.getMatches(roundId).find(m => m.id === targetMatchId);
            
            const targetIsP1 = slotEl.dataset.isP1 === "true";
            const oppA = this.draggedPlayer.isP1 ? m1.p2_id : m1.p1_id;
            const oppB = targetIsP1 ? m2.p2_id : m2.p1_id;

            // Check collision warning against their NEW opponents
            const hasCol1 = oppB && oppB !== 'bye' ? this.checkCollision(playerAid, oppB, roundId) : false;
            const hasCol2 = oppA && oppA !== 'bye' ? this.checkCollision(playerBid, oppA, roundId) : false;

            if (hasCol1 || hasCol2) {
                if(!confirm('POZOR: Nateraz vytvárate zápas pre hráčov, ktorí už spolu hrali! Skutočne ich chcete prejsť švajčiarsky systém?')) {
                    return; // user cancelled
                }
            }

            // Perform Swap in DB
            this.swapPlayersInMatches(this.draggedMatch, this.draggedPlayer.isP1, targetMatchId, targetIsP1);
        });
    }

    checkCollision(pidA, pidB, roundId) {
        // Získame históriu hráča z enginu (pre zjednodušenie si ju generujeme)
        const standings = this.app.engine.calculateStandings(this.app.currentTourId);
        const playerAStats = standings.find(s => s.id === pidA);
        
        if(playerAStats) {
            const hasPlayed = playerAStats.history.some(h => h.oppId === pidB);
            if (hasPlayed) return true; // Hrali spolu
        }
        return false;
    }

    swapPlayersInMatches(mId1, isP1_1, mId2, isP1_2) {
        const m1 = this.db.getMatches(this.db.data.matches[mId1].round_id).find(m => m.id === mId1);
        const m2 = this.db.getMatches(this.db.data.matches[mId2].round_id).find(m => m.id === mId2);

        const val1 = isP1_1 ? m1.p1_id : m1.p2_id;
        const val2 = isP1_2 ? m2.p1_id : m2.p2_id;

        // update memory
        if(isP1_1) m1.p1_id = val2; else m1.p2_id = val2;
        if(isP1_2) m2.p1_id = val1; else m2.p2_id = val1;

        this.db.updateMatch(m1.id, m1);
        this.db.updateMatch(m2.id, m2);

        // Re-render
        this.app.renderActiveTournament();
    }

    parseSetScoreInput(inputStr) {
        if(!inputStr) return null;
        let s = inputStr.toString().trim();
        if(!s) return null;
        
        if(s.includes(':')) {
            let parts = s.split(':');
            let p1 = parseInt(parts[0]);
            let p2 = parseInt(parts[1]);
            if(!isNaN(p1) && !isNaN(p2)) return { p1, p2 };
            return null;
        }
        
        let num = parseInt(s);
        if(isNaN(num)) return null;
        
        let isP2Win = s.startsWith('-');
        let loserScore = Math.abs(num);
        let winnerScore = loserScore < 10 ? 11 : loserScore + 2;
        
        if (isP2Win) {
            return { p1: loserScore, p2: winnerScore };
        } else {
            return { p1: winnerScore, p2: loserScore };
        }
    }
}

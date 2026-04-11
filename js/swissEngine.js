class SwissEngine {
    constructor(db) {
        this.db = db;
    }

    // FÁZA 1: Výpočet priebežného poradia
    calculateStandings(tourId) {
        const players = this.db.getPlayers(tourId, false); // only active
        const rounds = this.db.getRounds(tourId).filter(r => r.status === 'Finished' || r.status === 'InProgress');
        const matches = this.db.getAllTourMatches(tourId);
        
        let stats = {};
        players.forEach(p => {
            stats[p.id] = {
                id: p.id,
                name: p.name,
                seed: p.seed_rating,
                history: [], // { oppId, roundNum }
                points: 0,
                setsWon: 0, setsLost: 0,
                pointsWon: 0, pointsLost: 0,
                byes: [], // { roundNum, spr }
                pointsAfterRound: {} // to calculate SPR
            };
            stats[p.id].pointsAfterRound[0] = 0; // init
        });

        const n = rounds.length;

        // Process rounds chronologically to properly assign SPR for Byes
        rounds.forEach(round => {
            const rNum = round.number;
            const rMatches = matches.filter(m => m.round_id === round.id);
            
            rMatches.forEach(m => {
                if(m.p1_id && stats[m.p1_id]) {
                    if(!m.p2_id) {
                        // Meno Bye
                        stats[m.p1_id].points += 1;
                        stats[m.p1_id].byes.push({ roundNum: rNum, spr: stats[m.p1_id].pointsAfterRound[rNum - 1] || 0 });
                    } else if(stats[m.p2_id]) {
                        // Normal match
                        stats[m.p1_id].history.push({ oppId: m.p2_id, roundNum: rNum });
                        stats[m.p2_id].history.push({ oppId: m.p1_id, roundNum: rNum });
                        
                        stats[m.p1_id].setsWon += m.p1_sets;
                        stats[m.p1_id].setsLost += m.p2_sets;
                        stats[m.p2_id].setsWon += m.p2_sets;
                        stats[m.p2_id].setsLost += m.p1_sets;

                        stats[m.p1_id].pointsWon += m.p1_points;
                        stats[m.p1_id].pointsLost += m.p2_points;
                        stats[m.p2_id].pointsWon += m.p2_points;
                        stats[m.p2_id].pointsLost += m.p1_points;

                        // Winner determination (table tennis logic)
                        if(m.p1_sets > m.p2_sets) stats[m.p1_id].points += 1;
                        else if (m.p2_sets > m.p1_sets) stats[m.p2_id].points += 1;
                        else {
                            // in case of draw or unfinished
                             if(m.p1_points > m.p2_points) stats[m.p1_id].points += 1;
                             else if (m.p2_points > m.p1_points) stats[m.p2_id].points += 1;
                        }
                    }
                }
            });
            // Uložiť body po kole
            Object.keys(stats).forEach(pid => {
                stats[pid].pointsAfterRound[rNum] = stats[pid].points;
            });
        });

        // Vypočítať Buchholz Cut 1 pre každého
        Object.keys(stats).forEach(pid => {
            let s = stats[pid];
            let oppScores = [];
            
            // Reálni oponenti
            s.history.forEach(h => {
                if(stats[h.oppId]) {
                    oppScores.push(stats[h.oppId].points);
                }
            });
            
            // Virtuálni oponenti (Byes)
            s.byes.forEach(b => {
                let svon = b.spr + 0.5 * (n - b.roundNum);
                oppScores.push(svon);
            });

            if (oppScores.length > 1) {
                // Cut 1 = odobrať jedno minimum
                let min = Math.min(...oppScores);
                const minIdx = oppScores.indexOf(min);
                oppScores.splice(minIdx, 1);
            }
            s.bh1 = oppScores.reduce((sum, val) => sum + val, 0);

            // Ratios
            // Ratios
            s.setRatio = s.setsLost === 0 ? (s.setsWon > 0 ? 9999 + s.setsWon : 0) : s.setsWon / s.setsLost;
            s.pointRatio = s.pointsLost === 0 ? (s.pointsWon > 0 ? 9999 + s.pointsWon : 0) : s.pointsWon / s.pointsLost;
        });

        // Zoradenie: Body -> Buchholz Cut 1 -> Set Ratio -> Point Ratio -> Nasadenie (Seed)
        let sorted = Object.values(stats);
        sorted.sort((a, b) => {
            if(b.points !== a.points) return b.points - a.points;
            if(b.bh1 !== a.bh1) return b.bh1 - a.bh1;
            if(b.setRatio !== a.setRatio) return b.setRatio - a.setRatio;
            if(b.pointRatio !== a.pointRatio) return b.pointRatio - a.pointRatio;
            return b.seed - a.seed;
        });

        return sorted; // [{id, points, bh1, setRatio, pointRatio, name, ...}]
    }

    // API pre generovanie kôl
    generateNextRound(tourId) {
        const standings = this.calculateStandings(tourId);
        if (standings.length === 0) return null;
        
        let pool = [...standings]; // kópia
        let pairs = []; // { p1: id, p2: id }
        let byesGranted = 0;

        // FÁZA 2: Parity (Bye)
        if (pool.length % 2 !== 0) {
            // Hľadanie bye odspodu
            for (let i = pool.length - 1; i >= 0; i--) {
                const player = pool[i];
                if (player.byes.length === 0) { // Received_Bye == False
                    pairs.push({ p1: player.id, p2: null });
                    pool.splice(i, 1);
                    byesGranted++;
                    break;
                }
            }
            // Fallback ak chybou všetci mali Bye
            if (byesGranted === 0 && pool.length > 0) {
                pairs.push({ p1: pool[pool.length-1].id, p2: null });
                pool.pop();
            }
        }

        // FÁZA 3: Monrad + Backtracking
        const result = this.backtrackMatchmaking(pool, []);
        if (result !== null) {
            pairs = pairs.concat(result);
        } else {
            // Fallback ak systém absolútne zlyhá (naozaj nie je možné spárovať bez porušenia - stáva sa pri veľmi malom počte hráčov a veľa kolách)
            // fallback: greedy with collisions
            pairs = pairs.concat(this.greedyMatchmaking(pool));
        }

        return pairs;
    }

    // Backtracking párovanie (rekurzia)
    backtrackMatchmaking(pool, pairs) {
        if (pool.length === 0) return pairs; // Úspech

        // Zober prvého
        const pA = pool[0];
        
        // Hľadaj kompatibilného
        for (let i = 1; i < pool.length; i++) {
            const pB = pool[i];
            
            // Kolízny test
            const hasPlayed = pA.history.some(h => h.oppId === pB.id);
            if (!hasPlayed) {
                // Vytvor rezy (kopie poľa bez A a B)
                let nextPool = [...pool];
                nextPool.splice(i, 1); // vyber B
                nextPool.shift(); // vyber A

                let newPairs = [...pairs, { p1: pA.id, p2: pB.id }];

                let subResult = this.backtrackMatchmaking(nextPool, newPairs);
                if (subResult !== null) return subResult; // cesta nájdená
            }
        }

        return null; // Slepá ulička, backtrace
    }

    greedyMatchmaking(pool) {
        let pairs = [];
        let p = [...pool];
        while(p.length >= 2) {
            pairs.push({ p1: p[0].id, p2: p[1].id });
            p.splice(0,2);
        }
        return pairs;
    }
}

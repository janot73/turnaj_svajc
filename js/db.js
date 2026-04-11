class DB {
    constructor(prefix = 'svajciar_db') {
        this.prefix = prefix;
        this.load();
    }

    load() {
        const stored = localStorage.getItem(this.prefix);
        if (stored) {
            this.data = JSON.parse(stored);
        } else {
            this.data = {
                tournaments: {}, // { id: { id, name, max_rounds, state, tiebreak_config } }
                players: {},     // { id: { id, tour_id, name, seed_rating, status } }
                rounds: {},      // { id: { id, tour_id, number, status } }
                matches: {}      // { id: { id, round_id, p1_id, p2_id, p1_sets, p2_sets, p1_points, p2_points, is_forfeit } }
            };
            this.save();
        }
    }

    save() {
        localStorage.setItem(this.prefix, JSON.stringify(this.data));
    }

    uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // --- TOURNAMENTS ---
    createTournament(name, maxRounds, config = ["points", "buchholz", "setRank", "pointRank"]) {
        const id = this.uuid();
        this.data.tournaments[id] = {
            id,
            name,
            max_rounds: maxRounds,
            tiebreak_config: config,
            state: 'Draft' // Draft, InProgress, Finished
        };
        this.save();
        return this.data.tournaments[id];
    }

    getTournament(id) {
        return this.data.tournaments[id];
    }

    updateTournament(id, updates) {
        if (this.data.tournaments[id]) {
            Object.assign(this.data.tournaments[id], updates);
            this.save();
            return this.data.tournaments[id];
        }
        return null;
    }

    // --- PLAYERS ---
    addPlayer(tourId, name, seedRating) {
        const id = this.uuid();
        this.data.players[id] = {
            id,
            tour_id: tourId,
            name,
            seed_rating: seedRating,
            status: 'Active' // Active, Withdrawn
        };
        this.save();
        return this.data.players[id];
    }
    
    deleteTournament(tourId) {
        delete this.data.tournaments[tourId];
        let rIds = Object.keys(this.data.rounds).filter(rid => this.data.rounds[rid].tour_id === tourId);
        rIds.forEach(rid => {
            Object.keys(this.data.matches).forEach(mid => {
                if(this.data.matches[mid].round_id === rid) delete this.data.matches[mid];
            });
            delete this.data.rounds[rid];
        });
        Object.keys(this.data.players).forEach(pid => {
            if(this.data.players[pid].tour_id === tourId) delete this.data.players[pid];
        });
        this.save();
    }

    getPlayers(tourId, includeWithdrawn = true) {
        return Object.values(this.data.players).filter(p => 
            p.tour_id === tourId && (includeWithdrawn || p.status === 'Active')
        );
    }

    updatePlayer(id, updates) {
        if (this.data.players[id]) {
            Object.assign(this.data.players[id], updates);
            this.save();
            return this.data.players[id];
        }
        return null;
    }
    
    withdrawPlayer(id) {
        return this.updatePlayer(id, { status: 'Withdrawn' });
    }

    // --- ROUNDS ---
    createRound(tourId, number) {
        const id = this.uuid();
        this.data.rounds[id] = {
            id,
            tour_id: tourId,
            number,
            status: 'Draft' // Draft, MatchesGenerated, InProgress, Finished
        };
        this.save();
        return this.data.rounds[id];
    }

    getRounds(tourId) {
        return Object.values(this.data.rounds).filter(r => r.tour_id === tourId).sort((a,b) => a.number - b.number);
    }

    updateRound(id, updates) {
        if (this.data.rounds[id]) {
            Object.assign(this.data.rounds[id], updates);
            this.save();
            return this.data.rounds[id];
        }
        return null;
    }

    // --- MATCHES ---
    createMatch(roundId, p1Id, p2Id = null) {
        const id = this.uuid();
        this.data.matches[id] = {
            id,
            round_id: roundId,
            p1_id: p1Id,
            p2_id: p2Id, // null represents Bye
            p1_sets: 0,
            p2_sets: 0,
            p1_points: 0,
            p2_points: 0,
            table_name: '',
            set_scores: ['', '', '', '', ''],
            is_forfeit: false
        };
        this.save();
        return this.data.matches[id];
    }

    getMatches(roundId) {
        return Object.values(this.data.matches).filter(m => m.round_id === roundId);
    }
    
    getAllTourMatches(tourId) {
        // Získame najprv všetky id kôl daného turnaja
        const roundIds = this.getRounds(tourId).map(r => r.id);
        return Object.values(this.data.matches).filter(m => roundIds.includes(m.round_id));
    }

    updateMatch(id, updates) {
        if (this.data.matches[id]) {
            Object.assign(this.data.matches[id], updates);
            this.save();
            return this.data.matches[id];
        }
        return null;
    }
    
    clearMatches(roundId) {
        Object.keys(this.data.matches).forEach(key => {
            if (this.data.matches[key].round_id === roundId) {
                delete this.data.matches[key];
            }
        });
        this.save();
    }
}

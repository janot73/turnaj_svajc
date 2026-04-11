class PrintLogic {
    constructor(db) {
        this.db = db;
    }

    generateScorecardsDOM(tourName, roundNumber, matches, players) {
        const container = document.getElementById('print-container');
        container.innerHTML = '';
        
        matches.forEach((match, index) => {
            if(!match.p2_id) return; // Voľný žreb (Bye) sa netlačí
            
            const p1 = players.find(p => p.id === match.p1_id) || { name: 'Neznámy' };
            const p2 = players.find(p => p.id === match.p2_id) || { name: 'Neznámy' };
            
            const card = document.createElement('div');
            card.className = 'scorecard';
            
            card.innerHTML = `
                <div class="sc-header" style="font-size: 1.1em; padding-bottom: 8px; align-items: baseline;">
                    <span style="flex: 1;">${tourName}</span>
                    <span style="flex: 1; text-align: center; font-size: 1.3em; border: 1px solid #000; padding: 2px 8px; border-radius: 4px;">KOLO ${roundNumber}</span>
                    <span style="flex: 1; text-align: right; font-size: 1.2em;">Stôl: <strong>${match.table_name || (index + 1)}</strong></span>
                </div>
                <div class="sc-players" style="margin-top: 10px;">
                    <strong>${p1.name}</strong> vs <strong>${p2.name}</strong>
                </div>
                <table class="sc-table">
                    <thead>
                        <tr>
                            <th>Sety</th>
                            <th>1. Set</th>
                            <th>2. Set</th>
                            <th>3. Set</th>
                            <th>4. Set</th>
                            <th>5. Set</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>...</td>
                            <td></td><td></td><td></td><td></td><td></td>
                        </tr>
                        <tr>
                            <td>...</td>
                            <td></td><td></td><td></td><td></td><td></td>
                        </tr>
                    </tbody>
                </table>
                <div class="sc-signatures">
                    <div class="sc-sig-line">Podpis ${p1.name}</div>
                    <div class="sc-sig-line">Podpis ${p2.name}</div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    print() {
        window.print();
    }

    generateStandingsDOM(tourName, stats, roundNum) {
        const container = document.getElementById('print-container');
        
        let tbodyHtml = '';
        stats.forEach((s, idx) => {
            const isWithdrawn = this.db.data.players[s.id].status === 'Withdrawn';
            const sRatio = s.setRatio > 9999 ? 'MAX' : s.setRatio.toFixed(2);
            const pRatio = s.pointRatio > 9999 ? 'MAX' : s.pointRatio.toFixed(2);
            
            tbodyHtml += `
                <tr style="border-bottom: 1px solid #ddd; ${isWithdrawn ? 'color: #999;' : ''}">
                    <td style="border:1px solid #ccc; padding:8px;"><strong>${idx + 1}.</strong></td>
                    <td style="border:1px solid #ccc; padding:8px; text-align:left;">
                        <strong>${s.name}</strong> ${isWithdrawn ? '(Odstúpil)' : ''}
                        <div style="font-size:0.8em;color:#555;">Nasadenie: ${s.seed}</div>
                    </td>
                    <td style="border:1px solid #ccc; padding:8px; font-weight:bold;">${s.points}</td>
                    <td style="border:1px solid #ccc; padding:8px;">${s.bh1.toFixed(1)}</td>
                    <td style="border:1px solid #ccc; padding:8px;">${s.setsWon} : ${s.setsLost} <span style="font-size:0.8em;color:#555;">(${sRatio})</span></td>
                    <td style="border:1px solid #ccc; padding:8px;">${s.pointsWon} : ${s.pointsLost} <span style="font-size:0.8em;color:#555;">(${pRatio})</span></td>
                </tr>
            `;
        });

        container.innerHTML = `
            <div style="width:100%;">
                <h2 style="margin-bottom: 20px;">Priebežné poradie - ${tourName} (po ${roundNum}. kole)</h2>
                <table style="width:100%; border-collapse:collapse; margin-top:20px; font-size: 15px; text-align: center;">
                    <thead>
                        <tr style="background-color: #f3f4f6; color: #000;">
                            <th style="border:1px solid #ccc; padding:10px;">Por.</th>
                            <th style="border:1px solid #ccc; padding:10px; text-align:left;">Hráč</th>
                            <th style="border:1px solid #ccc; padding:10px;">Body</th>
                            <th style="border:1px solid #ccc; padding:10px;">BH-C1</th>
                            <th style="border:1px solid #ccc; padding:10px;">Sety</th>
                            <th style="border:1px solid #ccc; padding:10px;">Lopty</th>
                        </tr>
                    </thead>
                    <tbody style="color: #000;">
                        ${tbodyHtml}
                    </tbody>
                </table>
            </div>
        `;
    }
}

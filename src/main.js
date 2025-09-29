(function(){
    // ===== DOM Elements =====
    const lobbyContainer = document.getElementById('lobby-container');
    const gameContainer = document.getElementById('game-container');
    const btnShowHostSetup = document.getElementById('btnShowHostSetup');
    const btnShowClientSetup = document.getElementById('btnShowClientSetup');
    const initialOptions = document.getElementById('initial-options');
    const hostSetup = document.getElementById('host-setup');
    const clientSetup = document.getElementById('client-setup');
    const btnCancelHost = document.getElementById('btnCancelHost');
    const btnCancelJoin = document.getElementById('btnCancelJoin');
    const numPlayersEl = document.getElementById('numPlayers');
    const numAiEl = document.getElementById('numAi');
    const winTargetInputEl = document.getElementById('winTargetInput');
    const btnStartGame = document.getElementById('btnStartGame');
    const roomIdDisplay = document.getElementById('roomIdDisplay');
    const playerList = document.getElementById('player-list');
    const hostInfo = document.getElementById('host-info');
    const roomIdInput = document.getElementById('roomIdInput');
    const btnJoinGame = document.getElementById('btnJoinGame');
    const boardEl = document.getElementById('board');
    const playersEl = document.getElementById('players');
    const logEl = document.getElementById('log');
    const curPEl = document.getElementById('curP');
    const turnEl = document.getElementById('turn');
    const phaseEl = document.getElementById('phase');
    const btnRoll = document.getElementById('btnRoll');
    const btnBuy = document.getElementById('btnBuy');
    const btnInvest = document.getElementById('btnInvest');
    const btnMarket = document.getElementById('btnMarket');
    const btnEnd = document.getElementById('btnEnd');
    const btnReset = document.getElementById('btnReset');
    const btnTests = document.getElementById('btnTests');
    const playerIdEl = document.getElementById('playerId');
    const stockTable = document.getElementById('stockTable');
    const dlgAskTrade = document.getElementById('dlgAskTrade');
    const btnTradeYes = document.getElementById('btnTradeYes');
    const btnTradeNo = document.getElementById('btnTradeNo');
    const dlgBuy=document.getElementById('dlgBuy');
    const buyInfo=document.getElementById('buyInfo');
    const btnDoBuy=document.getElementById('btnDoBuy');
    const dlgInvest=document.getElementById('dlgInvest');
    const investInfo=document.getElementById('investInfo');
    const investAmt=document.getElementById('investAmt');
    const btnDoInvest=document.getElementById('btnDoInvest');
    const dlgMarket=document.getElementById('dlgMarket');
    const marketBody=document.getElementById('marketBody');
    const btnDoMarketBuy=document.getElementById('btnDoMarketBuy');
    const dlgCard=document.getElementById('dlgCard');
    const cardText=document.getElementById('cardText');
    const dlgFork=document.getElementById('dlgFork');
    const forkText=document.getElementById('forkText');
    const forkBtns=document.getElementById('forkBtns');

    // ===== Game State =====
    let game = {};
    let clientState = { playerId: null, roomId: null };

    // ===== Network Handlers =====
    network.on('message', (data) => {
        const { type, payload } = data;
        switch (type) {
            case 'roomCreated':
                clientState.roomId = payload.roomId;
                roomIdDisplay.textContent = payload.roomId;
                hostInfo.style.display = 'block';
                playerList.innerHTML = '<li>Player 1 (Host)</li>';
                btnStartGame.disabled = false;
                break;
            case 'assignPlayerId': clientState.playerId = payload.playerId; break;
            case 'playerJoined': updatePlayerList(payload.players); break;
            case 'playerLeft': updatePlayerList(payload.players); break;
            case 'gameStarted':
                game = payload.gameState;
                clientState.playerId = payload.playerId;
                playerIdEl.textContent = `You are ${game.players[clientState.playerId].name}`;
                lobbyContainer.style.display = 'none';
                gameContainer.style.display = 'block';
                logEl.innerHTML = '';
                renderBoard();
                refresh();
                break;
            case 'gameStateUpdate':
                const oldState = game;
                game = payload.gameState;
                handleStateUpdate(oldState, game);
                break;
            case 'error': alert(`Error: ${payload.message}`); break;
        }
    });

    function handleStateUpdate(oldState, newState) {
        refresh();
        if (newState.log.length > (oldState.log?.length ?? 0)) {
            const newMessages = newState.log.slice(oldState.log?.length ?? 0);
            newMessages.forEach(msg => log(msg));
        }
        if (newState.lastCard && newState.lastCard !== oldState.lastCard) {
            cardText.textContent = newState.lastCard;
            dlgCard.showModal();
        }
        const me = newState.players[clientState.playerId];
        const oldMe = oldState.players?.[clientState.playerId];
        if (me.pos === newState.bankIx && oldMe?.pos !== newState.bankIx && newState.phase === 'Action') {
            askTrade();
        }
        checkFork();
    }

    function checkFork() {
        if (game.pendingForkChoice && game.cur === clientState.playerId) {
            const p = game.players[game.cur];
            const options = game.pendingForkChoice.options;
            askFork(p.pos, options);
        }
    }

    function updatePlayerList(players) {
        playerList.innerHTML = players.map((name, i) => `<li>${name} ${i === 0 ? '(Host)' : ''}</li>`).join('');
    }

    // ===== Lobby UI Logic =====
    btnShowHostSetup.onclick = () => {
        initialOptions.style.display = 'none';
        hostSetup.style.display = 'block';
        network.connect();
        network.on('open', () => {
            clientState.playerId = 0;
            const settings = { numPlayers: +numPlayersEl.value, numAi: +numAiEl.value, winTarget: +winTargetInputEl.value };
            network.send('createRoom', settings);
        });
    };
    btnShowClientSetup.onclick = () => {
        initialOptions.style.display = 'none';
        clientSetup.style.display = 'block';
        network.connect();
    };
    function resetLobby() { /* ... */ }
    btnCancelHost.onclick = resetLobby;
    btnCancelJoin.onclick = resetLobby;
    btnStartGame.onclick = () => network.send('startGame');
    btnJoinGame.onclick = () => { const id = roomIdInput.value.toUpperCase(); if (id) network.send('joinRoom', { roomId: id }); };

    // ===== Game Action Emitters =====
    btnRoll.onclick = () => network.send('gameAction', { type: 'roll' });
    btnEnd.onclick = () => network.send('gameAction', { type: 'endTurn' });
    btnBuy.onclick = () => {
        const p = game.players[clientState.playerId];
        const t = game.tiles[p.pos];
        buyInfo.innerHTML = `<div>Buy <strong>${t.name}</strong> for <strong>${t.price}G</strong>?<br>Balance: ${p.cash}G → ${p.cash - t.price}G</div>`;
        dlgBuy.showModal();
    };
    btnDoBuy.onclick = () => { network.send('gameAction', { type: 'buy' }); dlgBuy.close(); };
    btnInvest.onclick = () => {
        const t = game.tiles[game.players[clientState.playerId].pos];
        investInfo.textContent = `${t.name} value ${t.price}G`;
        investAmt.value=100;
        dlgInvest.showModal();
    };
    btnDoInvest.onclick = () => { const amount = +investAmt.value; network.send('gameAction', { type: 'invest', payload: { amount } }); dlgInvest.close(); };
    btnMarket.onclick = () => {
        const p = game.players[clientState.playerId];
        marketBody.innerHTML = "";
        const districts = Object.keys(game.stocks);
        districts.forEach(d => {
            var row = document.createElement('tr');
            row.innerHTML = `<td>${d}</td><td>${game.stocks[d].price}</td><td>${p.stocks[d]}</td><td><input type="number" class="market-qty" data-district="${d}" value="0" step="10"></td>`;
            marketBody.appendChild(row);
        });
        dlgMarket.showModal();
    };
    btnDoMarketBuy.onclick = () => {
        const transactions = [];
        document.querySelectorAll('.market-qty').forEach(input => {
            const qty = parseInt(input.value, 10);
            if (isNaN(qty) || qty === 0) return;
            const dist = input.dataset.district;
            transactions.push({ dist, qty });
        });
        network.send('gameAction', { type: 'market', payload: { transactions } });
        dlgMarket.close();
    };
    btnReset.onclick = () => { if (clientState.playerId === 0 && confirm('Reset the game for everyone?')) network.send('gameAction', { type: 'reset' }); };
    playersEl.addEventListener('click', e => {
        if (e.target.classList.contains('btn-sell-prop')) {
            const tileIndex = e.target.dataset.ix;
            network.send('gameAction', { type: 'sellProperty', payload: { tileIndex } });
        }
    });

    // ===== Dialogs =====
    function askTrade() {
        if (game.cur !== clientState.playerId) return;
        dlgAskTrade.showModal();
        btnTradeYes.onclick = () => { dlgAskTrade.close(); btnMarket.click(); };
        btnTradeNo.onclick = () => dlgAskTrade.close();
    }

    async function askFork(curIx, options) {
        const a = game.tiles[curIx];
        const dirArrow = (a,b) => { var dr=b.r-a.r, dc=b.c-a.c; if(dr===0&&dc>0) return '→'; if(dr===0&&dc<0) return '←'; if(dc===0&&dr>0) return '↓'; if(dc===0&&dr<0) return '↑'; return '?'; };
        forkBtns.innerHTML = '';
        options.forEach(ix => {
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.textContent = dirArrow(a, game.tiles[ix]);
            btn.onclick = () => { dlgFork.close(); network.send('gameAction', { type: 'forkChoice', payload: { nextNode: ix } }); };
            forkBtns.appendChild(btn);
        });
        forkText.textContent = 'Which way?';
        dlgFork.showModal();
    }

    // ===== Renderers =====
    function log(msg){ logEl.innerHTML += `<p>${msg}</p>`; logEl.scrollTop = logEl.scrollHeight; }

    function renderBoard() {
        const COLS = 13, ROWS = 7;
        boardEl.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
        boardEl.style.gridTemplateRows = `repeat(${ROWS}, 1fr)`;
        boardEl.innerHTML = "";
        for (let i = 0; i < 42; i++) { // Assuming 42 tiles
            const t = game.tiles.find(tile => tile.ix === i);
            if (!t) continue;
            const el = document.createElement('div');
            el.className = 'tile ' + t.type + (t.fork ? ' fork' : '');
            el.dataset.ix = t.ix;
            el.style.gridRow = (t.r + 1);
            el.style.gridColumn = (t.c + 1);
            boardEl.appendChild(el);
        }
        const pawnsEl = document.createElement('div');
        pawnsEl.className = 'pawns';
        boardEl.appendChild(pawnsEl);
    }

    function tileCenter(ix) {
        var tile = boardEl.querySelector(`.tile[data-ix="${ix}"]`);
        if (!tile) return { left: 0, top: 0 };
        var br = boardEl.getBoundingClientRect(); var tr = tile.getBoundingClientRect();
        return {left: tr.left - br.left + tr.width/2, top: tr.top - br.top + tr.height/2};
    }

    function netWorth(p) {
        if (!p || !game.stocks) return 0;
        let total = p.cash;
        Object.keys(p.stocks).forEach(d => { total += p.stocks[d] * (game.stocks[d]?.price || 0); });
        const propsByDistrict = {};
        game.tiles.forEach(t => {
            if (t.type === 'prop' && t.owner === p.id) {
                if (!propsByDistrict[t.district]) propsByDistrict[t.district] = [];
                propsByDistrict[t.district].push(t);
            }
        });
        Object.keys(propsByDistrict).forEach(dist => {
            const props = propsByDistrict[dist];
            const n = props.length;
            const multiplier = 1 + (n - 1) * 0.25;
            props.forEach(prop => { total += prop.price * multiplier; });
        });
        return Math.round(total);
    }

    function refresh() {
        if (!game.players) return;
        const { players, cur, phase, turn, tiles, stocks, winner, SUITS, DISTRICTS } = game;
        const me = players[clientState.playerId];
        const currentPlayer = players[cur];

        // Update Tiles
        tiles.forEach(t => {
            const el = boardEl.querySelector(`.tile[data-ix="${t.ix}"]`);
            if (!el) return;

            const em = t.em ? `<span class="em">${t.em}</span>` : (t.fork ? '<span class="em">✳</span>' : '');
            let inner = `<span class="ix">#${t.ix}</span>`;
            if (t.type === 'prop') {
                const ownerName = t.owner == null ? '‐' : (players[t.owner] ? players[t.owner].name : '‐');
                inner += `<span class="owner">${ownerName}</span>`;
                inner += `<div class="toll">${Math.round(t.price / 4)}G</div>`;
            }
            const titleText = t.name || (t.type === 'free' ? (t.fork ? 'Fork' : '') : '');
            inner += `<div>${em}${titleText}</div>`;
            if (t.type === 'prop') {
                inner += `<span class="price">${t.price}G</span><span class="dmark">${t.district}</span>`;
            } else if (t.type === 'suit') {
                inner += `<span class="dmark">${t.suit}</span>`;
            }
            el.innerHTML = inner;

            el.classList.remove('own', 'foe');
            if (t.type === 'prop' && t.owner != null) {
                el.classList.add(t.owner === clientState.playerId ? 'own' : 'foe');
            }
        });

        // Update Pawns
        const pawnsEl = boardEl.querySelector('.pawns');
        if (pawnsEl) {
            pawnsEl.innerHTML = "";
            players.forEach(p => {
                if(p.out) return;
                var center=tileCenter(p.pos);
                var pw=document.createElement('div');
                pw.className='pawn'; pw.title=p.name; pw.style.background=p.color;
                pw.style.left=center.left+'px'; pw.style.top=center.top+'px';
                pawnsEl.appendChild(pw);
            });
        }

        // Update Sidebar
        curPEl.textContent = `${currentPlayer.name} (Lv.${currentPlayer.level})`;
        phaseEl.textContent = phase + (game.extraRollAvailable && !game.extraRollConsumed ? ' (Extra roll)' : '');
        turnEl.textContent = turn;

        // Update Player Cards
        playersEl.innerHTML="";
        players.forEach((p,i) => {
            const pc=document.createElement('div');
            pc.className='player-card'+(i===cur?' active':'');
            const nw = netWorth(p);
            let html = ``;
            html += `<div class="row" style="justify-content:space-between"><strong style="color:${p.color}">${p.name} ${p.isAi?'(AI)':''} ${p.id===clientState.playerId?'(You)':''}</strong><span class="money">${p.cash} G</span></div>`;
            html += `<div class="small">Pos: #${p.pos} / Lv.${p.level} ${p.out?' (Out)':''}</div>`;
            html += `<div class="small">Net Worth: <strong>${nw} G</strong></div>`;
            html += `<div class="suit-badges">${(SUITS || []).map(s => `<span style="opacity:${p.suits.includes(s)?1:.35}">${s}</span>`).join('')}</div>`;
            html += `<div class="small stocks-row">${(DISTRICTS || []).map(d => `${d}:${p.stocks[d]}`).join(' ')}</div>`;
            const props = game.tiles.filter(t => t.type === 'prop' && t.owner === p.id);
            html += `<details class="prop-details"><summary>Properties (${props.length})</summary>${props.map(t => `<div class="pill">${t.name} (${t.district}/${t.price}G)<button class="btn-sell-prop" data-ix="${t.ix}">Sell</button></div>`).join('') || '<div class="small">None</div>'}</details>`;
            pc.innerHTML = html;
            playersEl.appendChild(pc);
        });

        // Update Stock Table
        var table = '<thead><tr><th>District</th><th>Price</th><th>Issued</th>';
        players.forEach(p => { table += `<th>${p.name}</th>`; });
        table += '</tr></thead><tbody>';
        Object.keys(stocks).forEach(d => {
            table += `<tr><td>${d}</td><td>${stocks[d].price}</td><td>${stocks[d].issued}</td>`;
            players.forEach(p => { table += `<td>${p.stocks[d]}</td>`; });
            table += '</tr>';
        });
        table += '</tbody>';
        stockTable.innerHTML = table;

        // Update Buttons
        const isMyTurn = clientState.playerId === cur;
        const isGameOver = winner != null;
        const currentTile = tiles[currentPlayer.pos];
        btnRoll.disabled = isGameOver || !isMyTurn || phase !== 'Idle' || (game.rolledThisTurn && !(game.extraRollAvailable && !game.extraRollConsumed));
        btnBuy.disabled = isGameOver || !isMyTurn || !(currentTile.type==='prop' && currentTile.owner===null && me.cash>=currentTile.price);
        btnInvest.disabled = isGameOver || !isMyTurn || !(currentTile.type==='prop' && currentTile.owner===me.id);
        btnMarket.disabled = isGameOver || !isMyTurn;
        btnEnd.disabled = isGameOver || !isMyTurn || !game.rolledThisTurn;
        btnReset.disabled = clientState.playerId !== 0; // Host only
        
        if (isGameOver) {
            phaseEl.textContent = `Game Over! ${players[winner].name} wins!`;
        }
    }

    // Initial setup
    gameContainer.style.display = 'none';
    lobbyContainer.style.display = 'block';
})();
const SUITS = ["♠","♥","♦","♣"];
const DISTRICTS = ["A", "B", "C", "D", "E", "F", "G"];
const COLORS = ["#ff5e5e","#5ec6ff","#ffd05e","#a5ff5e"];
const MAP = [
    "######*######",
    "#.....#.....#",
    "#.....#.....#",
    "#.....#.....#",
    "#.....#.....#",
    "#.....#.....#",
    "######*######"
];

// ===== Venture Cards =====
const ventureCards = [
    {t:"Bonus +200G", fn:(gs,p) => changeCash(gs, p, +200)},
    {t:"Donation −150G", fn:(gs,p) => changeCash(gs, p, -150)},
    {t:"Roll again!", fn:(gs,p) => { gs.extraRollAvailable = true; gs.extraRollConsumed = false; log(gs, `${p.name} can roll once more this turn!`); }},
    {t:"Warp to Bank", fn:(gs,p) => { p.pos = gs.bankIx; log(gs, `${p.name} warped to the Bank!`); onLand(gs); }},
    {t:"Market Up: all districts +1", fn:(gs,p) => { DISTRICTS.forEach(d => gs.stocks[d].price++); log(gs, "All district stock prices rose by 1."); }},
    {t:"Market Down: all districts -1", fn:(gs,p) => { DISTRICTS.forEach(d => { gs.stocks[d].price = Math.max(1, gs.stocks[d].price - 1); }); log(gs, "All district stock prices fell by 1."); }},
    {t:"Free Invest: +200G", fn:(gs,p) => { const myProps = propsOwnedBy(gs,p); if(myProps.length){ const pr = myProps[Math.floor(Math.random()*myProps.length)]; investProperty(gs, p, pr, 200, true); } }},
    {t:"Tax Refund +100G", fn:(gs,p) => changeCash(gs,p,+100)},
    {t:"From Everyone: +50G each", fn:(gs,p) => { gs.players.forEach(q => { if(q!==p) transfer(gs,q,p,50); }); }},
    {t:"Toll Discount: next payment half", fn:(gs,p) => { p.halfToll=true; log(gs, `${p.name} will pay half toll next time.`); }},
    {t:"Dividend Boost: next rank-up x1.5", fn:(gs,p) => { p.bonusDivTimes=1.5; log(gs, `${p.name} will get a 1.5x dividend boost on rank up.`); }},
    {t:"Fixed Dice: next is 6", fn:(gs,p) => { p.nextRoll=6; log(gs, `${p.name}'s next roll will be a 6.`); }}
];

// ===== Game State Creation =====
function createInitialGameState(numHumans, numAi, winTarget) {
    const ROWS = MAP.length; const COLS = MAP[0].length;

    var nodes = [];
    var indexAt = Array.from({length:ROWS}, () => Array(COLS).fill(-1));
    for(var r=0;r<ROWS;r++){
        for(var c=0;c<COLS;c++){
            var ch = MAP[r][c];
            if(ch==="#" || ch==='*'){
                var ix = nodes.length; indexAt[r][c]=ix; nodes.push({r:r,c:c,kind:ch});
            }
        }
    }

    var adj = nodes.map(() => []);
    var deltas = [[-1,0],[1,0],[0,-1],[0,1]];
    nodes.forEach((n,ix) => {
        deltas.forEach(d => {
            var r2=n.r+d[0], c2=n.c+d[1]; if(r2<0||r2>=ROWS||c2<0||c2>=COLS) return;
            var jx=indexAt[r2][c2]; if(jx!==-1){ adj[ix].push(jx); }
        });
    });

    var tiles = nodes.map((n,ix) => ({ ix:ix, r:n.r, c:n.c, fork:(n.kind==='*'), type:'free', name:'', em:'', owner:null, price:0, district:null }));

    var bankIx = 20;
    tiles[bankIx].type = 'bank'; tiles[bankIx].name = 'Bank'; tiles[bankIx].em = '🏦';

    [0, 12, 28, 40].forEach((ix, i) => { tiles[ix].type = 'suit'; tiles[ix].name = `Suit (${SUITS[i]})`; tiles[ix].suit = SUITS[i]; });
    [3, 9, 21, 31, 37].forEach(ix => { tiles[ix].type = 'chance'; tiles[ix].name = 'Card'; tiles[ix].em = '❓'; });
    [6, 34].forEach(ix => { tiles[ix].type = 'tax'; tiles[ix].name = 'Tax'; tiles[ix].em = '💸'; tiles[ix].tax = 120; });
    [19].forEach(ix => { tiles[ix].type = 'rest'; tiles[ix].name = 'Rest'; tiles[ix].em = '◎'; });

    const districtLayout = { "A": [1, 2, 13, 16], "B": [4, 5, 7, 8], "C": [10, 11, 15, 18], "D": [24, 27, 38, 39], "E": [32, 33, 35, 36], "F": [22, 25, 29, 30], "G": [14, 17, 23, 26] };
    const propNames = ['Old Town','Willow Walk','Cherry Slope','Harbor Road','Warehouse Row','Dock Street','Hilltop','Lakeside','Windmill Way','Theater Row','Silver Street','Central Ave', 'Maple St', 'Oak Dr', 'Pine Ln', 'Elm Ct', 'Birch Rd', 'Cedar Ave', 'Spruce St', 'Aspen Ct', 'Main St', '2nd St', '3rd Ave', '4th Blvd', '5th Rd', '6th Ln', '7th Ct', '8th St'];
    let nameIdx = 0;
    Object.keys(districtLayout).forEach((distName, i) => {
        districtLayout[distName].forEach(ix => {
            if (tiles[ix].type === 'free') {
                tiles[ix].type = 'prop';
                tiles[ix].name = propNames[nameIdx++];
                tiles[ix].district = distName;
                tiles[ix].price = 100 + (i * 20);
            }
        });
    });

    let stocks = {};
    DISTRICTS.forEach(d => { stocks[d] = { price:10, issued:0 }; });

    const numPlayers = numHumans + numAi;
    let players = Array.from({length:numPlayers}, (_,i) => ({
        id:i, name:'P'+(i+1), color: COLORS[i%COLORS.length],
        cash: 2000, pos: bankIx, lastPos: bankIx, level:1,
        suits: [], stocks: Object.fromEntries(DISTRICTS.map(d => [d, 0])),
        halfToll:false, bonusDivTimes:1.0, nextRoll:null,
        out:false, pendingFork:null,
        isAi: i >= numHumans
    }));

    return { tiles, adj, bankIx, players, stocks, winTarget: winTarget || 5000, cur: 0, turn: 1, phase: "Idle", rolledThisTurn: false, extraRollAvailable: false, extraRollConsumed: false, boughtStockThisTurn: false, winner: null, log: [], pendingForkChoice: false, lastCard: null, SUITS, DISTRICTS };
}

// ===== Helpers =====
function log(gs, message) { gs.log.push(message); }
function netWorth(gs, p){
    let total = p.cash;
    DISTRICTS.forEach(d => { total += p.stocks[d] * gs.stocks[d].price; });
    const propsByDistrict = {};
    gs.tiles.forEach(t => {
        if (t.type === 'prop' && t.owner === p.id) {
            if (!propsByDistrict[t.district]) propsByDistrict[t.district] = [];
            propsByDistrict[t.district].push(t);
        }
    });
    Object.keys(propsByDistrict).forEach(dist => {
        const props = propsByDistrict[dist];
        const n = props.length;
        const multiplier = 1 + (n - 1) * 0.25; // 1, 1.25, 1.5, 1.75
        props.forEach(prop => { total += prop.price * multiplier; });
    });
    return Math.round(total);
}
function propToll(prop){ return Math.round(prop.price / 4); }
function propsOwnedBy(gs, p){ return gs.tiles.filter(t => t.type==='prop' && t.owner===p.id); }
function changeCash(gs, p, delta){ p.cash += delta; log(gs, `${p.name} ${delta>=0?'+':''}${delta}G → Balance ${p.cash}G`); }
function transfer(gs, from, to, amount){ from.cash -= amount; to.cash += amount; log(gs, `${from.name} → ${to.name} ${amount}G`); }

// ===== Core Logic Functions =====
function buyStock(gs, p, dist, qty){
    const s = gs.stocks[dist];
    const cost = s.price * qty;
    if (p.cash < cost) { log(gs, "Not enough cash"); return false; }
    p.cash -= cost;
    p.stocks[dist] += qty;
    s.issued += qty;
    s.price += Math.floor(qty / 10);
    if (s.price < 1) s.price = 1;
    log(gs, `${p.name} bought ${qty} shares of ${dist} (${cost}G). Price→${s.price}`);
    return true;
}
function sellStock(gs, p, dist, qty){
    qty = Math.min(qty, p.stocks[dist]);
    if (qty <= 0) { log(gs, "No shares to sell"); return false; }
    const s = gs.stocks[dist];
    const income = s.price * qty;
    p.cash += income;
    p.stocks[dist] -= qty;
    s.issued -= qty;
    s.price -= Math.floor(qty / 10);
    if (s.price < 1) s.price = 1;
    log(gs, `${p.name} sold ${qty} shares of ${dist} (+${income}G). Price→${s.price}`);
    return true;
}

function investProperty(gs, p, prop, amount, free=false){
    if (amount < 50 || amount % 50) return false;
    if (!free && p.cash < amount) { log(gs, "Not enough cash"); return false; }
    if (!free) p.cash -= amount;
    prop.price += Math.round(amount * 0.8);
    if (prop.district) { gs.stocks[prop.district].price += Math.max(1, Math.floor(amount / 100)); }
    log(gs, `${p.name} invested ${free?"for free ":""}${amount}G into ${prop.name} → value ${prop.price}G`);
    return true;
}

function sellProperty(gs, p, tileIndex) {
    const t = gs.tiles[tileIndex];
    if (!t || t.owner !== p.id) return;
    const val = Math.round(t.price * 0.75); // Sell for 75% of value
    p.cash += val;
    t.owner = null;
    log(gs, `${p.name} sold ${t.name} to the bank for ${val}G.`);
}

function tryLiquidate(gs, p){
    if(p.cash>=0) return true;
    log(gs, `${p.name} is short of cash. Auto-liquidating...`);
    const sortedDists = [...DISTRICTS].sort((a,b) => gs.stocks[b].price - gs.stocks[a].price);
    for(const d of sortedDists){
        while(p.cash<0 && p.stocks[d]>0){ sellStock(gs,p,d,10); } if(p.cash>=0) break;
    }
    const sortedProps = propsOwnedBy(gs, p).sort((a,b) => a.price - b.price);
    for(const pr of sortedProps){
        if(p.cash>=0) break;
        const val=Math.round(pr.price*0.5);
        pr.owner=null;
        p.cash+=val;
        log(gs, `${p.name} sold ${pr.name} for ${val}G.`);
    }
    if(p.cash<0){ p.out=true; log(gs, `${p.name} is bankrupt and out.`); }
    return p.cash>=0;
}

function rollDice(gs){
    const p=gs.players[gs.cur];
    const r = p.nextRoll ?? (1+Math.floor(Math.random()*6));
    p.nextRoll=null;
    log(gs, `${p.name} rolled: ${r}`);
    return r;
}

function movePlayer(gs, p, steps) {
    gs.phase="Moving";
    let cur = p.pos;
    let prev = p.lastPos;
    for(let i=0; i<steps; i++){
        const neighbors = gs.adj[cur].filter(ix => ix !== prev);
        let next;
        if(neighbors.length === 1) {
            next = neighbors[0];
        } else if (neighbors.length > 1) {
            if (p.pendingFork && p.pendingFork.nodeIx === cur) {
                next = p.pendingFork.nextIx;
                p.pendingFork = null;
            } else {
                log(gs, "Fork detected, waiting for client choice");
                gs.pendingForkChoice = { options: neighbors };
                return; // Stop movement
            }
        } else {
            next = gs.adj[cur][0] ?? prev; // Should not happen on a circuit
        }
        p.lastPos = cur;
        p.pos = next;
        cur = next;
        prev = p.lastPos;
        const currentTile = gs.tiles[cur];
        if (currentTile.type === 'suit' && !p.suits.includes(currentTile.suit)) {
            p.suits.push(currentTile.suit);
            log(gs, `${p.name} gained suit ${currentTile.suit}.`);
        }
        if (cur === gs.bankIx) {
            gs.phase = 'Action'; // Force stop at bank
            onLand(gs);
            return;
        }
    }
    gs.phase="Action";
    onLand(gs);
}

function onLand(gs){
    const p=gs.players[gs.cur]; const t=gs.tiles[p.pos];
    log(gs, `${p.name} landed on ${t.name || t.type}`);
    switch(t.type){
        case "bank": onBank(gs, p); break;
        case "prop": onProp(gs, p,t); break;
        case "chance": onChance(gs, p); break;
        case "tax": onTax(gs, p,t); break;
        case "rest": log(gs, `${p.name} takes a rest.`); break;
    }
    const nbrs = gs.adj[p.pos].filter(ix => ix !== p.lastPos);
    if(gs.tiles[p.pos].fork && nbrs.length > 1){
        log(gs, "Landed on fork, waiting for client choice for next turn.");
        gs.pendingForkChoice = { options: nbrs, forNextTurn: true };
    }
}

function onBank(gs, p){
    if(SUITS.every(s => p.suits.includes(s))){
        const salary = 300 + 50*(p.level-1) + 10*propsOwnedBy(gs,p).length;
        let div=0; DISTRICTS.forEach(d => { div += Math.floor(gs.stocks[d].price * p.stocks[d] * 0.5); });
        div = Math.floor(div * p.bonusDivTimes);
        p.bonusDivTimes=1.0; p.level++; p.suits = [];
        log(gs, `${p.name} ranked up! 💼 Salary +${salary}G / Dividend +${div}G`);
        p.cash+=salary+div;
    } else {
        log(gs, `${p.name} arrived at the Bank.`);
    }
    const nw=netWorth(gs, p);
    if(gs.winner==null && nw>=gs.winTarget){
        gs.winner=p.id; gs.phase="Game Over"; log(gs, `${p.name} reached the target net worth ${gs.winTarget}G! 🏆 Victory!`);
    }
}

function onProp(gs, p, t){
    if(t.owner===null){ /* Can Buy */ }
    else if(t.owner===p.id){ /* Can Invest */ }
    else { const toll=propToll(t); const finalToll = p.halfToll ? Math.floor(toll/2) : toll; p.halfToll=false; const owner=gs.players[t.owner]; log(gs, `${p.name} pays toll ${finalToll}G to ${owner.name}.`); transfer(gs, p, owner, finalToll); }
}

function onChance(gs, p){ const card = ventureCards[Math.floor(Math.random()*ventureCards.length)]; gs.lastCard = card.t; log(gs, `Card for ${p.name}: ${card.t}`); card.fn(gs,p); }
function onTax(gs, p,t){ const v=t.tax ?? 100; log(gs, `${p.name} pays tax ${v}G.`); changeCash(gs, p,-v); }

function doBuy(gs) {
    const p = gs.players[gs.cur]; const t = gs.tiles[p.pos];
    if (t.type !== "prop" || t.owner !== null || p.cash < t.price) return;
    p.cash -= t.price; t.owner = p.id; log(gs, `${p.name} bought ${t.name} for ${t.price}G!`);
}

function endTurn(gs) {
    if(gs.winner!=null) return;
    const p = gs.players[gs.cur];
    if (p.cash < 0) { if (!tryLiquidate(gs, p)) { /* Player is out */ } }
    const N=gs.players.length;
    let k=0; do { gs.cur=(gs.cur+1)%N; k++; } while(gs.players[gs.cur].out && k<=N);
    if(gs.players[gs.cur].out){ log(gs, "Game ended (everyone out?)"); gs.phase = "Game Over"; return; }
    gs.turn++; gs.phase="Idle"; gs.rolledThisTurn=false; gs.extraRollAvailable=false; gs.extraRollConsumed=false; gs.boughtStockThisTurn = false;
}

// ===== Action Handler =====
function handleGameAction(gs, action) {
    const p = gs.players[gs.cur];
    if (!p || p.out) return;

    switch(action.type) {
        case 'roll':
            const canRoll = !gs.rolledThisTurn || (gs.extraRollAvailable && !gs.extraRollConsumed);
            if (gs.phase === 'Idle' && canRoll) {
                if(gs.rolledThisTurn) gs.extraRollConsumed = true; else gs.rolledThisTurn = true;
                const steps = rollDice(gs);
                movePlayer(gs, p, steps);
            }
            break;
        case 'buy': doBuy(gs); break;
        case 'invest': investProperty(gs, p, gs.tiles[p.pos], action.payload.amount); break;
        case 'sellProperty': sellProperty(gs, p, action.payload.tileIndex); break;
        case 'market':
            let isBuying = false;
            action.payload.transactions.forEach(t => { if (t.qty > 0) isBuying = true; });
            if (isBuying && gs.boughtStockThisTurn) {
                log(gs, "You can only buy stocks once per turn.");
                return;
            }
            action.payload.transactions.forEach(t => {
                if (t.qty > 0) buyStock(gs, p, t.dist, t.qty);
                else sellStock(gs, p, t.dist, -t.qty);
            });
            if (isBuying) gs.boughtStockThisTurn = true;
            break;
        case 'endTurn': if(gs.rolledThisTurn) endTurn(gs); break;
        case 'forkChoice':
            if (gs.pendingForkChoice) {
                const choice = action.payload.nextNode;
                if (gs.pendingForkChoice.forNextTurn) {
                    p.pendingFork = { nodeIx: p.pos, nextIx: choice };
                    log(gs, `Direction locked for ${p.name} for next turn.`);
                } else {
                    p.lastPos = p.pos; p.pos = choice;
                    onLand(gs);
                }
                gs.pendingForkChoice = null;
            }
            break;
    }
}

module.exports = { createInitialGameState, handleGameAction };

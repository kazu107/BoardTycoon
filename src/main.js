
    (function(){
        // ===== Constants & Layout =====
        var SUITS = ["♠","♥","♦","♣"]; // collect all, then bank to level up
        var DISTRICTS = ["A", "B", "C", "D", "E", "F", "G"]; // 7 districts
        var COLORS = ["#ff5e5e","#5ec6ff","#ffd05e","#a5ff5e"]; // pawn colors

        // Map provided by user (7x13)
        var MAP = [
            "######*######",
            "#.....#.....#",
            "#.....#.....#",
            "#.....#.....#",
            "#.....#.....#",
            "#.....#.....#",
            "######*######"
        ];
        var ROWS = MAP.length; var COLS = MAP[0].length;

        // ===== Build Nodes & Graph =====
        // Node for each '#' or '*'
        var nodes = []; // {r,c, kind:'#'|'*'}
        var indexAt = Array.from({length:ROWS}, function(){ return Array(COLS).fill(-1); });
        for(var r=0;r<ROWS;r++){
            for(var c=0;c<COLS;c++){
                var ch = MAP[r][c];
                if(ch==="#" || ch==='*'){
                    var ix = nodes.length; indexAt[r][c]=ix; nodes.push({r:r,c:c,kind:ch});
                }
            }
        }
        // Adjacency
        var adj = nodes.map(function(){ return []; });
        var deltas = [[-1,0],[1,0],[0,-1],[0,1]]; // U,D,L,R
        nodes.forEach(function(n,ix){
            deltas.forEach(function(d){
                var dr=d[0], dc=d[1];
                var r2=n.r+dr, c2=n.c+dc; if(r2<0||r2>=ROWS||c2<0||c2>=COLS) return;
                var jx=indexAt[r2][c2]; if(jx!==-1){ adj[ix].push(jx); }
            });
        });

        // Helper to label direction arrow from a -> b
        function dirArrow(a,b){ var dr=b.r-a.r, dc=b.c-a.c; if(dr===0&&dc>0) return '→'; if(dr===0&&dc<0) return '←'; if(dc===0&&dr>0) return '↓'; if(dc===0&&dr<0) return '↑'; return '?'; }

        // ===== Initial Tile Types =====
        // Create tile objects from nodes; assign types later
        var tiles = nodes.map(function(n,ix){ return { ix:ix, r:n.r, c:n.c, fork:(n.kind==='*'), type:'free', name:'', em:'', owner:null, price:0, district:null }; });

        var bankIx = 20;
        tiles[bankIx].type = 'bank';
        tiles[bankIx].name = 'Bank';
        tiles[bankIx].em = '🏦';

        var suitIxs = [0, 12, 28, 40];
        SUITS.forEach(function(s, idx) {
            var ix = suitIxs[idx];
            if (ix != null) {
                tiles[ix].type = 'suit';
                tiles[ix].name = 'Suit (' + s + ')';
                tiles[ix].em = '';
                tiles[ix].suit = s;
            }
        });

        var chanceIxs = [3, 9, 21, 31, 37];
        chanceIxs.forEach(function(ix) {
            tiles[ix].type = 'chance';
            tiles[ix].name = 'Card';
            tiles[ix].em = '❓';
        });

        var taxIxs = [6, 34];
        taxIxs.forEach(function(ix) {
            tiles[ix].type = 'tax';
            tiles[ix].name = 'Tax';
            tiles[ix].em = '💸';
            tiles[ix].tax = 120;
        });

        var restIxs = [19];
        restIxs.forEach(function(ix) {
            tiles[ix].type = 'rest';
            tiles[ix].name = 'Rest';
            tiles[ix].em = '◎';
        });

        var districtLayout = {
            "A": [1, 2, 13, 16], "B": [4, 5, 7, 8], "C": [10, 11, 15, 18], "D": [24, 27, 38, 39],
            "E": [32, 33, 35, 36], "F": [22, 25, 29, 30], "G": [14, 17, 23, 26]
        };
        var propNames = ['Old Town','Willow Walk','Cherry Slope','Harbor Road','Warehouse Row','Dock Street','Hilltop','Lakeside','Windmill Way','Theater Row','Silver Street','Central Ave', 'Maple St', 'Oak Dr', 'Pine Ln', 'Elm Ct', 'Birch Rd', 'Cedar Ave', 'Spruce St', 'Aspen Ct', 'Main St', '2nd St', '3rd Ave', '4th Blvd', '5th Rd', '6th Ln', '7th Ct', '8th St'];
        var nameIdx = 0;

        Object.keys(districtLayout).forEach(function(distName, i) {
            var propIxs = districtLayout[distName];
            propIxs.forEach(function(ix) {
                if (tiles[ix].type === 'free') {
                    tiles[ix].type = 'prop';
                    tiles[ix].name = propNames[nameIdx++];
                    tiles[ix].district = distName;
                    tiles[ix].price = 100 + (i * 20);
                }
            });
        });

        // Mark forks visual class (keeps type semantics)
        tiles.forEach(function(t){ if(nodes[t.ix].kind==='*'){ t.fork=true; }});

        // ===== Venture cards =====
        var ventureCards = [
            {t:"Bonus +200G", fn:function(g,p){ g.changeCash(p, +200); }},
            {t:"Donation −150G", fn:function(g,p){ g.changeCash(p, -150); }},
            {t:"Roll again!", fn:function(g,p){ g.extraRollAvailable = true; g.extraRollConsumed = false; g.log(p.name + ' can roll once more this turn!'); g.refresh(); }},
            {t:"Warp to Bank", fn:function(g,p){ p.pos = bankIx; g.log(p.name + ' warped to the Bank!'); g.onLand(); }},
            {t:"Market Up: all districts +1", fn:function(g,p){ DISTRICTS.forEach(function(d){ g.stocks[d].price++; }); g.refresh(); }},
            {t:"Market Down: all districts -1", fn:function(g,p){ DISTRICTS.forEach(function(d){ g.stocks[d].price=Math.max(1,g.stocks[d].price-1); }); g.refresh(); }},
            {t:"Free Invest: +200G", fn:function(g,p){ var myProps=g.propsOwnedBy(p); if(myProps.length){ var pr = myProps[Math.floor(Math.random()*myProps.length)]; g.investProperty(p, pr, 200, true); } }},
            {t:"Tax Refund +100G", fn:function(g,p){ g.changeCash(p,+100); }},
            {t:"From Everyone: +50G each", fn:function(g,p){ g.players.forEach(function(q){ if(q!==p) g.transfer(q,p,50); }); }},
            {t:"Toll Discount: next payment half", fn:function(g,p){ p.halfToll=true; }},
            {t:"Dividend Boost: next rank-up x1.5", fn:function(g,p){ p.bonusDivTimes=1.5; }},
            {t:"Fixed Dice: next is 6", fn:function(g,p){ p.nextRoll=6; }}
        ];

        // ===== Game State =====
        var game = {
            players: [], cur: 0, turn: 1, phase: "Idle", // Idle/Moving/Action/Game Over
            stocks: {}, tiles: tiles, adj: adj,
            // turn control
            rolledThisTurn:false,
            extraRollAvailable:false,
            extraRollConsumed:false,
            boughtStockThisTurn: false,
            winner:null,
            winTarget:5000,

            init: function(numPlayers, winTarget){
                if(numPlayers===void 0) numPlayers=2;
                this.winner=null; this.rolledThisTurn=false; this.extraRollAvailable=false; this.extraRollConsumed=false;
                this.winTarget = winTarget || 5000;

                // districts init
                this.stocks = {}; DISTRICTS.forEach(function(d){ game.stocks[d] = { price:10, issued:0 }; });

                // reset dynamic tile state
                this.tiles.forEach(function(t){ if(t.type==='prop'){ t.owner=null; t.price=t.price||240; } });

                // players
                this.players = Array.from({length:numPlayers}, function(_,i){
                    return {
                        id:i, name:'P'+(i+1), color: COLORS[i%COLORS.length],
                        cash: 2000, pos: bankIx, lastPos: bankIx, level:1,
                        suits: new Set(), stocks: {A:0,B:0,C:0,D:0,E:0,F:0,G:0},
                        halfToll:false, bonusDivTimes:1.0, nextRoll:null,
                        out:false, pendingFork:null // {nodeIx, nextIx}
                    };
                });

                this.cur=0; this.turn=1; this.phase="Idle";
                logEl.innerHTML="";
                this.renderBoard();
                this.refresh();
                this.log("Game start! 🎉");
            },

            // ===== Helpers =====
            canRoll: function(){
                if(this.winner!=null) return false;
                if(this.phase!=="Idle") return false;
                var p=this.players[this.cur]; if(p.out) return false;
                if(!this.rolledThisTurn) return true;
                return this.extraRollAvailable && !this.extraRollConsumed;
            },

            nextPlayer: function(){
                var N=this.players.length; var k=0; do{ this.cur=(this.cur+1)%N; k++; }while(this.players[this.cur].out && k<=N);
                if(this.players[this.cur].out){ this.log("Game ended (everyone out?)"); return; }
                this.turn++; this.phase="Idle"; this.rolledThisTurn=false; this.extraRollAvailable=false; this.extraRollConsumed=false; this.boughtStockThisTurn = false; this.refresh();
            },

            tileAt: function(ix){ return this.tiles[ix]; },

            netWorth: function(p){
                var total = p.cash;
                DISTRICTS.forEach(function(d){ total += p.stocks[d]*game.stocks[d].price; });

                // add owned property values with multiplier
                var propsByDistrict = {};
                this.tiles.forEach(function(t) {
                    if (t.type === 'prop' && t.owner === p.id) {
                        if (!propsByDistrict[t.district]) {
                            propsByDistrict[t.district] = [];
                        }
                        propsByDistrict[t.district].push(t);
                    }
                });

                Object.keys(propsByDistrict).forEach(function(dist) {
                    var props = propsByDistrict[dist];
                    var n = props.length;
                    var multiplier = 1 + (n - 1) * 0.25;
                    props.forEach(function(prop) {
                        total += prop.price * multiplier;
                    });
                });

                return total;
            },

            propToll: function(prop){ return Math.round(prop.price / 4); },
            propsOwnedBy: function(p){ return this.tiles.filter(function(t){ return t.type==='prop' && t.owner===p.id; }); },

            // Money ops
            changeCash: function(p, delta){ p.cash += delta; this.log(p.name + ' ' + (delta>=0?'+':'') + delta + 'G → Balance ' + p.cash + 'G'); this.refresh(); },
            transfer: function(from, to, amount){
                from.cash -= amount;
                to.cash += amount;
                this.log(from.name + ' → ' + to.name + ' ' + amount + 'G');
                this.refresh();
            },

            // Stock ops
            buyStock: function(p, dist, qty){ var s=this.stocks[dist]; var cost=s.price*qty; if(p.cash<cost){ this.log("Not enough cash"); return false; }
                p.cash-=cost; p.stocks[dist]+=qty; s.issued+=qty; s.price += Math.floor(qty/10); if(s.price<1) s.price=1; this.log(p.name + ' bought ' + qty + ' shares of ' + dist + ' (' + cost + 'G). Price→' + s.price); this.refresh(); return true; },
            sellStock: function(p, dist, qty){ qty=Math.min(qty, p.stocks[dist]); if(qty<=0){ this.log("No shares to sell"); return false; }
                var s=this.stocks[dist]; var income=s.price*qty; p.cash+=income; p.stocks[dist]-=qty; s.issued-=qty; s.price -= Math.floor(qty/10); if(s.price<1) s.price=1; this.log(p.name + ' sold ' + qty + ' shares of ' + dist + ' (+' + income + 'G). Price→' + s.price); this.refresh(); return true; },

            investProperty: function(p, prop, amount, free){ if(free===void 0) free=false; amount=Math.min(amount, 500); if(amount<50 || amount%50) return false; if(!free && p.cash<amount){ this.log("Not enough cash"); return false; }
                if(!free) p.cash-=amount; prop.price += Math.round(amount*0.8); if(prop.district){ this.stocks[prop.district].price += Math.max(1, Math.floor(amount/100)); }
                this.log(p.name + ' invested ' + (free?"for free ":"") + amount + 'G into ' + prop.name + ' → value ' + prop.price + 'G / ' + prop.district + ' stock ' + this.stocks[prop.district].price);
                this.refresh(); return true; },

            tryLiquidate: function(p){ if(p.cash>=0) return true; this.log(p.name + ' is short of cash. Auto-liquidating...');
                var dists=[].concat(DISTRICTS).sort(function(a,b){ return game.stocks[b].price-game.stocks[a].price; });
                for(var i=0;i<dists.length;i++){ var d=dists[i]; while(p.cash<0 && p.stocks[d]>0){ this.sellStock(p,d,10); } if(p.cash>=0) break; }
                var props=this.propsOwnedBy(p).sort(function(a,b){ return a.price-b.price; });
                for(var j=0;j<props.length;j++){ if(p.cash>=0) break; var pr=props[j]; var val=Math.round(pr.price*0.5); pr.owner=null; p.cash+=val; this.log(p.name + ' sold ' + pr.name + ' +' + val + 'G'); }
                this.refresh(); if(p.cash<0){ p.out=true; this.log(p.name + ' is bankrupt and out.'); }
                return p.cash>=0; },

            // Movement
            rollDice: function(){ var p=this.players[this.cur]; var r = (p.nextRoll!=null?p.nextRoll:(1+Math.floor(Math.random()*6))); p.nextRoll=null; this.log(p.name + ' rolled: ' + r); return r; },

            tileCenter: function(ix){ var tile = boardEl.querySelector('.tile[data-ix="' + ix + '"]'); var br = boardEl.getBoundingClientRect(); var tr = tile.getBoundingClientRect(); return {left: tr.left - br.left + tr.width/2, top: tr.top - br.top + tr.height/2}; },
            moveStep: function(p, nextIx){ p.lastPos = p.pos; p.pos = nextIx; this.renderPawns(); },

            askFork: async function(curIx, options){
                if(this.__testMode){ return options[0]; }
                var a = this.tileAt(curIx);
                var btnDescs = options.map(function(ix){ var b=game.tileAt(ix); return {ix:ix, label: dirArrow(a,b)}; });
                forkBtns.innerHTML = '';
                return await new Promise(function(resolve){
                    btnDescs.forEach(function(desc){ var b=document.createElement('button'); b.className='btn'; b.textContent=desc.label; b.onclick=function(){ dlgFork.close(); resolve(desc.ix); }; forkBtns.appendChild(b); });
                    forkText.textContent = 'Which way?';
                    dlgFork.showModal();
                });
            },

            moveBy: async function(p, steps){
                this.phase="Moving"; this.refresh();
                var cur = p.pos; var prev = p.lastPos;
                for(var i=0;i<steps;i++){
                    var neighbors = adj[cur].slice();
                    if(prev!=null && neighbors.length>1){ neighbors = neighbors.filter(function(ix){ return ix!==prev; }); }
                    var next;
                    if(neighbors.length===1){ next = neighbors[0]; }
                    else if(neighbors.length===2){
                        if(p.pendingFork && p.pendingFork.nodeIx===cur){ next = p.pendingFork.nextIx; p.pendingFork=null; }
                        else { next = await this.askFork(cur, neighbors); }
                    } else {
                        next = neighbors[0] != null ? neighbors[0] : prev;
                    }
                    await wait(220);
                    this.moveStep(p, next);
                    cur = p.pos; prev = p.lastPos;

                    var currentTile = this.tileAt(cur);
                    if (currentTile.type === 'suit') {
                        this.onSuit(p, currentTile);
                    }

                    if (cur === bankIx) {
                        await this.handleBankEncounter();
                    }
                }
                await wait(120);
                this.onLand();
                this.refresh();
                var t=this.tileAt(p.pos); var nbrs = adj[p.pos].filter(function(ix){ return ix!==p.lastPos; });
                if(nodes[t.ix].kind==='*' && nbrs.length===2){
                    var chosen = await this.askFork(p.pos, nbrs);
                    p.pendingFork = {nodeIx:p.pos, nextIx: chosen};
                    this.log('Direction locked for next turn: ' + dirArrow(this.tileAt(p.pos), this.tileAt(chosen)));
                }
            },

            onLand: function(){
                var p=this.players[this.cur]; var t=this.tileAt(p.pos);
                this.phase="Action"; this.refresh();
                switch(t.type){
                    case "bank": this.onBank(p); break;
                    case "prop": this.onProp(p,t); break;
                    case "chance": this.onChance(p); break;
                    case "tax": this.onTax(p,t); break;
                    case "rest": this.log(p.name + ' takes a rest.'); break;
                    default: break;
                }
                this.refresh();
            },

            onBank: function(p){
                if(SUITS.every(function(s){ return p.suits.has(s); })){
                    var salary = 300 + 50*(p.level-1) + 10*this.propsOwnedBy(p).length;
                    var div=0; DISTRICTS.forEach(function(d){ div += Math.floor(game.stocks[d].price * p.stocks[d] * 0.5); });
                    div = Math.floor(div * p.bonusDivTimes);
                    p.bonusDivTimes=1.0; p.level++; p.suits = new Set();
                    this.log(p.name + ' ranked up! 💼 Salary +' + salary + 'G / Dividend +' + div + 'G');
                    p.cash+=salary+div;
                } else {
                    this.log(p.name + ' arrived at the Bank (suits not complete).');
                }
                var nw=this.netWorth(p);
                if(this.winner==null && nw>=this.winTarget){
                    this.winner=p.id; this.phase="Game Over"; this.log(p.name + ' reached the target net worth ' + this.winTarget + 'G! 🏆 Victory!');
                    alert(p.name + ' wins! Net Worth ' + nw + 'G ≥ Target ' + this.winTarget + 'G');
                }
                this.refresh();
            },

            onProp: function(p,t){
                if(t.owner===null){ this.log(p.name + ' landed on unowned ' + t.name + ' (value ' + t.price + 'G).'); }
                else if(t.owner===p.id){ this.log('Your own property. You may invest.'); }
                else { var toll=this.propToll(t); if(p.halfToll){ toll=Math.floor(toll/2); p.halfToll=false; } var owner=this.players[t.owner]; this.log(p.name + ' pays toll ' + toll + 'G to ' + owner.name + '.'); this.transfer(p, owner, toll); }
            },

            onSuit: function(p,t){ p.suits.add(t.suit); this.log(p.name + ' gained suit ' + t.suit + '.'); },
            onChance: function(p){ var card = ventureCards[Math.floor(Math.random()*ventureCards.length)]; this.log('Card: ' + card.t); cardText.textContent = card.t; dlgCard.showModal(); card.fn(this,p); },
            onTax: function(p,t){ var v=t.tax != null ? t.tax : 100; this.log(p.name + ' pays tax ' + v + 'G.'); this.changeCash(p,-v); },

            // Actions
            doBuy: function(){ var p=this.players[this.cur]; var t=this.tileAt(p.pos); if(t.type!=="prop" || t.owner!==null) return; var cost=t.price;
                if (this.netWorth(p) < cost) {
                    this.log("Not enough net worth to buy this property.");
                    return;
                }
                p.cash-=cost; t.owner=p.id; this.log(p.name + ' bought ' + t.name + ' for ' + cost + 'G!'); this.refresh(); },
            doInvest: function(amount){ var p=this.players[this.cur]; var t=this.tileAt(p.pos); if(t.type!=="prop"||t.owner!==p.id) return; this.investProperty(p,t,amount); },

            sellProperty: function(p, t) {
                var val = t.price;
                p.cash += val;
                t.owner = null;
                this.log(p.name + ' sold ' + t.name + ' to the bank for ' + val + 'G.');
                this.refresh();
            },

            askTrade: function() {
                return new Promise(resolve => {
                    dlgAskTrade.showModal();
                    btnTradeYes.onclick = () => {
                        dlgAskTrade.close();
                        resolve(true);
                    };
                    btnTradeNo.onclick = () => {
                        dlgAskTrade.close();
                        resolve(false);
                    };
                });
            },

            showMarketAsPromise: function() {
                return new Promise(resolve => {
                    var closeListener = () => {
                        dlgMarket.removeEventListener('close', closeListener);
                        resolve();
                    };
                    dlgMarket.addEventListener('close', closeListener);
                    openMarketDialog();
                });
            },

            handleBankEncounter: async function() {
                var trade = await this.askTrade();
                if (trade) {
                    await this.showMarketAsPromise();
                }
            },

            endTurn: function(){ 
                if(this.winner!=null) return;
                var p = this.players[this.cur];
                if (p.cash < 0) {
                    this.tryLiquidate(p);
                }
                this.nextPlayer(); 
            },

            // Turn roller
            turnRoll: async function(){
                if(!this.canRoll()) return;
                var p=this.players[this.cur];
                var isExtra = this.rolledThisTurn && this.extraRollAvailable && !this.extraRollConsumed;
                if(!isExtra) this.rolledThisTurn = true; else this.extraRollConsumed = true;
                this.refresh();
                var steps=this.rollDice(); await this.moveBy(p, steps);
            },

            // Renderers
            renderBoard: function(){
                boardEl.style.gridTemplateColumns = 'repeat(' + COLS + ', 1fr)';
                boardEl.style.gridTemplateRows = 'repeat(' + ROWS + ', 1fr)';
                boardEl.innerHTML="";
                for(var k=0;k<this.tiles.length;k++){
                    var t=this.tiles[k]; var el=document.createElement('div'); el.className='tile ' + t.type + (t.fork?' fork':''); el.dataset.ix=t.ix; el.style.gridRow=(t.r+1); el.style.gridColumn=(t.c+1);
                    var em = t.em ? '<span class="em">' + t.em + '</span>' : (t.fork?'<span class="em">✳</span>':'');
                    var inner = '<span class="ix">#' + t.ix + '</span>';
                    if(t.type==='prop'){
                        var ownerName = t.owner==null?'‐':(this.players[t.owner]?this.players[t.owner].name:'‐');
                        inner += '<span class="owner">' + ownerName + '</span>';
                        inner += '<div class="toll">' + this.propToll(t) + 'G</div>';
                    }
                    var titleText = t.name || (t.type==='free'?(t.fork?'Fork':''):'');
                    inner += '<div>' + em + titleText + '</div>';
                    if(t.type==='prop') inner += '<span class="price">' + t.price + 'G</span><span class="dmark">' + t.district + '</span>';
                    else if(t.type==='suit') inner += '<span class="dmark">' + t.suit + '</span>';
                    el.innerHTML = inner;
                    boardEl.appendChild(el);
                }
                var pawns=document.createElement('div'); pawns.className='pawns';
                this.players.forEach(function(p){
                    if(p.out) return; var center=game.tileCenter(p.pos); var pw=document.createElement('div'); pw.className='pawn'; pw.title=p.name; pw.style.setProperty('--c',p.color); pw.style.background=p.color; pw.style.left=center.left+'px'; pw.style.top=center.top+'px'; pawns.appendChild(pw);
                });
                boardEl.appendChild(pawns);
            },

            renderPawns: function(){ var pawns=boardEl.querySelector('.pawns'); if(!pawns) return this.renderBoard(); pawns.innerHTML=""; this.players.forEach(function(p){ if(p.out) return; var center=game.tileCenter(p.pos); var pw=document.createElement('div'); pw.className='pawn'; pw.title=p.name; pw.style.background=p.color; pw.style.left=center.left+'px'; pw.style.top=center.top+'px'; pawns.appendChild(pw); }); },

            refresh: function(){
                // Ownership highlight & labels
                document.querySelectorAll('.tile.prop').forEach(function(el){ var ix=+el.dataset.ix; var t=game.tiles[ix]; el.classList.remove('own','foe'); if(t.owner==null) return; var curP=game.players[game.cur]; el.classList.add(t.owner===curP.id?'own':'foe'); el.querySelector('.owner').textContent = t.owner==null?'‐':(game.players[t.owner]?game.players[t.owner].name:'‐'); el.querySelector('.price').textContent = t.price+'G'; el.querySelector('.toll').textContent = game.propToll(t)+'G'; });

                // Sidebar
                curPEl.textContent = game.players[game.cur].name + ' (Lv.' + game.players[game.cur].level + ')';
                phaseEl.textContent = game.phase + (game.extraRollAvailable && !game.extraRollConsumed ? ' (Extra roll available)' : '');
                turnEl.textContent = game.turn;

                // Player cards
                playersEl.innerHTML="";
                this.players.forEach(function(p,i){
                    var pc=document.createElement('div'); pc.className='player-card'+(i===game.cur?' active':'');
                    var nw = game.netWorth(p);
                    var html = '';
                    html += '<div class="row" style="justify-content:space-between"><strong style="color:' + p.color + '">' + p.name + '</strong><span class="money">' + p.cash + ' G</span></div>';
                    html += '<div class="small">Pos: #' + p.pos + ' / Lv.' + p.level + (p.out?' (Out)':'') + '</div>';
                    html += '<div class="small">Net Worth: <strong>' + nw + ' G</strong></div>';
                    html += '<div class="suit-badges">' + SUITS.map(function(s){ return '<span style="opacity:' + (p.suits.has(s)?1:.35) + '">' + s + '</span>'; }).join('') + '</div>';
                    html += '<div class="small">Stocks: ' + DISTRICTS.map(function(d){ return d + ':' + p.stocks[d] + 'sh'; }).join('  ') + '</div>';
                    var props = game.propsOwnedBy(p);
                    html += '<details style="margin-top:6px"><summary>Properties</summary>' + (props.map(function(t){ return '<div class="pill">' + t.name + ' (' + t.district + ' / ' + t.price + 'G)<button class="btn-sell-prop" data-ix="' + t.ix + '">Sell</button></div>'; }).join('') || '<div class="small">None</div>') + '</details>';
                    pc.innerHTML = html;
                    playersEl.appendChild(pc);
                });

                // Stocks table
                var table = '<thead><tr><th>District</th><th>Price (G)</th><th>Issued</th>';
                game.players.forEach(function(p) {
                    table += '<th>' + p.name + '</th>';
                });
                table += '</tr></thead><tbody>';

                DISTRICTS.forEach(function(d) {
                    table += '<tr><td>' + d + '</td><td>' + game.stocks[d].price + '</td><td>' + game.stocks[d].issued + '</td>';
                    game.players.forEach(function(p) {
                        table += '<td>' + p.stocks[d] + '</td>';
                    });
                    table += '</tr>';
                });
                table += '</tbody>';
                stockTable.innerHTML = table;

                // Buttons state
                var p=this.players[this.cur]; var t=this.tileAt(p.pos); var gameOver = this.winner!=null;
                btnRoll.disabled = gameOver || !this.canRoll();
                btnBuy.disabled = gameOver || !(t.type==='prop' && t.owner===null && p.cash>=t.price);
                btnInvest.disabled = gameOver || !(t.type==='prop' && t.owner===p.id);
                btnMarket.disabled = gameOver;
                btnEnd.disabled = gameOver || !game.rolledThisTurn;
            },

            // Save / Load
            save: function(){ var data = JSON.stringify({ players:this.players.map(function(p){ return Object.assign({}, p, { suits:[].concat(Array.from(p.suits)) }); }), cur:this.cur, turn:this.turn, phase:this.phase, stocks:this.stocks, tiles:this.tiles }); localStorage.setItem('bt_save', data); this.log('Saved.'); },
            load: function(){ var s=localStorage.getItem('bt_save'); if(!s) return this.log('No save data'); var d=JSON.parse(s); this.players = d.players.map(function(p){ return Object.assign({}, p, { suits:new Set(p.suits) }); }); this.cur=d.cur; this.turn=d.turn; this.phase=d.phase; this.stocks=d.stocks; this.tiles=d.tiles; this.renderBoard(); this.refresh(); this.log('Loaded.'); },

            // Tests helpers
            __snapshot: function(){ return JSON.stringify({ players:this.players.map(function(p){ return Object.assign({}, p, { suits:[].concat(Array.from(p.suits)) }); }), cur:this.cur, turn:this.turn, phase:this.phase, stocks:this.stocks, tiles:this.tiles, rolledThisTurn:this.rolledThisTurn, extraRollAvailable:this.extraRollAvailable, extraRollConsumed:this.extraRollConsumed }); },
            __restore: function(js){ var d=JSON.parse(js); this.players = d.players.map(function(p){ return Object.assign({}, p, { suits:new Set(p.suits) }); }); this.cur=d.cur; this.turn=d.turn; this.phase=d.phase; this.stocks=d.stocks; this.tiles=d.tiles; this.rolledThisTurn=d.rolledThisTurn; this.extraRollAvailable=d.extraRollAvailable; this.extraRollConsumed=d.extraRollConsumed; this.renderBoard(); this.refresh(); },
            __setTestMode: function(v){ this.__testMode=!!v; }
        };

        // ===== Utilities =====
        var wait = function(ms){ return new Promise(function(r){ return setTimeout(r,ms); }); };

        // ===== DOM =====
        var boardEl = document.getElementById('board');
        var playersEl = document.getElementById('players');
        playersEl.addEventListener('click', function(e) {
            if (e.target.classList.contains('btn-sell-prop')) {
                var ix = e.target.dataset.ix;
                var p = game.players[game.cur];
                // can only sell own properties on own turn
                if (p.id !== game.cur) return;
                var t = game.tileAt(ix);
                if (t.owner !== p.id) return;

                game.sellProperty(p, t);
            }
        });
        var logEl = document.getElementById('log');
        var curPEl = document.getElementById('curP');
        var turnEl = document.getElementById('turn');
        var phaseEl = document.getElementById('phase');
        var btnRoll = document.getElementById('btnRoll');
        var btnBuy = document.getElementById('btnBuy');
        var btnInvest = document.getElementById('btnInvest');
        var btnMarket = document.getElementById('btnMarket');
        var btnEnd = document.getElementById('btnEnd');
        var btnSave = document.getElementById('btnSave');
        var btnLoad = document.getElementById('btnLoad');
        var btnReset = document.getElementById('btnReset');
        var btnTests = document.getElementById('btnTests');
        var btnLogScroll = document.getElementById('btnLogScroll');

        var dlgSettings = document.getElementById('dlgSettings');
        var numPlayersEl = document.getElementById('numPlayers');
        var winTargetInputEl = document.getElementById('winTargetInput');
        var btnStartGame = document.getElementById('btnStartGame');

        var dlgBuy=document.getElementById('dlgBuy');
        var buyInfo=document.getElementById('buyInfo');
        var btnDoBuy=document.getElementById('btnDoBuy');
        var dlgInvest=document.getElementById('dlgInvest');
        var investInfo=document.getElementById('investInfo');
        var investAmt=document.getElementById('investAmt');
        var btnDoInvest=document.getElementById('btnDoInvest');
        var dlgMarket=document.getElementById('dlgMarket');
        var marketBody=document.getElementById('marketBody');
        var btnDoMarketBuy=document.getElementById('btnDoMarketBuy');
        var dlgAskTrade=document.getElementById('dlgAskTrade');
        var btnTradeYes=document.getElementById('btnTradeYes');
        var btnTradeNo=document.getElementById('btnTradeNo');
        var dlgCard=document.getElementById('dlgCard');
        var cardText=document.getElementById('cardText');
        var dlgFork=document.getElementById('dlgFork');
        var forkText=document.getElementById('forkText');
        var forkBtns=document.getElementById('forkBtns');

        var logAutoScroll = true;
        function log(msg){
            var p=document.createElement('p');
            p.textContent=msg;
            logEl.appendChild(p);
            if (logAutoScroll) {
                logEl.scrollTop = logEl.scrollHeight;
            }
        }
        game.log = log;
        function refreshUI(){ game.refresh(); }

        // Events

        window.addEventListener('resize', function(){ game.renderPawns(); });

        btnLogScroll.onclick = function() {
            logAutoScroll = !logAutoScroll;
            btnLogScroll.textContent = 'Auto-Scroll: ' + (logAutoScroll ? 'On' : 'Off');
        };

        function openMarketDialog() {
            var p = game.players[game.cur];
            marketBody.innerHTML = "";
            DISTRICTS.forEach(function(d) {
                var row = document.createElement('tr');
                row.innerHTML = '<td>' + d + '</td>' +
                    '<td>' + game.stocks[d].price + '</td>' +
                    '<td>' + p.stocks[d] + '</td>' +
                    '<td><input type="number" class="market-qty" data-district="' + d + '" value="0" step="10"></td>';
                marketBody.appendChild(row);
            });
            dlgMarket.showModal();
        }

        // Button handlers
        btnRoll.onclick = function(){ if(!game.canRoll()) return; game.turnRoll(); };
        btnBuy.onclick = function(){ var p=game.players[game.cur]; var t=game.tileAt(p.pos); if(!(t.type==='prop' && t.owner===null)) return; buyInfo.innerHTML = '<div>Buy <strong>' + t.name + '</strong> (' + t.district + ') for <strong>' + t.price + 'G</strong>?<br>Balance: ' + p.cash + 'G → ' + (p.cash - t.price) + 'G</div>'; dlgBuy.showModal(); };
        btnDoBuy.onclick = function(){ game.doBuy(); dlgBuy.close(); };
        btnInvest.onclick = function(){ var p=game.players[game.cur]; var t=game.tileAt(p.pos); if(!(t.type==='prop' && t.owner===p.id)) return; investInfo.textContent = t.name + ' value ' + t.price + 'G / District ' + t.district; investAmt.value=100; dlgInvest.showModal(); };
        btnDoInvest.onclick = function(){ var amt=+investAmt.value|0; game.doInvest(amt); dlgInvest.close(); };
        btnMarket.onclick = function(){
            openMarketDialog();
        };
        btnDoMarketBuy.onclick = function() {
            var p = game.players[game.cur];
            var transactions = [];
            var totalCost = 0;
            var isBuying = false;
            document.querySelectorAll('.market-qty').forEach(function(input) {
                var qty = parseInt(input.value, 10);
                if (isNaN(qty) || qty === 0) return;
                if (qty > 0) isBuying = true;
                var dist = input.dataset.district;
                var price = game.stocks[dist].price;
                totalCost += qty * price;
                transactions.push({dist: dist, qty: qty});
            });

            if (isBuying && game.boughtStockThisTurn) {
                game.log("You can only buy stocks once per turn.");
                return;
            }

            if (p.cash < totalCost) {
                game.log("Not enough cash for these transactions.");
                return;
            }

            if (transactions.length > 0) {
                transactions.forEach(function(t) {
                    if (t.qty > 0) {
                        game.buyStock(p, t.dist, t.qty);
                    } else {
                        game.sellStock(p, t.dist, -t.qty);
                    }
                });
                if (isBuying) {
                    game.boughtStockThisTurn = true;
                }
            }
            dlgMarket.close();
            game.refresh();
        };
        btnEnd.onclick = function(){ game.endTurn(); };
        btnSave.onclick = function(){ game.save(); };
        btnLoad.onclick = function(){ game.load(); };
        btnReset.onclick = function(){ if(confirm('Reset the game?')) game.init(2); };

        // ===== Developer Tests =====
        function assert(cond, msg){ if(cond){ game.log('✅ TEST PASS: ' + msg);} else { game.log('❌ TEST FAIL: ' + msg);} }
        async function runTests(){
            var snap = game.__snapshot(); game.__setTestMode(true);
            try{
                // T1: netWorth includes properties
                var p = game.players[game.cur];
                var aProp = game.tiles.find(function(t){ return t.type==='prop'; }); aProp.owner=p.id; var bak=aProp.price; aProp.price=500; p.cash=1000; p.stocks.A=2; game.stocks.A.price=50; assert(game.netWorth(p)===1000+2*50+500, 'netWorth = cash + stocks + properties'); aProp.price=bak; aProp.owner=null;

                // T2: extra roll in same turn
                game.phase='Idle'; game.rolledThisTurn=false; await game.turnRoll();
                game.extraRollAvailable=true; game.extraRollConsumed=false; assert(game.canRoll(), 'extra roll is allowed');
                var pos1=game.players[game.cur].pos; await game.turnRoll(); var pos2=game.players[game.cur].pos; assert(pos2!==pos1, 'second roll advances');

                // T3: forced stop at bank
                var bNeighbors = adj[bankIx]; var near = bNeighbors[0]; game.players[game.cur].pos=near; game.players[game.cur].lastPos=bankIx; game.phase='Idle'; game.rolledThisTurn=false; game.players[game.cur].nextRoll=6; await game.turnRoll(); assert(game.players[game.cur].pos===bankIx, 'forced stop at bank');

                // T4: fork landing stores pending direction
                var forkNode = tiles.find(function(t){ return t.fork; }).ix; var nb = adj[forkNode];
                game.players[game.cur].pos = nb[0]; game.players[game.cur].lastPos = nb[1]; game.players[game.cur].nextRoll=1; game.phase='Idle'; game.rolledThisTurn=false; await game.turnRoll(); assert(!!game.players[game.cur].pendingFork, 'direction reserved at fork');
            } finally { game.__restore(snap); game.__setTestMode(false); }
        }
        document.getElementById('btnTests').onclick = runTests;

        // First draw
        dlgSettings.showModal();

        btnStartGame.onclick = function() {
            var numPlayers = +numPlayersEl.value;
            var winTarget = +winTargetInputEl.value;
            game.init(numPlayers, winTarget);
            dlgSettings.close();

        };

    })();

(function (scope) {
  function qmarks(socket,userName) {
    window.socket = this.socket = socket;
    window.SID = socket.socket.sessionid;
    this.userName = userName;
    this.initialize();
  }
  var p = qmarks.prototype;

  p.initialize = function() {
    var s = this,w=window;

    w.canvas = this.canvas = document.createElement('canvas'); 
    this.canvas.width = getScreenWidth(); 
    this.canvas.height = getScreenHeight();
    this.SCALE = w.S = Math.min(this.canvas.width / 500, this.canvas.height/270);
    w.MS = this.canvas.width / 500;
    w.GS = 4;
    w.RS = S / 4;
    document.body.insertBefore(this.canvas,document.body.firstChild); 
    w.ctx = this.canvas.getContext("2d");

    w.bgCanvas = this.bgCanvas = document.createElement('canvas');
    this.bgCanvas.width = this.canvas.width;
    this.bgCanvas.height = this.canvas.height;

    w.fgCanvas = this.fgCanvas = document.createElement('canvas');
    this.fgCanvas.width = this.canvas.width;
    this.fgCanvas.height = this.canvas.height;

    window.tileSet = nearestNeighborScale(document.getElementById('tileset'), GS);

    s.lane = [];
    s.deltaT = new Date().getTime();
    setInterval(function() {
      s.tick();
    }, 30);

    s.menu = new CreepMenu();
    s.challengedBy = [];
    s.help = false;

    /*
      PLAYER INPUT EVENTS
    */
    var f = function(e){s.handleMouseUp(e)};
    if ( 'ontouchstart' in window ) {
      s.canvas.addEventListener("touchstart", f, false);
      s.canvas.addEventListener("touchmove", f, false);
      s.canvas.addEventListener("touchend", f, false);
      s.canvas.addEventListener("touchcancel", f, false);
    }
    s.canvas.onmouseup = f;
    document.onkeyup = function(e) {
      var c = parseInt(String.fromCharCode(e.keyCode));
      if ( s.currentGame && c<=4 && c>0 ) {
        s.currentGame.currentCreep = c-1;
      } else if ( e.keyCode == 72 ) {
        s.help = !s.help;
      }
    }
    w.onbeforeunload = function() {
      s.socket.emit('disconnect');
    }

    /*
      SOCKET EVENTS
    */
    s.socket.on('joinedGame', function(e) {
      s.onJoined(e);
    });
    s.socket.on('lobbyList', function(e) {
      s.lobbyList = e.clients;
    });
    s.socket.on('challengeOn', function(e) {
      s.challengedBy.push(e);
    });
    s.socket.on('challengeOff', function(e) {
      s.challengedBy.splice(s.challengedBy.indexOf(e),1);
    });
    s.socket.on('clientList', function(e) {
      s.currentGame.updatedClientList(e);
    });
    s.socket.on('gameStart', function(e) {
      s.currentGame.onStart(e);
    });
    s.socket.on('update', function(e) {
      if ( !s.currentGame ) return;
      s.currentGame.money = e.money;
      s.currentGame.nextIncomeIn = e.nextIncomeIn;
      s.currentGame.lives = e.lives;
      s.onKilledUnits(e.killedUnits);
      s.onUnitDeploy(e.deployedUnits);
    });
    s.socket.on('playerDied', function(e) {
      s.currentGame && (s.currentGame.deadClients.push(e.id));
    });
    s.socket.on('playerLeft', function(e) {
      s.currentGame && (s.currentGame.leftClients.push(e.id)) && (s.currentGame.deadClients.push(e.id));
    });
    s.socket.on('playerWon', function(e) {
      if ( s.currentGame) {
        if ( e.id == window.SID ) {
          s.wonLast = 1;
        } else {
          s.wonLast = 0;
        }
        delete s.currentGame;
      }
    });
    s.socket.on('foundOneMatchButWaiting', function(e) {
      document.getElementById('info').innerHTML = '1 Player found, waiting 3 more seconds...';
    });

    socket.emit('setName',{name:s.userName});
    document.getElementById('info').style.display = 'none';
  }

  p.tick = function() {
    ctx.clearRect(0,0,this.canvas.width,this.canvas.height);

    var delta = -(this.deltaT - (this.deltaT = new Date().getTime())),
        dF = ( delta / 1000 );

    if ( this.currentGame ) {
      this.currentGame.tick(dF);
      this.menu.y = 10*S;
      this.menu.update(this.currentGame.currentCreep);
    } else {
      this.drawLobbyList();
    }

    ctx.font = "bold 12px Courier";
    ctx.fillStyle = "#fff";
    ctx.textAlign = 'right';
    ctx.fillText('h: Help', this.canvas.width-10, 10);
    ctx.textAlign = 'left';

    if ( this.help ) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = "#fff";
      ctx.font = "14px Courier";

      var c,l,cl,x =20, y = 30, t=["Instructions:","The goal of the game is it so steal all your opponents lives.","Click one of the enemy lanes to attack with creeps(this will increase your income)","and click on your own lane to position defending creeps(this will NOT increase your income).","Every 15 seconds you will receive your income to deploy more creeps.","But keep in mind that only attacking will increase your income,","so don't just sit there and defend like a coward!","","","About this game:","This game was created as part of the js13kgames.com 2013 Gamejam and the client,","as well as the server are each only 13kb in size.","","Created by Olaf Horstmann, indiegamr.com"];
      for(c=0,l=t.length;c<l;c++){
        ctx.fillText(t[c], x, y);
        y+=18;
      }
    }
  }

  p.drawLobbyList = function() {
    if ( !this.lobbyList ) return;
    var c,l,col,ctx=window.ctx,k,u,to,ci,nx=((this.canvas.width-20)/110)|0,x,y;
    ctx.font = "bold 12px Courier";
    ctx.fillStyle = "#fff";
    ctx.textAlign = 'center';
    ctx.fillText('Click on the name you want to challenge or choose a Random Game. Red = Wants to challenge you.', this.canvas.width/2, 15);
    ctx.fillText(this.wonLast===0?'Sorry, you lost - maybe next time!':this.wonLast===1?'Congratulations you just won!':'', this.canvas.width/2, 30);
    ctx.textAlign = 'left';
    for ( c=0,l=this.lobbyList.length;c<l;c++) {
      ci = this.lobbyList[c];
      x = (c%nx)*110 + 10;
      y = ((c/nx)|0) * 30 + 50;
      ctx.fillStyle = this.challengedBy.indexOf(ci.id)>=0?'rgb(255,215,215)':this.challenged==ci.id?'rgb(215,255,215)':'rgb(255,255,255)';
      ctx.fillRect(x,y,100,30);
      ctx.fillStyle = "#000";
      ctx.textAlign = 'center';
      ctx.fillText(ci.name, x+50, y+19);
      ctx.textAlign = 'left';
    } 
  }

  p.handleMouseUp = function(e) {
    e.x = e.pageX;
    e.y = e.pageY;
    e.preventDefault();
    var i,ex,ey,ei,nx;
    if ( !this.currentGame ) {
      nx = ((this.canvas.width-20)/110)|0;
      ex = ((e.x-10)/110)|0;
      ey = Math.floor((e.y-50)/30);
      i = ex + nx*ey;
      if ( i >= 0 && this.lobbyList[i] ) {
        if ( this.challenged == this.lobbyList[i].id || this.lobbyList[i].id == SID ) {
          this.challenged = undefined;
        } else if ( this.lobbyList[i].id != SID ) {
          this.challenged = this.lobbyList[i].id;
        }
        this.socket.emit('requestGame',this.lobbyList[i].id);  
      }
      document.getElementById('info').innerHTML = 'Waiting for other player...';
    } else if ( this.currentGame && this.currentGame.started ) {
      if ( e.y < this.currentGame.clients.length*100*S+60*S && e.y > 60*S ) {
        this.socket.emit('clicked',{x:e.x/MS,y:(e.y-60*S)/S,type:CREEP_MAP[this.currentGame.currentCreep]});
      }
      if ( isNaN(i) || i >= this.currentGame.clients.length ) {
        if ( e.x > this.menu.x+10*S && e.y > this.menu.y && e.y < 60*S) {
          ex = (e.x / (140*S))|0;
          ey = ((e.y-this.menu.y)/(25*S))|0;
          ei = ex*2 + ey;
          console.log(ei,CREEP_MAP.length);
          if ( ei < CREEP_MAP.length ) this.currentGame.currentCreep = ei;
        }
      }
    }
  }

  p.onJoined = function(e) {
    this.currentGame = new Game(e);
    this.currentGame.app = this;
  }

  p.onUnitDeploy = function(e) {
    this.currentGame.deployUnits(e);
  }

  p.onKilledUnits = function(e) {
    var c,l,u;
    if ( !this.currentGame ) return;

    for ( c = 0, l = e.length; c<l; c++ ) {
      u = this.currentGame.killUnit(e[c].id);
      if ( u && SID == e[c].killedBy && e[c].income ) {
        this.currentGame.tickObjs.push(new FX('coin',u.x,u.y-5*RS,0,-65*S,250*S));
      }
    }
  }

  p.onSwitchLaneUnit = function(e) {
    if ( !this.currentGame ) return;

    var u = this.currentGame.units[e.id];
    u.x = e.x;
    u && u.switchToLane(e.i);
  }

  scope.qmarks = qmarks; 
} (window));

(function (scope) {
  function Game(id) {
    this.id = id;
    this.unitsOfUser = {};
    this.units = {};
    this.unitsToKill = [];
    this.unitsToDeploy = [];
    this.clients = [];
    this.deadClients = [];
    this.leftClients = [];
    this.lanes = {};
    this.tickObjs = [];
    this.killedUnits = [];

    this.started = false;
    this.currentCreep = 0;

    this.coin = new Sprite(390,0,10,10,2);
    this.coinp = new Sprite(380,0,10,10,2);
    this.heart = new Sprite(380,10,10,10,2);
    this.clock = new Sprite(390,10,10,10,2);
  }
  var p = Game.prototype;

  p.updatedClientList = function(clientList) {
    if ( !this.started ) {
      this.clients = clientList;
    }
  }

  p.onStart = function(e) {
    for ( var c = 0, l = this.clients.length; c<l; c++ ) {
      this.lanes[this.clients[c]] = [];
    }
    this.deployUnits(e);
    this.started = !0;
    this.nextIncomeIn = 15000;
    document.getElementById('info').style.display = 'none';


    var i = this.clients.indexOf(SID),cl,c,l,col,ctx=bgCanvas.getContext('2d'),x,y,
        tw = 20 * S,ctx2=fgCanvas.getContext('2d');
    var ts = new Sprite(300,80,20,20),fe = new Sprite(300,60,12,9),
        doodads = [new Sprite(320,80,20,20), new Sprite(340,80,20,20), new Sprite(360,80,20,20), new Sprite(380,80,20,20),
                   new Sprite(320,60,20,20), new Sprite(340,60,20,20), new Sprite(360,60,20,20), new Sprite(380,60,20,20)],d;
    for ( c=0,l=this.clients.length;c<l;c++) {
      cl = this.clients.length;
      x = 0;
      while ( x<bgCanvas.width ) {
        for ( y = 0; y < 5; y++ ) {
          ts.x = x;
          ts.y = c * 100*S + y * 20 *S;
          ts.draw(ctx);
          if ( Math.random() < 0.2 ) {
            d = doodads[Math.floor(Math.random()*doodads.length-0.1)] || doodads[0];
            d.x = ts.x;
            d.y = ts.y;
            d.draw(ctx);
          }
        }
        x += tw;
      }
      x = 0;
      while ( x<bgCanvas.width ) {
          fe.x = x;
          fe.y = (c+1) * 100 * S - 9*S -1*S;
          fe.draw(ctx2);
        x += 12*S;
      }

      ctx.save();
      ctx.translate(c==i?20*S:490*MS, c*100*S + 50*S);
      ctx.rotate(-Math.PI/2);
      ctx.textAlign = "center";
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = ""+((17*S)|0)+"px Arial";
      ctx.fillText(c==i?"Defend here!":"Attack here!", 0, 0);
      ctx.restore();

      if ( this.app.challengedBy.indexOf(cl)>=0 ) {
        this.app.challengedBy.splice(this.app.challengedBy.indexOf(cl),1);
      }
    }
    this.app.challenged = undefined;
  }

  p.deployUnits = function(e) {
    var ud, u, c, l, lane;

    for ( c = 0, l = e.length; c < l; c++) {
      ud = e[c];
      if ( this.killedUnits.indexOf(ud.id) >= 0 ) continue;
      lane = this.lanes[ud.lane] = this.lanes[ud.lane] || [];
      u = new window[ud.name](ud.id,ud.type);
      u.lane = lane;
      lane.push(u);
      u.x = ud.x*MS;
      u.y = ud.y*S+60*S||0;
      u.bspeed = u.speed = ud.speed*MS;
      u.owner = ud.owner;
      u.game = this;
      this.units[u.id] = u;
    }
  }

  p.killUnit = function(id) {
    this.killedUnits.push(id);
    var u = this.units[id];
    if ( !u ) return;

    u.lane.splice(u.lane.indexOf(u),1);
    delete this.units[id];

    return u;
  }

  p.tick = function(dF) {
    if ( !this.started ) return;

    this.nextIncomeIn -= dF*1000;
    this.nextIncomeIn = Math.max(this.nextIncomeIn, 0);

    //draw lanes
    var i = this.clients.indexOf(window.SID),c,l,col,ctx=window.ctx,k,u,to,ci;
    ctx.drawImage(bgCanvas,0,60*S,bgCanvas.width,bgCanvas.height);
    for ( c=0,l=this.clients.length;c<l;c++) {

      if ( this.deadClients.indexOf(ci=this.clients[c]) >= 0 || this.leftClients.indexOf(ci) >= 0 ) {
        ctx.fillStyle = 'rgba(50,50,50,0.5)';
        ctx.fillRect(0,c*100*S+21*S,500*S,99*S);
        ctx.fillStyle = "#AAA";
        ctx.font = "bold 16px Arial";
        ctx.fillText((this.leftClients.indexOf(ci) >= 0)?'LEFT GAME':'DEFEAT', 200, c*50+35);
      }
    }

    //tick&draw units
    for ( k in this.units ) {
      u = this.units[k];
      u.update(dF);
    }

    for ( var c = 0, l = this.tickObjs.length; c < l; c++ ) {
      (to = this.tickObjs[c]) && to.update(dF) == 'rm' && this.tickObjs.splice(c,1);
    }

    ctx.drawImage(fgCanvas,0,60*S,fgCanvas.width,fgCanvas.height);

    if ( this.money ) {
      ctx.fillStyle = "#fff";
      ctx.font = "normal "+(18*S)+"px Arial";

      var cw = canvas.width;
      this.coin.y = 5 * S;
      this.coin.x = cw - 145*S;
      this.coin.draw();
      ctx.fillText(this.money.balance, cw -115*S, 20 * S);

      this.coinp.y = 30 * S;
      this.coinp.x = cw - 145*S;
      this.coinp.draw();
      ctx.fillText(this.money.income, cw -115*S, 45 * S);

      this.heart.y = 5 * S;
      this.heart.x = cw - 60*S;
      this.heart.draw();
      ctx.fillText(this.lives, cw - 30*S, 20 * S);

      this.clock.y = 30 * S;
      this.clock.x = cw - 60*S;
      this.clock.draw();
      ctx.fillText((this.nextIncomeIn/1000)|0, cw - 30*S, 45 * S);
    }
  }

  scope.Game = Game; 
} (window));

(function (scope) {
  function Sprite(x,y,w,h,s) {
    this.rect = {x:x,y:y,width:w,height:h};
    this.visible = !0;
    if ( s ) this.sx = this.sy = s;
  }
  var p = Sprite.prototype;

  p.update = function(dF) {
    this.draw();
  }

  p.draw = function(ctx) {
    if(!this.visible)return;
    ctx = ctx || window.ctx;
    var r = this.rect;
    ctx.save();
    ctx.translate((this.x|0)||0,(this.y|0)||0);
    ctx.scale((this.sx||1)*RS,(this.sy||1)*RS);
    ctx.drawImage(window.tileSet,r.x*GS,r.y*GS,r.width*GS,r.height*GS,0,0,r.width*GS,r.height*GS);
    ctx.restore();
  }

  scope.Sprite = Sprite; 
} (window));

(function (scope) {
  function CreepMenu() {
    var s = this;
    s.creep = 0;
    s.visible = !0;
    s.x = s.y = 0;
    s.sprites = [new Sprite(0,0,20,20),new Sprite(0,20,20,20),new Sprite(0,40,20,20),new Sprite(0,60,20,20)];
  }
  var p = CreepMenu.prototype;

  p.update = function(creep) {
    this.creep = creep;
    this.draw();
  }

  p.draw = function(ctx) {
    var c,l,b,cr;
    ctx = ctx||window.ctx;
    if(!this.visible)return;

    for ( c=0,l=CREEP_MAP.length;c<l;c++) {
      cr = CREEP_MAP[c];
      b = this.sprites[c];
      b.x = this.x + ((c/2)|0) * 140 * S + 10 * S;
      b.y = this.y + (c%2) * 25 * S;
      b.draw();
      ctx.fillStyle = "#fff";
      ctx.font = (8*S)+"px Arial";
      ctx.fillText('['+(c+1)+']Cost: '+CREEPS[cr].cost+', Income: +'+CREEPS[cr].income, b.x + 27*S, b.y + 14*S);

      if ( this.creep == c ) {
        ctx.strokeStyle = '#0f0';
      } else {
        ctx.strokeStyle = '#444';
      }

        ctx.fillStyle = undefined;
        ctx.strokeRect(b.x-1*S,b.y-1*S,22*S,22*S);
        ctx.strokeStyle = undefined;
    }
  }

  scope.CreepMenu = CreepMenu; 
} (window));


(function (scope) {
  scope.CREEP_MAP = ['butterfly','sheep','dsheep','panda'];
  scope.CREEPS = {
    butterfly:{
      id:'butterfly',
      cost: 5,
      income: 2,
      anims: {
        run: {
        frames: [0,0,0,1,1,1,2,2,2,3,3,3,3,3,2,2,2,1,1,1]
        },
        hit: {
          frames: [7,8,8,8,9,9,9,9,9,8,8,8,7,7,7,7,7]
        },
        stand: {
          frames: [7,7,7,7,7,8,8,8,8,8,9,9,9,9,9,8,8,8,8,8]
        }
      }
    },
    sheep:{
      id:'sheep',
      cost: 25,
      income: 9,
      anims: {
        run: {
          frames: [20,20,20,21,21,21,22,22,22,23,23,23,22,22,22,21,21,21]
        },
        hit: {
          frames: [27,28,28,28,29,29,29,29,29,27,27,27,27,27]
        }
      }
    },
    dsheep:{
      id:'dsheep',
      cost: 125,
      income: 40,
      anims: {
        run: {
          frames: [40,40,40,41,41,41,42,42,42,43,43,43,42,42,42,41,41,41]
        },
        hit: {
          frames: [47,48,48,48,49,49,49,49,49,47,47,47,47,47]
        }
      }
    },
    panda:{
      id:'panda',
      cost: 625,
      income: 180,
      anims: {
        run: {
          frames: [60,60,60,61,61,61,62,62,62,63,63,63,64,64,64]
        },
        hit: {
          frames: [67,68,68,68,69,69,69,69,69,67,67,67,67,67]
        }
      }
    },
    bullet:{
      id:'bullet',
      anims: {
        run: {
          frames: [18]
        },
        hit: {
          frames: [18]
        }
      }
    }
  };

  function Runner(id,type) {
    this.id = id;
    this.type = CREEPS[type];
    this.initialize();
  }
  var p = Runner.prototype;

  p.initialize = function() {
    this.x = this.y = 0;
    this.gotoAndPlay('run');
  }

  p.gotoAndPlay = function(anim) {
    if ( this.cA != this.type.anims[anim] ) {
      this.cA = this.type.anims[anim];
      this.cF = 0;
      return !0;
    }
    return false;
  }

  p.update = function(dF) {
    this.tick(dF);
    this.draw();
  }

  p.tick = function(dF) {
    (this.speed || this.hitting || this.type.anims['stand'] == this.cA) && (this.cF++);
    if ( this.cF > this.cA.frames.length-1 ) {
      if ( this.cA.nxt != undefined ) {
        this.gotoAndPlay(this.cA.nxt);
      } else {
        this.cF = 0;
      }
    }

    this.hitting = false;
    for (var c = 0, l = this.lane.length; c<l;c++) {
      var r = this.lane[c];
      if ( r.owner == this.owner/*r == this*/ ) continue;
      if ( Math.abs(r.x - this.x) < 12*S && this.type.id != 'bullet' && r.type.id != 'bullet' ) {
        this.hitting = !0;
        if ( this.gotoAndPlay('hit') && Math.random() < 0.5 ) {
          this.cF = 7;
        }
        break;
      }
    }

    if ( !this.hitting && this.speed ) {
      this.gotoAndPlay('run');
      this.x += this.speed * dF;
    } else if ( !this.hitting && !this.type.anims['stand'] ) {
      this.cF = 0;
    } else if ( this.type.anims['stand'] ) {
      this.gotoAndPlay('stand');
    }
  }

  p.getX = function() {
    this.sx = Math.abs(this.speed)/this.speed || this.sx || 1;
    return (this.x-(this.sx*10*RS))|0;
  }

  p.draw = function(ctx) {
    ctx = ctx || window.ctx;
    
    var f = this.cA.frames[this.cF];
    ctx.save();
    ctx.translate(this.getX(),(this.y-5*RS)|0);
    ctx.scale(this.sx*RS,1*RS);
    ctx.drawImage(window.tileSet,(f%20)*20*GS,Math.floor(f/20)*20*GS,20*GS,20*GS,0,0,20*GS,20*GS);
    ctx.restore();
  }

  scope.Runner = Runner; 
} (window));

(function (scope) {
  function FX(id,x,y,vx,vy,lt) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.lt = lt || 1000;
  }

  FX.s = {
    coin: {
      x: 390, y: 0, width: 10, height: 10
    }
  };

  var p = FX.prototype;

  p.update = function(dF) {
    this.tick(dF);
    this.draw();

    this.lt -= dF * 1000;
    if ( this.lt <= 0 ) return 'rm';
  }

  p.tick = function(dF) {
    this.x += this.vx * dF;
    this.y += this.vy * dF;
  }

  p.draw = function(ctx) {
    ctx = ctx || window.ctx;
    var r = FX.s[this.id];
    ctx.save();
    ctx.translate((this.x-r.width/2*RS)|0,this.y|0);
    ctx.scale(RS,RS);
    ctx.drawImage(window.tileSet,r.x*GS,r.y*GS,r.width*GS,r.height*GS,0,0,r.width*GS,r.height*GS);
    ctx.restore();
  }

  scope.FX = FX; 
} (window));

getScreenWidth = function() {
  if( typeof( window.innerWidth ) == 'number' ) {
    return window.innerWidth;
  } else if( document.documentElement && ( document.documentElement.clientWidth || document.documentElement.clientHeight ) ) {
    return document.documentElement.clientWidth;
  } else if( document.body && ( document.body.clientWidth || document.body.clientHeight ) ) {
    return document.body.clientWidth;
  }
}
getScreenHeight = function() {
  if( typeof( window.innerWidth ) == 'number' ) {
    return window.innerHeight;
  } else if( document.documentElement && ( document.documentElement.clientWidth || document.documentElement.clientHeight ) ) {
    return document.documentElement.clientHeight;
  } else if( document.body && ( document.body.clientHeight || document.body.clientHeight ) ) {
    return document.body.clientHeight;
  }
}

function nearestNeighborScale(img, scale) {
  scale = snapValue(scale,.5);
  if ( scale <= 0 ) scale = 0.5;

  var pixelSize = (scale+0.99) | 0;

  var src_canvas = document.createElement('canvas');
  src_canvas.width = img.width;
  src_canvas.height = img.height;
  var src_ctx = src_canvas.getContext('2d');
  src_ctx.drawImage(img, 0, 0);
  var src_data = src_ctx.getImageData(0, 0, img.width, img.height).data;

  var dst_canvas = document.createElement('canvas');

  dst_canvas.width = (img.width * scale+1) | 0;
  dst_canvas.height = (img.height * scale+1) | 0;
  var dst_ctx = dst_canvas.getContext('2d');

  var offset = 0;
  for (var y = 0; y < img.height; ++y) {
      for (var x = 0; x < img.width; ++x) {
          var r = src_data[offset++];
          var g = src_data[offset++];
          var b = src_data[offset++];
          var a = src_data[offset++] / 255;
          dst_ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
          dst_ctx.fillRect(x * scale, y * scale, pixelSize, pixelSize);
      }
  }
  
  return dst_canvas;
}

function snapValue(value,snap)
{
  var roundedSnap = (value/snap + (value > 0 ? .5 : -.5)) | 0;
  return roundedSnap * snap;
}

connect = function() {
  var socket = io.connect(window.location.hostname),
      name = document.getElementById('playerName').value;
  socket.on('connected', function (data) {
    new qmarks(socket,name);
  });
  document.getElementById('info').innerHTML = "Connecting... please wait..."
};

inputkeydown = function(e) {
  if ( e.keyCode == 13 ) connect();
}
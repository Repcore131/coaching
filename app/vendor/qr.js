/* qr.js — encodeur QR minimal, en JavaScript pur.
 *
 * ECRIT POUR REPCORE, et volontairement reduit a ce dont l application a
 * besoin : encoder une URL courte (APP_BASE_URL) en mode octet, niveau de
 * correction M — exactement ce que servait le service tiers retire, dont le
 * niveau par defaut etait M lui aussi. Pas de mode numerique, pas de mode
 * kanji, pas de masque configurable :
 * les huit masques sont evalues et le meilleur retenu, comme le veut la norme.
 *
 * Il remplace un appel a un tiers qui recevait l adresse IP de chaque visiteur
 * ouvrant la fenetre de synchronisation, pour dessiner des carres noirs.
 *
 * Reference : ISO/IEC 18004. Domaine public — aucune licence tierce, aucun
 * fichier a versionner en plus de celui-ci.
 */
(function(global){
'use strict';

// ── Galois GF(256), polynome generateur 0x11D ──────────────────────────────
var EXP=new Array(512), LOG=new Array(256);
(function(){
  var x=1;
  for(var i=0;i<255;i++){ EXP[i]=x; LOG[x]=i; x<<=1; if(x&0x100) x^=0x11D; }
  for(var j=255;j<512;j++) EXP[j]=EXP[j-255];
})();
function gmul(a,b){ return (a===0||b===0)?0:EXP[LOG[a]+LOG[b]]; }

// Polynome generateur de degre `deg`, pour le code de Reed-Solomon.
function genPoly(deg){
  var p=[1];
  for(var i=0;i<deg;i++){
    var np=new Array(p.length+1).fill(0);
    for(var j=0;j<p.length;j++){
      np[j]^=gmul(p[j],1);
      np[j+1]^=gmul(p[j],EXP[i]);
    }
    p=np;
  }
  return p;
}
function rsEncode(data,deg){
  var gen=genPoly(deg), res=new Array(deg).fill(0);
  for(var i=0;i<data.length;i++){
    var f=data[i]^res[0];
    res.shift(); res.push(0);
    if(f!==0) for(var j=0;j<deg;j++) res[j]^=gmul(gen[j+1],f);
  }
  return res;
}

// ── Tables, niveau M uniquement, versions 1 a 10 ───────────────────────────
// [total codewords, codewords de donnees, nb blocs groupe1, nb blocs groupe2]
var CAP_M=[
  null,
  [26,16,1,0],[44,28,1,0],[70,44,1,0],[100,64,2,0],[134,86,2,0],
  [172,108,4,0],[196,124,4,0],[242,154,2,2],[292,182,3,2],[346,216,4,1]
];
// Positions des motifs d alignement, par version.
var ALIGN=[null,[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
// Chaines de format pre-calculees pour le niveau M et les 8 masques.
var FORMAT_M=[0x5412,0x5125,0x5E7C,0x5B4B,0x45F9,0x40CE,0x4F97,0x4AA0];

function tailleVersion(v){ return v*4+17; }

// ── Construction ───────────────────────────────────────────────────────────
function encoderOctets(texte){
  // UTF-8 : une URL peut porter des caracteres accentues.
  var s=unescape(encodeURIComponent(texte)), out=[];
  for(var i=0;i<s.length;i++) out.push(s.charCodeAt(i)&0xFF);
  return out;
}
function choisirVersion(n){
  for(var v=1;v<=10;v++){
    var dc=CAP_M[v][1];
    // 4 bits de mode + 8 ou 16 bits de longueur + n octets.
    var entete=(v<10)?2:3;   // en octets approches, arrondi par exces plus bas
    var bits=4+((v<10)?8:16)+n*8;
    if(bits<=dc*8) return v;
  }
  return 0;   // au-dela, on refuse plutot que de tronquer une URL
}

function construireDonnees(texte,v){
  var oct=encoderOctets(texte);
  var bits=[];
  var push=function(val,len){ for(var i=len-1;i>=0;i--) bits.push((val>>i)&1); };
  push(4,4);                              // mode octet
  push(oct.length,(v<10)?8:16);           // longueur
  for(var i=0;i<oct.length;i++) push(oct[i],8);
  var dc=CAP_M[v][1], max=dc*8;
  // Terminateur, au plus 4 bits.
  for(var t=0;t<4&&bits.length<max;t++) bits.push(0);
  while(bits.length%8) bits.push(0);
  // Remplissage alterne, impose par la norme.
  var pad=[0xEC,0x11], k=0;
  while(bits.length<max){ push(pad[k++%2],8); }
  // Bits vers codewords.
  var cw=[];
  for(var b=0;b<bits.length;b+=8){
    var o=0; for(var j=0;j<8;j++) o=(o<<1)|bits[b+j];
    cw.push(o);
  }
  return cw;
}

// Entrelacement des blocs, et de leurs codes correcteurs.
function entrelacer(cw,v){
  var tot=CAP_M[v][0], dc=CAP_M[v][1], g1=CAP_M[v][2], g2=CAP_M[v][3];
  var nb=g1+g2;
  var parBloc1=Math.floor(dc/nb), parBloc2=parBloc1+1;
  var ec=Math.floor((tot-dc)/nb);
  var blocs=[], ecs=[], p=0;
  for(var i=0;i<nb;i++){
    var taille=(i<g1)?parBloc1:parBloc2;
    var d=cw.slice(p,p+taille); p+=taille;
    blocs.push(d); ecs.push(rsEncode(d,ec));
  }
  var out=[], maxD=Math.max.apply(null,blocs.map(function(b){return b.length;}));
  for(var c=0;c<maxD;c++) for(var b2=0;b2<nb;b2++) if(c<blocs[b2].length) out.push(blocs[b2][c]);
  for(var e=0;e<ec;e++) for(var b3=0;b3<nb;b3++) out.push(ecs[b3][e]);
  return out;
}

// ── Matrice ────────────────────────────────────────────────────────────────
function nouvelleMatrice(n){
  var m=[]; for(var i=0;i<n;i++){ m.push(new Array(n).fill(null)); } return m;
}
function poserMotifs(m,v){
  var n=m.length;
  var finder=function(r,c){
    for(var i=-1;i<=7;i++) for(var j=-1;j<=7;j++){
      var rr=r+i, cc=c+j;
      if(rr<0||cc<0||rr>=n||cc>=n) continue;
      var d=(i>=0&&i<=6&&(j===0||j===6))||(j>=0&&j<=6&&(i===0||i===6))
        ||(i>=2&&i<=4&&j>=2&&j<=4);
      m[rr][cc]=d?1:0;
    }
  };
  finder(0,0); finder(0,n-7); finder(n-7,0);
  // Alignement.
  var a=ALIGN[v];
  for(var i2=0;i2<a.length;i2++) for(var j2=0;j2<a.length;j2++){
    var r=a[i2], c=a[j2];
    if(m[r][c]!==null) continue;   // chevauche un finder
    for(var dr=-2;dr<=2;dr++) for(var dc2=-2;dc2<=2;dc2++)
      m[r+dr][c+dc2]=(Math.abs(dr)===2||Math.abs(dc2)===2||(dr===0&&dc2===0))?1:0;
  }
  // Horloges.
  for(var k=8;k<n-8;k++){ if(m[6][k]===null) m[6][k]=(k%2===0)?1:0;
                          if(m[k][6]===null) m[k][6]=(k%2===0)?1:0; }
  m[n-8][8]=1;   // module toujours noir
}
function reserverFormat(m){
  var n=m.length, res=[];
  for(var i=0;i<9;i++){ if(m[8][i]===null){m[8][i]=0;res.push([8,i]);}
                        if(m[i][8]===null){m[i][8]=0;res.push([i,8]);} }
  for(var j=n-8;j<n;j++){ if(m[8][j]===null){m[8][j]=0;} }
  for(var k=n-8;k<n;k++){ if(m[k][8]===null){m[k][8]=0;} }
  return res;
}
function poserDonnees(m,cw){
  var n=m.length, bits=[];
  for(var i=0;i<cw.length;i++) for(var b=7;b>=0;b--) bits.push((cw[i]>>b)&1);
  var idx=0, montant=true;
  for(var col=n-1;col>0;col-=2){
    if(col===6) col--;   // la colonne d horloge est sautee
    for(var t=0;t<n;t++){
      var row=montant?(n-1-t):t;
      for(var c2=0;c2<2;c2++){
        var cc=col-c2;
        if(m[row][cc]!==null) continue;
        m[row][cc]=(idx<bits.length)?bits[idx]:0;
        idx++;
      }
    }
    montant=!montant;
  }
}
function masquer(m,reserve,masque){
  var n=m.length;
  var f=[
    function(r,c){return (r+c)%2===0;},
    function(r){return r%2===0;},
    function(r,c){return c%3===0;},
    function(r,c){return (r+c)%3===0;},
    function(r,c){return (Math.floor(r/2)+Math.floor(c/3))%2===0;},
    function(r,c){return (r*c)%2+(r*c)%3===0;},
    function(r,c){return ((r*c)%2+(r*c)%3)%2===0;},
    function(r,c){return ((r+c)%2+(r*c)%3)%2===0;}
  ][masque];
  var out=[];
  for(var r=0;r<n;r++){ out.push(m[r].slice()); }
  for(var r2=0;r2<n;r2++) for(var c=0;c<n;c++)
    if(!reserve[r2][c]&&f(r2,c)) out[r2][c]^=1;
  return out;
}
function penalite(m){
  var n=m.length, p=0, r, c, i;
  // Regle 1 : suites de 5 modules identiques ou plus.
  for(r=0;r<n;r++){ var run=1;
    for(c=1;c<n;c++){ if(m[r][c]===m[r][c-1]) run++; else { if(run>=5) p+=3+(run-5); run=1; } }
    if(run>=5) p+=3+(run-5); }
  for(c=0;c<n;c++){ var run2=1;
    for(r=1;r<n;r++){ if(m[r][c]===m[r-1][c]) run2++; else { if(run2>=5) p+=3+(run2-5); run2=1; } }
    if(run2>=5) p+=3+(run2-5); }
  // Regle 2 : blocs 2x2 uniformes.
  for(r=0;r<n-1;r++) for(c=0;c<n-1;c++)
    if(m[r][c]===m[r][c+1]&&m[r][c]===m[r+1][c]&&m[r][c]===m[r+1][c+1]) p+=3;
  // Regle 3 : motif 1:1:3:1:1 ressemblant a un finder.
  var mot=[1,0,1,1,1,0,1,0,0,0,0];
  var cherche=function(l){ var q=0;
    for(var s=0;s+11<=l.length;s++){ var ok=true;
      for(var k=0;k<11;k++) if(l[s+k]!==mot[k]){ok=false;break;}
      if(ok) q+=40; }
    return q; };
  for(r=0;r<n;r++){ p+=cherche(m[r]);
    var col=[]; for(i=0;i<n;i++) col.push(m[i][r]); p+=cherche(col); }
  // Regle 4 : desequilibre noir/blanc.
  var noirs=0; for(r=0;r<n;r++) for(c=0;c<n;c++) noirs+=m[r][c];
  var pct=noirs*100/(n*n);
  p+=Math.floor(Math.abs(pct-50)/5)*10;
  return p;
}
function poserFormat(m,masque){
  var n=m.length, f=FORMAT_M[masque];
  for(var i=0;i<15;i++){
    var b=(f>>i)&1;
    if(i<6) m[8][i]=b;
    else if(i===6) m[8][7]=b;
    else if(i===7) m[8][8]=b;
    else if(i===8) m[7][8]=b;
    else m[14-i][8]=b;
    if(i<8) m[n-1-i][8]=b;
    else m[8][n-15+i]=b;
  }
  m[n-8][8]=1;
}

// ── API publique ───────────────────────────────────────────────────────────
// Rend une matrice de 0/1, ou null si le texte est trop long.
function matrice(texte){
  var oct=encoderOctets(texte);
  var v=choisirVersion(oct.length);
  if(!v) return null;
  var cw=entrelacer(construireDonnees(texte,v),v);
  var n=tailleVersion(v);
  var m=nouvelleMatrice(n);
  poserMotifs(m,v);
  reserverFormat(m);
  // La reserve marque ce qui NE DOIT PAS etre masque.
  var reserve=[]; for(var r=0;r<n;r++){ reserve.push(m[r].map(function(x){return x!==null;})); }
  poserDonnees(m,cw);
  // Les huit masques sont evalues, le moins penalise gagne — comme la norme.
  var best=null,bestP=Infinity,bestI=0;
  for(var i=0;i<8;i++){
    var cand=masquer(m,reserve,i);
    poserFormat(cand,i);
    var p=penalite(cand);
    if(p<bestP){ bestP=p; best=cand; bestI=i; }
  }
  return best;
}

// Dessine sur un canvas. Meme rendu que l ancien service : carre, fond blanc,
// marge de 4 modules (« quiet zone ») imposee par la norme — sans elle, bien
// des lecteurs echouent.
function versCanvas(texte,taille){
  var m=matrice(texte);
  if(!m) return null;
  var n=m.length, marge=4, total=n+marge*2;
  var px=Math.max(1,Math.floor((taille||220)/total));
  var cv=document.createElement('canvas');
  cv.width=cv.height=total*px;
  var g=cv.getContext('2d');
  g.fillStyle='#fff'; g.fillRect(0,0,cv.width,cv.height);
  g.fillStyle='#000';
  for(var r=0;r<n;r++) for(var c=0;c<n;c++)
    if(m[r][c]) g.fillRect((c+marge)*px,(r+marge)*px,px,px);
  return cv;
}

global.RepCoreQR={matrice:matrice,versCanvas:versCanvas};
})(typeof window!=='undefined'?window:this);

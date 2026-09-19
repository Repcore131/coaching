/* ══════════════ RepCoreVideo — ALLÉGER AVANT D'ENVOYER ══════════════════════
 *
 * Écrit pour RepCore, sans dépendance externe autre que les deux copies figées
 * de app/vendor/mp4/ (mp4box pour lire, mp4-muxer pour écrire), chargées À LA
 * DEMANDE : deux cent trente kilo-octets ne partent pas au démarrage pour une
 * fonction que la plupart des ouvertures n'utilisent jamais.
 *
 * ⚠ CE QUE CE MODULE NE FAIT JAMAIS : perdre une vidéo. Toute exception y est
 *   attrapée et dégrade d'une voie. Un athlète qui a filmé sa série doit
 *   pouvoir l'envoyer, même si son téléphone ne sait pas l'alléger — surtout
 *   s'il ne sait pas l'alléger.
 *
 * ⚠ ET IL NE TOUCHE JAMAIS AU FICHIER SOURCE. Il lit, il produit un Blob neuf,
 *   et c'est l'appelant qui décide lequel des deux part.
 *
 * TROIS VOIES, DANS CET ORDRE, CHAQUE ÉCHEC PASSANT À LA SUIVANTE :
 *   1. WebCodecs — VideoDecoder → VideoFrame → VideoEncoder, muxage MP4.
 *      Sondée AVANT de commencer : si le décodeur OU l'encodeur dit non, on
 *      passe sans avoir encodé une seule image.
 *   2. MediaRecorder + canvas — temps réel, donc annoncé comme tel.
 *   3. Rien du tout — le fichier part tel quel, et l'écran le DIT.
 */
(function(){
'use strict';

/** Le dossier des deux copies figées, relatif à index.html. */
var MP4_DIR='./vendor/mp4/';
/** Le codec d'encodage. ⚠ H.264 ET RIEN D'AUTRE EN PREMIER : iOS n'offre que
 *  lui en encodage matériel, et proposer VP9 ou AV1 d'abord ferait échouer la
 *  voie 1 sur exactement les appareils qui en ont le plus besoin.
 *  avc1.42001f = Baseline, niveau 3.1 — 720p30 garanti partout. */
var CODEC_SORTIE='avc1.42001f';
/** Par lots de trente images, avec une pause entre deux. Le fil principal ne
 *  doit pas geler : une jauge figée passe pour un plantage, et la personne
 *  tue l'onglet au moment précis où ça marchait. */
var LOT_IMAGES=30;
/** Au-delà, la file de l'encodeur a pris du retard : on attend qu'elle se vide
 *  plutôt que d'empiler des images en mémoire jusqu'à l'étouffement. */
var FILE_MAX=24;

/** Les scripts déjà chargés, pour ne pas les recharger. */
var _charges={};
function _script(src){
  if(_charges[src]) return _charges[src];
  _charges[src]=new Promise(function(ok,ko){
    var s=document.createElement('script');
    s.src=src;
    s.onload=function(){ ok(true); };
    s.onerror=function(){ _charges[src]=null; ko(new Error('script '+src)); };
    document.head.appendChild(s);
  });
  return _charges[src];
}
/**
 * `DataStream` DE MP4BOX, LÀ OÙ IL SE TROUVE VRAIMENT.
 *
 * ⚠ CE N'EST PAS `MP4Box.DataStream`. Le bundle expose deux globaux séparés —
 *   `MP4Box` et `DataStream` — et l'ancien code lisait le second à travers le
 *   premier. `window.MP4Box.DataStream` valant `undefined`, la lecture de
 *   `.BIG_ENDIAN` levait « Cannot read properties of undefined », la voie
 *   WebCodecs tombait À CHAQUE FOIS, et tout descendait vers la voie temps
 *   réel. Une seule référence fausse, et l'allègement n'a jamais fonctionné
 *   pour personne.
 * @returns {any}
 */
function _dataStream(){
  return (typeof window.DataStream!=='undefined')?window.DataStream
       : ((window.MP4Box&&window.MP4Box.DataStream)||undefined);
}
/** Les deux bibliothèques MP4, chargées ensemble et une seule fois. */
function _chargerMp4(){
  return Promise.all([
    (typeof window.MP4Box!=='undefined')?true:_script(MP4_DIR+'mp4box.all.min.js'),
    (typeof window.Mp4Muxer!=='undefined')?true:_script(MP4_DIR+'mp4-muxer.js')
  ]).then(function(){
    // ⚠ `DataStream` EST UN GLOBAL À PART, pas une propriété de MP4Box. On le
    //   vérifie ici, avec les deux autres : sans lui, la voie WebCodecs meurt
    //   plus bas, au milieu de la lecture des pistes, sur une erreur que rien
    //   n'explique.
    if(typeof window.MP4Box==='undefined'||typeof window.Mp4Muxer==='undefined'
       ||typeof _dataStream()==='undefined')
      throw new Error('bibliothèques MP4 illisibles');
    return true;
  });
}

/** Une attente courte qui rend la main au navigateur. */
function _souffler(){ return new Promise(function(r){ setTimeout(r,0); }); }
/** Vrai si le signal demande l'arrêt. */
function _coupe(signal){ return !!(signal&&signal.aborted); }
function _siCoupe(signal){ if(_coupe(signal)) throw new Error('Envoi annulé'); }

/**
 * LA TAILLE DE SORTIE. ⚠ ON BORNE LA HAUTEUR, ET SEULEMENT ELLE : en portrait,
 * borner la largeur dégraderait deux fois plus un mouvement déjà filmé dans le
 * sens le moins large. Et ON N'AGRANDIT JAMAIS — une vidéo déjà en 480p repart
 * en 480p, agrandir n'ajoute aucun détail et ne fait que peser.
 * Les deux côtés sont ramenés à un nombre PAIR : la plupart des encodeurs
 * matériels refusent une dimension impaire en 4:2:0.
 */
function _taille(l,h,max){
  var L=Math.max(2,Math.round(Number(l)||0)), H=Math.max(2,Math.round(Number(h)||0));
  var m=Math.max(2,Math.round(Number(max)||720));
  if(H<=m) return {l:L-(L%2),h:H-(H%2)};
  var f=m/H;
  var nl=Math.round(L*f), nh=m;
  return {l:Math.max(2,nl-(nl%2)),h:Math.max(2,nh-(nh%2))};
}

/**
 * CE QUE CE TÉLÉPHONE SAIT FAIRE, sondé avant d'essayer.
 * @param {File|Blob} file
 * @returns {Promise<{oui:boolean, voie:string, raison:string}>}
 */
function peutCompresser(file){
  return Promise.resolve().then(function(){
    if(!file||!file.size) return {oui:false,voie:'aucune',raison:'aucun fichier'};
    var aWebCodecs=(typeof window.VideoEncoder==='function'&&typeof window.VideoDecoder==='function'
      &&typeof window.VideoFrame==='function');
    var aRecorder=(typeof window.MediaRecorder==='function'
      &&typeof HTMLCanvasElement.prototype.captureStream==='function');
    if(!aWebCodecs&&!aRecorder)
      return {oui:false,voie:'aucune',raison:'ni WebCodecs ni MediaRecorder sur ce navigateur'};
    if(!aWebCodecs)
      return {oui:true,voie:'recorder',raison:'WebCodecs absent'};
    // L'ENCODEUR D'ABORD : s'il ne sait pas produire du H.264, tout le reste
    // est inutile et on ne va pas ouvrir le fichier pour rien.
    return window.VideoEncoder.isConfigSupported({
      codec:CODEC_SORTIE,width:1280,height:720,bitrate:2500000,framerate:30
    }).then(function(r){
      if(!r||!r.supported)
        return aRecorder?{oui:true,voie:'recorder',raison:'H.264 non encodable ici'}
                        :{oui:false,voie:'aucune',raison:'H.264 non encodable ici'};
      return {oui:true,voie:'webcodecs',raison:''};
    }).catch(function(){
      return aRecorder?{oui:true,voie:'recorder',raison:'sondage d’encodeur en échec'}
                      :{oui:false,voie:'aucune',raison:'sondage d’encodeur en échec'};
    });
  }).catch(function(e){
    return {oui:false,voie:'aucune',raison:String((e&&e.message)||e)};
  });
}

// ══ VOIE 1 — WebCodecs ══════════════════════════════════════════════════════

/** Lit le fichier avec mp4box et rend les pistes + les échantillons. */
function _demuxer(file,signal){
  return new Promise(function(ok,ko){
    var mp4=window.MP4Box.createFile();
    var info=null;
    /** @type {any[]} */
    var ech=[];
    var fini=false;
    mp4.onError=function(e){ if(!fini){ fini=true; ko(new Error('lecture MP4 : '+e)); } };
    mp4.onReady=function(i){
      info=i;
      var v=(i.videoTracks||[])[0];
      if(!v){ fini=true; ko(new Error('aucune piste vidéo')); return; }
      mp4.setExtractionOptions(v.id,null,{nbSamples:Infinity});
      mp4.start();
    };
    mp4.onSamples=function(id,user,s){ ech=ech.concat(s); };
    var reader=file.stream?file.stream().getReader():null;
    var pos=0;
    function pousser(buf){
      /** @type {any} */(buf).fileStart=pos;
      pos+=buf.byteLength;
      mp4.appendBuffer(buf);
    }
    function terminer(){
      if(fini) return;
      fini=true;
      try{ mp4.flush(); }catch(e){}
      if(!info){ ko(new Error('fichier illisible')); return; }
      ok({info:info,echantillons:ech,mp4:mp4});
    }
    if(reader){
      (function boucle(){
        if(_coupe(signal)){ if(!fini){ fini=true; ko(new Error('Envoi annulé')); } return; }
        reader.read().then(function(r){
          if(r.done){ terminer(); return; }
          try{ pousser(r.value.buffer.slice(r.value.byteOffset,r.value.byteOffset+r.value.byteLength)); }
          catch(e){ if(!fini){ fini=true; ko(e); } return; }
          boucle();
        }).catch(function(e){ if(!fini){ fini=true; ko(e); } });
      })();
    } else {
      var fr=new FileReader();
      fr.onload=function(){ try{ pousser(/** @type {ArrayBuffer} */(fr.result)); terminer(); }catch(e){ ko(e); } };
      fr.onerror=function(){ ko(new Error('lecture du fichier')); };
      fr.readAsArrayBuffer(file);
    }
  });
}
/** La description avcC/hvcC d'une piste, telle que VideoDecoder l'attend. */
function _description(mp4,trakId){
  var trak=mp4.getTrackById(trakId);
  var entries=trak&&trak.mdia&&trak.mdia.minf&&trak.mdia.minf.stbl&&trak.mdia.minf.stbl.stsd
    ?trak.mdia.minf.stbl.stsd.entries:[];
  for(var i=0;i<entries.length;i++){
    var e=entries[i];
    var box=e.avcC||e.hvcC||e.vpcC||e.av1C;
    if(!box) continue;
    var DS=_dataStream();
    var flux=new DS(undefined,0,DS.BIG_ENDIAN);
    box.write(flux);
    // Les huit premiers octets sont l'en-tête de boîte : le décodeur veut ce
    // qui suit, et rien d'autre.
    return new Uint8Array(flux.buffer,8);
  }
  return null;
}

function _voieWebCodecs(file,o){
  var signal=o.signal, onProgres=o.onProgres||function(){};
  var hauteurMax=o.hauteur||720, debit=o.debit||2500000;
  var dureeMaxS=o.dureeMaxS||180;
  var ressources={decodeur:null,encodeur:null,toile:null};
  function ranger(){
    try{ if(ressources.decodeur&&ressources.decodeur.state!=='closed') ressources.decodeur.close(); }catch(e){}
    try{ if(ressources.encodeur&&ressources.encodeur.state!=='closed') ressources.encodeur.close(); }catch(e){}
    ressources.toile=null;
  }
  return _chargerMp4().then(function(){
    _siCoupe(signal);
    return _demuxer(file,signal);
  }).then(function(d){
    _siCoupe(signal);
    var piste=(d.info.videoTracks||[])[0];
    var echelle=piste.timescale||1000;
    var dureeS=(piste.duration||0)/echelle;
    if(dureeMaxS&&dureeS>dureeMaxS+0.5) throw new Error('durée au-delà du plafond');
    var desc=_description(d.mp4,piste.id);
    var confSource={
      codec:piste.codec,
      codedWidth:piste.video?piste.video.width:piste.track_width,
      codedHeight:piste.video?piste.video.height:piste.track_height
    };
    if(desc) /** @type {any} */(confSource).description=desc;
    // ⚠ LE DÉCODAGE EST LE VRAI POINT DE RUPTURE. Les .mov d'iPhone sont
    //   souvent en HEVC (hvc1) et beaucoup de Chrome de bureau ne savent pas
    //   les décoder. C'est exactement ce que ce sondage attrape — avant
    //   d'avoir encodé une image.
    return window.VideoDecoder.isConfigSupported(confSource).then(function(r){
      if(!r||!r.supported) throw new Error('décodage impossible ici ('+piste.codec+')');
      return {d:d,piste:piste,confSource:confSource,echelle:echelle,dureeS:dureeS};
    });
  }).then(function(ctx){
    _siCoupe(signal);
    var piste=ctx.piste;
    var src={l:ctx.confSource.codedWidth,h:ctx.confSource.codedHeight};
    var out=_taille(src.l,src.h,hauteurMax);
    var total=ctx.d.echantillons.length||1;
    var Mux=window.Mp4Muxer;
    var cible=new Mux.ArrayBufferTarget();
    var muxeur=new Mux.Muxer({
      target:cible,
      video:{codec:'avc',width:out.l,height:out.h},
      // ⚠ PAS D'AUDIO ICI, ET C'EST ASSUMÉ. Remuxer l'audio demanderait de
      //   décoder puis réencoder l'AAC, donc un AudioDecoder et un
      //   AudioEncoder de plus — et sur un échec de l'un des deux, on perdrait
      //   la vidéo entière pour une piste que le coach n'écoute pas toujours.
      //   La voie 2 garde le son ; celle-ci le dit et rend une vidéo muette.
      fastStart:'in-memory'
    });
    var encodees=0, decodees=0;
    return new Promise(function(ok,ko){
      var encodeur=new window.VideoEncoder({
        output:function(chunk,meta){ try{ muxeur.addVideoChunk(chunk,meta); encodees++; }catch(e){ ko(e); } },
        error:function(e){ ko(e); }
      });
      ressources.encodeur=encodeur;
      encodeur.configure({codec:CODEC_SORTIE,width:out.l,height:out.h,bitrate:debit,
        framerate:30,latencyMode:'quality'});
      var toile=document.createElement('canvas');
      toile.width=out.l; toile.height=out.h;
      var g=toile.getContext('2d');
      ressources.toile=toile;
      var redim=(out.l!==src.l||out.h!==src.h);
      var decodeur=new window.VideoDecoder({
        output:function(frame){
          try{
            var f=frame;
            if(redim&&g){
              g.drawImage(frame,0,0,out.l,out.h);
              f=new window.VideoFrame(toile,{timestamp:frame.timestamp,duration:frame.duration||undefined});
              frame.close();
            }
            // Une image clef toutes les deux secondes : c'est ce qui permet au
            // coach de se déplacer dans la vidéo sans attendre.
            encodeur.encode(f,{keyFrame:(decodees%60===0)});
            f.close();
            decodees++;
            onProgres(Math.min(0.98,decodees/total));
          }catch(e){ try{ frame.close(); }catch(x){} ko(e); }
        },
        error:function(e){ ko(e); }
      });
      ressources.decodeur=decodeur;
      decodeur.configure(ctx.confSource);
      var i=0;
      (function lot(){
        if(_coupe(signal)){ ko(new Error('Envoi annulé')); return; }
        var n=0;
        try{
          while(i<ctx.d.echantillons.length&&n<LOT_IMAGES){
            var s=ctx.d.echantillons[i];
            decodeur.decode(new window.EncodedVideoChunk({
              type:s.is_sync?'key':'delta',
              timestamp:1e6*s.cts/s.timescale,
              duration:1e6*s.duration/s.timescale,
              data:s.data
            }));
            i++; n++;
          }
        }catch(e){ ko(e); return; }
        if(i<ctx.d.echantillons.length){
          // ON LAISSE LA FILE SE VIDER. Empiler mille images décodées en
          // mémoire fait tomber l'onglet sur un téléphone d'entrée de gamme.
          var attendre=(decodeur.decodeQueueSize>FILE_MAX||encodeur.encodeQueueSize>FILE_MAX)
            ?new Promise(function(r){ setTimeout(r,40); }):_souffler();
          attendre.then(lot);
          return;
        }
        decodeur.flush().then(function(){ return encodeur.flush(); }).then(function(){
          muxeur.finalize();
          var blob=new Blob([cible.buffer],{type:'video/mp4'});
          ok({blob:blob,largeur:out.l,hauteur:out.h,dureeS:ctx.dureeS,voie:'webcodecs',
            octetsAvant:file.size,octetsApres:blob.size,images:encodees,sansAudio:true});
        }).catch(ko);
      })();
    });
  }).then(function(r){ ranger(); return r; },function(e){ ranger(); throw e; });
}

// ══ VOIE 2 — MediaRecorder + canvas ═════════════════════════════════════════

/** Le conteneur que ce navigateur accepte. MP4 d'abord : c'est le seul que
 *  Cloudinary et tous les lecteurs avalent sans transcodage. */
function _conteneur(){
  var essais=['video/mp4;codecs=avc1.42001f','video/mp4','video/webm;codecs=vp9','video/webm'];
  for(var i=0;i<essais.length;i++){
    try{ if(window.MediaRecorder.isTypeSupported(essais[i])) return essais[i]; }catch(e){}
  }
  return '';
}
function _voieRecorder(file,o){
  var signal=o.signal, onProgres=o.onProgres||function(){};
  var hauteurMax=o.hauteur||720, debit=o.debit||2500000, dureeMaxS=o.dureeMaxS||180;
  var type=_conteneur();
  if(!type) return Promise.reject(new Error('aucun conteneur enregistrable'));
  var url=URL.createObjectURL(file);
  var v=document.createElement('video');
  var ranger=function(){
    try{ v.pause(); }catch(e){}
    try{ v.removeAttribute('src'); v.load(); }catch(e){}
    try{ URL.revokeObjectURL(url); }catch(e){}
  };
  return new Promise(function(ok,ko){
    v.muted=true; v.playsInline=true; v.preload='auto';
    v.setAttribute('playsinline','');
    v.style.cssText='position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
    document.body.appendChild(v);
    var garde=setTimeout(function(){ ko(new Error('vidéo illisible')); },20000);
    v.onerror=function(){ clearTimeout(garde); ko(new Error('vidéo illisible')); };
    v.onloadedmetadata=function(){
      clearTimeout(garde);
      if(!v.videoWidth||!v.videoHeight){ ko(new Error('vidéo sans image')); return; }
      if(dureeMaxS&&v.duration>dureeMaxS+0.5){ ko(new Error('durée au-delà du plafond')); return; }
      var out=_taille(v.videoWidth,v.videoHeight,hauteurMax);
      var toile=document.createElement('canvas');
      toile.width=out.l; toile.height=out.h;
      var g=toile.getContext('2d');
      if(!g){ ko(new Error('canvas indisponible')); return; }
      var flux=toile.captureStream(30);
      // LE SON, QUAND ON PEUT LE PRENDRE. Un coach écoute parfois le rythme
      // respiratoire ; et captureStream d'un canvas est muet par construction.
      var avecSon=false;
      try{
        var fs=/** @type {any} */(v).captureStream?/** @type {any} */(v).captureStream()
          :(/** @type {any} */(v).mozCaptureStream?/** @type {any} */(v).mozCaptureStream():null);
        var pistes=fs?fs.getAudioTracks():[];
        if(pistes&&pistes.length){ flux.addTrack(pistes[0]); avecSon=true; }
      }catch(e){}
      var rec;
      try{ rec=new window.MediaRecorder(flux,{mimeType:type,videoBitsPerSecond:debit}); }
      catch(e){ ko(e); return; }
      var morceaux=[];
      rec.ondataavailable=function(e){ if(e.data&&e.data.size) morceaux.push(e.data); };
      rec.onerror=function(e){ ko(new Error('enregistrement : '+((e&&e.error&&e.error.name)||'erreur'))); };
      rec.onstop=function(){
        var blob=new Blob(morceaux,{type:type});
        ok({blob:blob,largeur:out.l,hauteur:out.h,dureeS:v.duration,voie:'recorder',
          octetsAvant:file.size,octetsApres:blob.size,sansAudio:!avecSon});
      };
      var arreter=function(){
        try{ if(rec.state!=='inactive') rec.stop(); }catch(e){}
        try{ flux.getTracks().forEach(function(t){ t.stop(); }); }catch(e){}
      };
      if(signal){
        try{ signal.addEventListener('abort',function(){ arreter(); ko(new Error('Envoi annulé')); },{once:true}); }catch(e){}
      }
      var raf=0;
      var peindre=function(){
        if(_coupe(signal)) return;
        if(v.ended||v.paused){ arreter(); return; }
        try{ g.drawImage(v,0,0,out.l,out.h); }catch(e){}
        if(v.duration>0) onProgres(Math.min(0.98,v.currentTime/v.duration));
        raf=requestAnimationFrame(peindre);
      };
      v.onended=function(){ cancelAnimationFrame(raf); arreter(); };
      rec.start(1000);
      v.play().then(function(){ peindre(); }).catch(function(e){ arreter(); ko(e); });
    };
    v.src=url;
  }).then(function(r){ ranger(); try{ v.remove(); }catch(e){} return r; },
          function(e){ ranger(); try{ v.remove(); }catch(x){} throw e; });
}

/**
 * LA CASCADE. Elle ne rejette QUE sur annulation : tout autre échec descend
 * d'une voie, et la dernière voie est « on n'a rien allégé », qui est une
 * réponse valide et non une erreur.
 *
 * @param {File|Blob} file
 * @param {{hauteur?:number, debit?:number, dureeMaxS?:number,
 *          onProgres?:(p:number)=>void, onVoie?:(v:string,raison:string)=>void,
 *          signal?:any, sansRecorder?:boolean}} [options]
 * @returns {Promise<{blob:Blob|null, largeur:number, hauteur:number, dureeS:number,
 *          voie:string, octetsAvant:number, octetsApres:number, raison:string,
 *          sansAudio:boolean}>}
 */
function compresser(file,options){
  var o=options||{};
  var onVoie=o.onVoie||function(){};
  var rien=function(raison){
    return {blob:null,largeur:0,hauteur:0,dureeS:0,voie:'aucune',
      octetsAvant:file?file.size:0,octetsApres:file?file.size:0,raison:raison||'',sansAudio:false};
  };
  return Promise.resolve().then(function(){
    if(_coupe(o.signal)) throw new Error('Envoi annulé');
    return peutCompresser(file);
  }).then(function(p){
    if(!p.oui) return rien(p.raison);
    var suite;
    if(p.voie==='webcodecs'){
      onVoie('webcodecs','');
      suite=_voieWebCodecs(file,o).catch(function(e){
        if(_coupe(o.signal)) throw e;
        // ⚠ ON DESCEND, ON N'ABANDONNE PAS. Une erreur d'encodage ne doit
        //   jamais coûter sa vidéo à quelqu'un.
        //
        // SAUF VERS `recorder`, QUAND L'APPELANT LE REFUSE. Cette voie rejoue
        // le fichier EN TEMPS RÉEL : sur un téléphone qui se verrouille elle ne
        // rend jamais la main, et quand le décodage s'arrête en route elle rend
        // un clip d'UNE IMAGE — mesuré, 2,0 s en entrée, 0,033 s en sortie.
        // « Rien allégé » est une réponse valide ; un fichier abîmé, non.
        if(o.sansRecorder){
          onVoie('aucune',String((e&&e.message)||e));
          return rien(String((e&&e.message)||e));
        }
        onVoie('recorder',String((e&&e.message)||e));
        return _voieRecorder(file,o);
      });
    } else {
      if(o.sansRecorder){
        onVoie('aucune',p.raison);
        return rien(p.raison);
      }
      onVoie('recorder',p.raison);
      suite=_voieRecorder(file,o);
    }
    return suite.catch(function(e){
      if(_coupe(o.signal)) throw e;
      onVoie('aucune',String((e&&e.message)||e));
      return rien(String((e&&e.message)||e));
    });
  }).then(function(r){
    if(!r||!r.blob) return r||rien('');
    // ⚠ PLUS LOURD QU'AVANT : ON JETTE. Une vidéo déjà bien encodée ressort
    //   régulièrement plus grosse d'un réencodage, et envoyer le résultat
    //   serait payer deux fois — en attente de compression et en données.
    if(r.octetsApres>=r.octetsAvant){
      return rien('le résultat était plus lourd que l’original');
    }
    return r;
  }).catch(function(e){
    if(_coupe(o.signal)) throw e;
    return rien(String((e&&e.message)||e));
  });
}

window.RepCoreVideo={
  peutCompresser:peutCompresser,
  compresser:compresser,
  // Exposés pour les tests : ce sont les deux seules décisions de ce module
  // qui se vérifient sans téléphone.
  _taille:_taille,
  _conteneur:_conteneur,
  CODEC_SORTIE:CODEC_SORTIE
};
})();

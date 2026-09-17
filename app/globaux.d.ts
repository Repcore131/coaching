// LE CONTRAT ENTRE motion-lab.js ET L'APPLICATION.
//
// Le module est chargé à la demande dans la page, et parle aux fonctions que
// index.html a posées sur window. TypeScript ne lit pas index.html : sans ce
// fichier, il verrait cent quarante noms inconnus et ne dirait plus rien
// d'utile sur le reste.
//
// ⚠ CE FICHIER DÉCRIT CE QUE LE MODULE ATTEND, et non ce que index.html fait.
// Les deux pourraient diverger sans que le compilateur s'en aperçoive — c'est
// pourquoi un test (R33) vérifie, dans le vrai navigateur, que chacun de ces
// noms existe bel et bien. Ajouter un nom ici sans qu'il existe là-bas fait
// donc échouer la suite, et non passer le typage en silence.

// ── Les bornes du modèle ────────────────────────────────────────────────────
declare const SEG_MAX: number;
declare const SEG_MIN_MS: number;
declare const SEG_LIBELLE_MAX: number;
declare const SEG_BARRE_POINTS_MAX: number;
declare const SEG_POSE_MAX: number;
declare const SEG_POSE_PTS: number;
declare const SEG_POSE_ANGLES: readonly string[];
declare const CORR_DUREE_MAX_MS: number;
declare const CORR_EV_MAX: number;
declare const CORR_TRAITS_MAX: number;
declare const CORR_POINTS_MAX: number;
declare const CORR_CARTES_MAX: number;
declare const CORR_CARTE_MAX: number;
declare const CORR_COULEURS: number;
declare const VID_RATES: readonly number[];
declare const VID_FPS_DEFAUT: number;
declare function segMaxMs(): number;

// ── La donnée : lecture, validation, écriture ───────────────────────────────
declare const DB: { get(cle: string): any; set(cle: string, valeur: any): boolean };
declare let currentUser: any;
declare function saveUser(): any;
declare function segmentsVideo(v: any): any[];
declare function segBarreValide(b: any, debutMs: number, finMs: number): any;
declare function segPoseValide(p: any, debutMs: number, finMs: number): any;
declare function enregistrerSegmentsVideo(email: string, videoId: string, segments: any[]):
  { ok: boolean; raison?: string; envoi?: any; segments?: any[] };
declare function motionCorrectionValide(m: any): any;
declare function enregistrerCorrectionMotion(email: string, videoId: string, motion: any):
  { ok: boolean; raison?: string; envoi?: any; motion?: any };

// ── L'écran, ses dialogues et ses messages ──────────────────────────────────
declare function go(id: string): any;
declare function toast(msg: string, c?: string): any;
declare function toastSync(localOk: boolean, promesse: any, succes: string, perdu: string): any;
declare function toastEcriture(ok: any, succes: string, perdu: string): boolean;
declare function rcConfirm(titre: string, texte?: string, libelleOk?: string, libelleNon?: string): Promise<boolean>;
declare function rcSaisie(titre: string, valeur?: string, opts?: any): Promise<string | null>;
declare function escapeHtml(s: any): string;
declare function safeUrl(u: any): string;
declare function safeUrlRaw(u: any): string;
declare function _tok(nom: string, repli: string): string;
declare function _vcRouvrirApresMotionLab(email: string, videoId: string): any;

// ── La vidéo ────────────────────────────────────────────────────────────────
declare function videoSetRate(el: HTMLVideoElement, rate: number): any;
declare function videoSetLoop(el: HTMLVideoElement, a: number, b: number): any;
declare function videoClearLoop(el: HTMLVideoElement): any;
declare function videoDetectFps(el: HTMLVideoElement): number;
// ⚠ IL NE REND RIEN : il rappelle, parce que la mesure prend plusieurs images.
declare function _videoMesurerFps(el: HTMLVideoElement, fini?: (fps: number, variable: boolean) => void): void;

// ── Cloudinary ──────────────────────────────────────────────────────────────
declare function _cloudinaryUpload(file: File): Promise<string>;
declare function _cloudinaryUserMsg(e: any, kind: string): string;

// ── Ce que l'application pose sur des objets du navigateur ──────────────────
interface HTMLVideoElement {
  /** La cadence mesurée, posée par _videoMesurerFps pour ne pas la remesurer. */
  _rcFps?: number;
}
interface Window {
  /** Le redimensionnement du laboratoire, branché une fois pour toutes. */
  _mlRedim?: boolean;
  /** Le moteur de pose, posé par son propre script une fois chargé. */
  Pose?: any;
}

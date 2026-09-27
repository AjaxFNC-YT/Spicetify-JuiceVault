const STYLE_ID = "juicevault-app-style";

const CSS = `
.jv-root { --jv-accent: #f5c518; position: relative; color: #fff; padding-bottom: 120px; }

.jv-hero { display: flex; align-items: flex-end; gap: 24px; padding: 72px 32px 24px; }
.jv-cover { width: 192px; height: 192px; flex: 0 0 auto; object-fit: contain; }
.jv-headtext { min-width: 0; padding-bottom: 6px; }
.jv-eyebrow { font-size: .75rem; font-weight: 700; margin: 0 0 12px; }
.jv-hero h1 { font-size: clamp(2rem, 6vw, 6rem); line-height: 1.05; font-weight: 900; margin: 0 0 16px; letter-spacing: -.035em; }
.jv-sub { color: #fff; font-size: .875rem; margin: 0; }
.jv-sub span { color: rgba(255,255,255,.72); }

.jv-actions { display: flex; align-items: center; gap: 16px; padding: 8px 32px 8px; }
.jv-sort { display: flex; align-items: center; gap: 6px; background: none; border: none; cursor: pointer;
  color: rgba(255,255,255,.7); font-size: .8rem; font-weight: 600; white-space: nowrap; }
.jv-sort:hover { color: #fff; }
.jv-big { background: none; border: none; cursor: pointer; flex: 0 0 auto; color: #fff; padding: 4px;
  display: flex; align-items: center; justify-content: center; transition: transform .12s ease; }
.jv-big:hover { transform: scale(1.06); }
.jv-icon { background: none; border: none; cursor: pointer; color: rgba(255,255,255,.7); padding: 4px;
  display: flex; align-items: center; }
.jv-icon:hover { color: #fff; }
.jv-spacer { flex: 1 1 auto; }

.jv-tabs { display: flex; flex-wrap: nowrap; gap: 8px; width: 100%; overflow-x: auto; scrollbar-width: none;
  mask-image: linear-gradient(90deg, #000 calc(100% - 40px), transparent 100%);
  -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 40px), transparent 100%); }
.jv-tabs::-webkit-scrollbar { display: none; }
.jv-tab { flex: 0 0 auto; height: 32px; padding: 0 14px; border-radius: 500px; border: none; cursor: pointer;
  font-size: .78rem; font-weight: 600; background: rgba(255,255,255,.1); color: rgba(255,255,255,.9); white-space: nowrap;
  transition: background .15s ease, color .15s ease; }
.jv-tab:hover { background: rgba(255,255,255,.2); }
.jv-tab[data-active="true"] { background: #fff; color: #121212; }


.jv-list { padding: 16px 32px 0; contain: layout style; }
.jv-head, .jv-row { display: grid; grid-template-columns: 24px 6fr 4fr 96px; align-items: center; gap: 16px; }
.jv-head { padding: 0 16px 10px; border-bottom: 1px solid rgba(255,255,255,.12); margin-bottom: 12px;
  font-size: .75rem; color: rgba(255,255,255,.62); }
.jv-row { height: 56px; padding: 0 16px; border-radius: 4px; }
.jv-row:hover { background: rgba(255,255,255,.1); }
.jv-row:hover .jv-num { display: none; }
.jv-row:hover .jv-play { display: flex; }
.jv-num { color: rgba(255,255,255,.62); font-size: .9rem; text-align: right; font-variant-numeric: tabular-nums; }
.jv-play { display: none; align-items: center; justify-content: flex-end; background: none; border: none;
  color: #fff; cursor: pointer; padding: 0; width: 100%; }
.jv-cell { display: flex; align-items: center; gap: 14px; min-width: 0; }
.jv-art { width: 40px; height: 40px; border-radius: 2px; object-fit: cover; background: rgba(255,255,255,.08); flex: 0 0 auto; }
.jv-meta { min-width: 0; }
.jv-name { font-size: 1rem; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jv-artist { font-size: .8rem; color: rgba(255,255,255,.62); margin: 4px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jv-album { font-size: .875rem; color: rgba(255,255,255,.62); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jv-time { color: rgba(255,255,255,.62); font-size: .875rem; text-align: right; font-variant-numeric: tabular-nums; }
.jv-row[data-playing="true"] .jv-name, .jv-row[data-playing="true"] .jv-num { color: var(--jv-accent); }
.jv-tag { display: inline-block; margin-left: 8px; padding: 1px 5px; border-radius: 2px; font-size: .6rem;
  font-weight: 700; letter-spacing: .05em; text-transform: uppercase; background: rgba(255,255,255,.14); color: rgba(255,255,255,.75); }
.jv-native-tag { display: inline-flex; align-items: center; flex: 0 0 auto; height: 16px; margin-right: 6px; padding: 0 5px; border-radius: 2px;
  font-size: .6rem; font-weight: 700; letter-spacing: .05em; line-height: 16px; text-transform: uppercase; vertical-align: middle;
  background: rgba(255,255,255,.14); color: rgba(255,255,255,.75); }
.jv-tag[data-colored="true"][data-kind="session"], .jv-native-tag[data-colored="true"][data-kind="session"] { background: rgba(139,92,246,.22); color: #c4b5fd; }
.jv-tag[data-colored="true"][data-kind="instrumental"], .jv-native-tag[data-colored="true"][data-kind="instrumental"] { background: rgba(59,130,246,.22); color: #93c5fd; }
.jv-tag[data-colored="true"][data-kind="remaster"], .jv-native-tag[data-colored="true"][data-kind="remaster"] { background: rgba(20,184,166,.22); color: #5eead4; }
.jv-tag[data-colored="true"][data-kind="stem"], .jv-native-tag[data-colored="true"][data-kind="stem"] { background: rgba(245,158,11,.22); color: #fcd34d; }
.jv-tag[data-colored="true"][data-kind="released"], .jv-native-tag[data-colored="true"][data-kind="released"] { background: rgba(30,215,96,.2); color: #6ee7a0; }
.jv-tag[data-colored="true"][data-kind="cut"], .jv-native-tag[data-colored="true"][data-kind="cut"] { background: rgba(239,68,68,.22); color: #fca5a5; }
.jv-native-tags { display: inline-flex; align-items: center; gap: 4px; flex: 0 0 auto; margin-right: 6px; vertical-align: middle; white-space: nowrap; }
.jv-native-tags[data-slot="title"] { order: 99; margin: 0 0 0 6px; }
.jv-native-tags[data-slot="subtitle"] { order: -1; }
.jv-native-tags .jv-native-tag { flex: 0 0 auto; margin-right: 0; }
.main-trackList-rowMainContent > :has(> .jv-native-tags), .main-trackInfo-artists:has(> .jv-native-tags) {
  display: flex; align-items: center; min-width: 0; max-width: 100%; overflow: hidden; white-space: nowrap; }
.main-trackList-rowMainContent > :has(> .jv-native-tags) > :not(.jv-native-tags),
.main-trackInfo-artists:has(> .jv-native-tags) > :not(.jv-native-tags) { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.jv-native-tags .jv-native-tag--alt { max-width: 150px; overflow: hidden; text-overflow: ellipsis;
  display: inline-block; text-transform: none; letter-spacing: 0; font-weight: 600; font-size: .68rem;
  background: rgba(255,255,255,.07); color: rgba(255,255,255,.6); }
.main-trackInfo-name:has(> .jv-native-tags[data-slot="title"]) { display: flex; align-items: center; min-width: 0; }
.main-trackInfo-name:has(> .jv-native-tags[data-slot="title"]) > :not(.jv-native-tags) { min-width: 0; overflow: hidden; }
.jv-tag--alt { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;
  text-transform: none; letter-spacing: 0; font-weight: 600; font-size: .68rem; background: rgba(255,255,255,.07); color: rgba(255,255,255,.6); }
.jv-info { min-width: min(520px, 80vw); }
.jv-info-head { display: flex; align-items: center; gap: 16px; }
.jv-info-cover { width: 72px; height: 72px; flex: 0 0 auto; border-radius: 4px; object-fit: cover; box-shadow: 0 4px 12px rgba(0,0,0,.4); }
.jv-info-title { min-width: 0; }
.jv-info-name { margin: 0; font-size: 1.15rem; font-weight: 700; color: #fff; }
.jv-info-sub { margin: 4px 0 0; font-size: .85rem; color: rgba(255,255,255,.65); }
.jv-info-grid { display: grid; grid-template-columns: max-content 1fr; gap: 10px 20px; max-height: 50vh; overflow-y: auto; margin: 4px 0 0;
  padding: 14px 16px; border-radius: 6px; background: rgba(255,255,255,.05); }
.jv-info-grid dt { font-size: .8rem; font-weight: 700; color: rgba(255,255,255,.6); }
.jv-info-grid dd { margin: 0; font-size: .85rem; line-height: 1.45; color: #fff; white-space: pre-line; overflow-wrap: anywhere; }
.jv-more { display: block; margin: 28px auto 0; height: 40px; padding: 0 28px; border-radius: 500px; border: 1px solid rgba(255,255,255,.22);
  background: transparent; color: #fff; font-weight: 700; font-size: .8rem; cursor: pointer; }
.jv-more:hover { border-color: #fff; transform: scale(1.02); }
.jv-empty { padding: 72px 32px; text-align: center; color: rgba(255,255,255,.6); }

.jv-wrap { position: relative; display: flex; align-items: center; flex: 0 0 auto; }
.jv-wrap input { width: 0; opacity: 0; padding: 0; border: none; background: transparent;
  will-change: width; transition: width .18s ease-out, opacity .12s ease-out, padding .18s ease-out; }
.jv-wrap[data-open="true"] input { width: 220px; opacity: 1; padding: 0 12px 0 34px; }
.jv-wrap[data-open="true"] { background: rgba(255,255,255,.1); border-radius: 4px; }
.jv-wrap input { height: 32px; color: #fff; font-size: .8rem; outline: none; }
.jv-wrap input::placeholder { color: rgba(255,255,255,.55); }
.jv-searchbtn { background: none; border: none; cursor: pointer; color: rgba(255,255,255,.7);
  display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; }
.jv-searchbtn:hover { color: #fff; }
.jv-wrap[data-open="true"] .jv-searchbtn { position: absolute; left: 0; pointer-events: none; opacity: .7; }

.jv-dots { background: none; border: none; cursor: pointer; color: rgba(255,255,255,.7);
  padding: 4px; display: flex; align-items: center; opacity: 0; transition: opacity .12s ease; }
.jv-row:hover .jv-dots, .jv-row[data-menu="true"] .jv-dots { opacity: 1; }
.jv-row[data-menu="true"] { background: rgba(255,255,255,.1); }
.jv-dots:hover { color: #fff; }
.jv-end { display: flex; align-items: center; gap: 12px; justify-content: flex-end; }

.jv-topbar { position: absolute; top: 16px; left: 32px; right: 32px; z-index: 6; display: flex; align-items: center;
  justify-content: space-between; gap: 16px; pointer-events: none; container-type: inline-size; }
.jv-topbar > * { pointer-events: auto; }
.jv-nav { position: relative; display: flex; gap: 8px; flex: 1 1 auto; min-width: 0; }
.jv-nav-ruler { position: absolute; top: 0; left: 0; display: flex; gap: 8px; visibility: hidden; pointer-events: none; }
.jv-nav-more { display: inline-flex; align-items: center; gap: 6px; }
.jv-nav-pill { flex: 0 0 auto; height: 32px; padding: 0 14px; border: none; border-radius: 500px; background: rgba(0,0,0,.54);
  color: #fff; font-family: inherit; font-size: .8rem; font-weight: 600; white-space: nowrap; cursor: pointer;
  transition: background .15s ease, color .15s ease; }
.jv-nav-pill:hover { background: rgba(40,40,40,.9); }
.jv-nav-pill[data-active="true"] { background: #fff; color: #000; }
.jv-account { display: flex; align-items: center; gap: 8px; height: 32px; max-width: 220px; padding: 0 12px 0 2px;
  border: none; border-radius: 500px; background: rgba(0,0,0,.54); color: #fff; font-size: .875rem; font-weight: 700; cursor: pointer; }
.jv-account:hover { background: rgba(40,40,40,.9); }
.jv-account-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.jv-login-pill { height: 32px; padding: 0 16px; border: none; border-radius: 500px; background: #fff; color: #000;
  font-size: .875rem; font-weight: 700; cursor: pointer; transition: transform .1s ease; }
.jv-login-pill:hover { transform: scale(1.04); }

.jv-avatar { display: block; flex: 0 0 auto; border-radius: 50%; object-fit: cover; }
.jv-avatar--empty { display: flex; align-items: center; justify-content: center; background: #535353; color: #fff; font-weight: 800; }
.jv-profile-avatar { flex: 0 0 auto; }

.jv-warn { margin: 12px 0 0; font-size: .8rem; color: rgba(255,255,255,.72); }
.jv-bio { margin: 4px 32px 0; max-width: 720px; font-size: .9rem; line-height: 1.5; color: rgba(255,255,255,.8); white-space: pre-wrap; }

.jv-section { padding: 32px 32px 0; }
.jv-section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.jv-section-head .jv-h2 { margin: 0; }
.jv-section-sub { margin: 4px 0 0; font-size: .875rem; color: rgba(255,255,255,.62); }
.jv-h2 { font-size: 1.5rem; font-weight: 700; margin: 0 0 16px; letter-spacing: -.01em; }
.jv-link { background: none; border: none; padding: 0; cursor: pointer; color: rgba(255,255,255,.7);
  font-size: .875rem; font-weight: 700; text-decoration: none; }
.jv-link:hover { color: #fff; text-decoration: underline; }
.jv-list--flush { padding: 0; }

.jv-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
.jv-stat { padding: 16px; border-radius: 8px; background: rgba(255,255,255,.06); }
.jv-stat-value { font-size: 1.75rem; font-weight: 800; letter-spacing: -.02em; }
.jv-stat-label { margin-top: 4px; font-size: .8rem; color: rgba(255,255,255,.62); }
.jv-progress { height: 4px; margin-top: 12px; overflow: hidden; border-radius: 2px; background: rgba(255,255,255,.18); }
.jv-progress-fill { height: 100%; border-radius: 2px; background: #fff; }

.jv-login { display: flex; flex-direction: column; align-items: center; padding: 64px 32px; text-align: center; }
.jv-login-logo { width: 64px; height: 64px; margin-bottom: 20px; }
.jv-login h1 { margin: 0 0 8px; font-size: 2rem; font-weight: 800; letter-spacing: -.02em; }
.jv-login-reason { margin: 0 0 8px; color: rgba(255,255,255,.7); font-size: .875rem; }
.jv-login-form { display: flex; flex-direction: column; width: 100%; max-width: 324px; margin-top: 24px; text-align: left; }
.jv-login-form label { margin: 12px 0 8px; font-size: .875rem; font-weight: 700; }
.jv-login-input { height: 48px; padding: 0 14px; border: 1px solid #727272; border-radius: 4px; background: #121212;
  color: #fff; font-size: 1rem; outline: none; }
.jv-login-input:hover { border-color: #fff; }
.jv-login-input:focus { border-color: #fff; box-shadow: inset 0 0 0 1px #fff; }
.jv-login-submit { display: flex; flex-direction: column; margin-top: 28px; }
.jv-login-submit > * { width: 100%; }
.jv-login-error { margin: 0 0 8px; padding: 12px 14px; border-radius: 4px; background: #e91429; color: #fff; font-size: .875rem; }
.jv-login-links { margin: 16px 0 0; font-size: .875rem; color: rgba(255,255,255,.7); }
.jv-login-links a { color: #fff; font-weight: 700; text-decoration: underline; }

.jv-settings { max-width: 880px; padding: 72px 32px 0; }
.jv-settings h1 { margin: 0 0 32px; font-size: 2rem; font-weight: 800; letter-spacing: -.02em; }
.jv-set-section { margin-bottom: 40px; }
.jv-set-section h2 { margin: 0 0 4px; font-size: 1rem; font-weight: 700; }
.jv-set-note { margin: 0 0 8px; font-size: .8rem; color: rgba(255,255,255,.55); }
.jv-set-row { display: flex; align-items: center; justify-content: space-between; gap: 24px; min-height: 48px; padding: 4px 0; }
.jv-set-row--top { align-items: flex-start; padding-top: 12px; }
.jv-set-label { font-size: .875rem; color: #b3b3b3; }
.jv-set-value { display: flex; align-items: center; gap: 10px; font-size: .875rem; color: #fff; }
.jv-set-actions { display: flex; justify-content: flex-end; gap: 12px; padding: 8px 0 12px; }
.jv-set-block { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; padding: 4px 0 8px; }
.jv-set-block .jv-login-error { align-self: stretch; }
.jv-set-footer { padding: 8px 0 32px; }
.jv-field { width: 320px; max-width: 100%; height: 40px; padding: 0 12px; border: 1px solid transparent; border-radius: 4px;
  background: rgba(255,255,255,.1); color: #fff; font-size: .875rem; font-family: inherit; outline: none; }
.jv-field:focus { border-color: rgba(255,255,255,.5); }
.jv-field--area { height: 96px; padding: 10px 12px; resize: vertical; line-height: 1.45; }
.jv-pill { padding: 2px 8px; border-radius: 500px; background: rgba(255,255,255,.1); color: rgba(255,255,255,.72);
  font-size: .7rem; font-weight: 700; }
.jv-pill--ok { background: rgba(30,215,96,.16); color: #1ed760; }

.jv-toggle { position: relative; display: inline-flex; flex: 0 0 auto; cursor: pointer; }
.jv-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
.jv-toggle-track { position: relative; width: 40px; height: 24px; border-radius: 12px; background: #727272; transition: background .15s ease; }
.jv-toggle-knob { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #000;
  transition: transform .15s ease; }
.jv-toggle:hover .jv-toggle-track { background: #8a8a8a; }
.jv-toggle input:checked + .jv-toggle-track { background: var(--spice-button-active, #1ed760); }
.jv-toggle input:checked + .jv-toggle-track .jv-toggle-knob { transform: translateX(16px); }
.jv-toggle input:focus-visible + .jv-toggle-track { outline: 2px solid #fff; outline-offset: 2px; }
.jv-toggle[data-disabled="true"] { opacity: .4; cursor: default; }

.jv-btn { display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; height: 32px;
  min-width: 72px; padding: 0 16px; border-radius: 500px; border: 1px solid transparent; font-family: inherit;
  font-size: .875rem; font-weight: 700; line-height: 1; white-space: nowrap; cursor: pointer;
  transition: transform .1s ease, border-color .1s ease, background .1s ease; }
.jv-btn:hover:not(:disabled) { transform: scale(1.04); }
.jv-btn:active:not(:disabled) { transform: scale(1); }
.jv-btn--primary { background: #fff; color: #000; }
.jv-btn--primary:hover:not(:disabled) { background: #f0f0f0; }
.jv-btn--secondary { border-color: #7c7c7c; background: transparent; color: #fff; }
.jv-btn--secondary:hover:not(:disabled) { border-color: #fff; }
.jv-btn:disabled { opacity: .5; cursor: default; }
.jv-login-submit .jv-btn { height: 48px; font-size: 1rem; }

.jv-pl { max-width: 960px; }
.jv-pl-list { display: flex; flex-direction: column; gap: 4px; }
.jv-pl-row { display: flex; align-items: center; gap: 16px; padding: 8px; border-radius: 6px; }
.jv-pl-row:hover { background: rgba(255,255,255,.07); }
.jv-pl-cover { flex: 0 0 auto; width: 64px; height: 64px; border-radius: 4px; object-fit: cover;
  display: flex; align-items: center; justify-content: center; background: #282828; color: rgba(255,255,255,.7); }
.jv-pl-cover--liked { background: linear-gradient(135deg, #450af5, #c4efd9); color: #fff; }
.jv-pl-cover--unheard { background: linear-gradient(135deg, #1e3264, #8d67ab); color: #fff; }
.jv-pl-meta { flex: 1 1 auto; min-width: 0; }
.jv-pl-name { margin: 0; font-size: 1rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jv-pl-sub { margin: 4px 0 0; font-size: .8rem; color: rgba(255,255,255,.62); }
.jv-pl-status { display: flex; align-items: center; gap: 6px; margin: 6px 0 0; font-size: .75rem; color: rgba(255,255,255,.72); }
.jv-pl-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--spice-button-active, #1ed760); }
.jv-pl-actions { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }

.jv-pl-explain { margin: -16px 0 24px; max-width: 680px; font-size: .875rem; line-height: 1.5; color: rgba(255,255,255,.62); }
.jv-pl-explain p { margin: 0 0 6px; }
.jv-pl-explain strong { color: #fff; }
.jv-pl-mosaic { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; overflow: hidden; padding: 0; }
.jv-pl-mosaic img { width: 100%; height: 100%; object-fit: cover; display: block; }
.jv-pl-status--error { color: #f15e6c; }
.jv-pl-status--error .jv-pl-dot { background: #f15e6c; }

.jv-set-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.jv-set-hint { font-size: .75rem; color: rgba(255,255,255,.5); }
.jv-select { display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px; border: none; border-radius: 4px;
  background: rgba(255,255,255,.1); color: #fff; font-size: .875rem; cursor: pointer; white-space: nowrap; }
.jv-select:hover { background: rgba(255,255,255,.16); }

.jv-modal { display: flex; flex-direction: column; gap: 12px; color: #fff; }
.jv-modal--form { max-width: 420px; }
.jv-modal-intro { margin: 0; font-size: .875rem; line-height: 1.5; color: rgba(255,255,255,.72); }
.jv-modal-note { margin: 0; padding: 10px 12px; border-radius: 4px; background: rgba(255,255,255,.07); font-size: .8rem; color: rgba(255,255,255,.8); }
.jv-modal-list { display: flex; flex-direction: column; gap: 2px; max-height: 52vh; overflow-y: auto; margin: 0 -8px; }
.jv-modal-list--short { max-height: 40vh; }
.jv-modal-row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px; border: none; border-radius: 4px;
  background: none; color: #fff; text-align: left; cursor: pointer; }
.jv-modal-row:hover:not(:disabled) { background: rgba(255,255,255,.1); }
.jv-modal-row:disabled { cursor: default; opacity: .6; }
.jv-modal-row[data-selected="true"], .jv-modal-row[data-current="true"] { background: rgba(255,255,255,.07); }
.jv-modal-row-text { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; }
.jv-modal-row-state { font-size: .75rem; color: rgba(255,255,255,.7); white-space: nowrap; }
.jv-dp { min-width: min(460px, 80vw); }
.jv-dp .jv-dp-cover { width: 48px; height: 48px; }
.jv-dp-search { margin: 0; }
.jv-dp-empty { padding: 16px 8px; }
.jv-modal-actions { display: flex; justify-content: flex-end; gap: 12px; padding-top: 4px; }
.jv-radio { flex: 0 0 auto; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #727272; box-sizing: border-box; }
.jv-radio[data-on="true"] { border: 5px solid var(--spice-button-active, #1ed760); }

.jv-search-host { position: relative; z-index: 2; padding: 16px 32px 8px; color: #fff; }
.jv-search-takeover > :not(.jv-search-host) { display: none !important; }
.jv-search-panel { display: flex; flex-direction: column; gap: 16px; }
.jv-search-results { padding-bottom: 120px; }

.jv-switch { display: inline-flex; align-self: flex-start; gap: 4px; padding: 4px; border-radius: 500px;
  background: #121212; border: 1px solid rgba(255,255,255,.08); box-shadow: 0 8px 24px rgba(0,0,0,.35); }
.jv-switch-option { display: inline-flex; align-items: center; gap: 10px; height: 40px; padding: 0 20px 0 12px;
  border: none; border-radius: 500px; background: transparent; color: rgba(255,255,255,.62);
  font-family: inherit; font-size: .9rem; font-weight: 700; cursor: pointer; white-space: nowrap;
  transition: background .18s ease, color .18s ease; }
.jv-switch-option:hover { color: #fff; }
.jv-switch-option[data-active="true"] { background: #2e2e2e; color: #fff; box-shadow: inset 0 1px 0 rgba(255,255,255,.06); }
.jv-switch-icon { width: 22px; height: 22px; flex: 0 0 auto; border-radius: 6px; object-fit: cover;
  display: inline-flex; align-items: center; justify-content: center; }
.jv-switch-icon--spotify { background: #fff; color: #000; border-radius: 6px; }
.jv-switch-option:not([data-active="true"]) .jv-switch-icon { opacity: .7; filter: grayscale(.4); }

.jv-masked { -webkit-text-security: disc; font-family: inherit; letter-spacing: .08em; }

.jv-standalone-menu { isolation: isolate; box-sizing: border-box; display: flex; flex-direction: column; padding: 4px;
  border-radius: 4px; background: #282828; color: #fff; font-size: .875rem; font-weight: 400;
  box-shadow: 0 16px 24px rgba(0,0,0,.3), 0 6px 8px rgba(0,0,0,.2); }
.jv-mi-list { margin: 0; padding: 0; list-style: none; overflow-y: auto; }
.jv-mi--divider { padding-bottom: 4px; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,.1); }
.jv-mi-button { display: flex; align-items: center; gap: 12px; width: 100%; height: 40px; padding: 0 8px 0 12px;
  border: none; border-radius: 2px; background: none; color: rgba(255,255,255,.9); font: inherit; font-weight: 400;
  text-align: left; cursor: default; }
.jv-mi-button:hover:not(:disabled), .jv-mi-button[data-open="true"] { background: rgba(255,255,255,.1); color: #fff; }
.jv-mi-button:disabled { opacity: .5; }
.jv-mi-icon { display: flex; flex: 0 0 auto; color: rgba(255,255,255,.7); }
.jv-mi-caret { display: flex; margin-left: auto; color: rgba(255,255,255,.7); }
.jv-menu-label { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.jv-mi-search { position: relative; display: flex; align-items: center; margin: 4px 4px 8px; }
.jv-mi-search svg { position: absolute; left: 10px; color: rgba(255,255,255,.7); pointer-events: none; }
.jv-mi-search input { width: 100%; height: 36px; padding: 0 12px 0 36px; border: none; border-radius: 4px;
  background: #3e3e3e; color: #fff; font: inherit; font-size: .875rem; outline: none; }
.jv-mi-search input::placeholder { color: rgba(255,255,255,.6); }
.jv-mi-empty { padding: 10px 12px; color: rgba(255,255,255,.6); }
.jv-standalone-menu, .jv-atp { background: #282828 !important; opacity: 1 !important; backdrop-filter: none !important; }
.jv-standalone-menu .main-contextMenu-menu { background: transparent !important; box-shadow: none !important; }

.jv-atp { position: fixed; box-sizing: border-box; display: flex; flex-direction: column; padding: 12px 4px 4px; border-radius: 8px;
  color: #fff; font-size: .875rem; pointer-events: auto; box-shadow: 0 16px 24px rgba(0,0,0,.3), 0 6px 8px rgba(0,0,0,.2); }
.jv-atp-title { margin: 0 12px 8px; font-size: .875rem; font-weight: 700; }
.jv-atp-search { margin: 0 8px 8px; }
.jv-atp-new, .jv-atp-row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 6px 12px; border: none; border-radius: 4px;
  background: none; color: #fff; font: inherit; text-align: left; cursor: default; }
.jv-atp-new:hover, .jv-atp-row:hover { background: rgba(255,255,255,.1); }
.jv-atp-new { font-weight: 600; }
.jv-atp-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; margin: 4px 0 0; padding: 4px 0 0; list-style: none; border-top: 1px solid rgba(255,255,255,.1); }
.jv-atp-cover { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 4px;
  object-fit: cover; background: #3e3e3e; color: rgba(255,255,255,.7); }
.jv-atp-cover--liked { background: linear-gradient(135deg, #450af5, #c4efd9); color: #fff; }
.jv-atp-text { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
.jv-atp-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.jv-atp-count { font-size: .75rem; color: rgba(255,255,255,.6); }
.jv-atp-check { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,.6); color: #000; }
.jv-atp-check[data-checked="true"] { background: #1ed760; border-color: #1ed760; }
.jv-atp-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 8px 8px; border-top: 1px solid rgba(255,255,255,.1); }
.jv-atp-cancel, .jv-atp-done { height: 32px; padding: 0 16px; border: none; border-radius: 500px; font: inherit; font-weight: 700; cursor: pointer; }
.jv-atp-cancel { background: none; color: rgba(255,255,255,.7); }
.jv-atp-cancel:hover { color: #fff; }
.jv-atp-done { background: #fff; color: #000; }
.jv-atp-done:hover:not(:disabled) { transform: scale(1.04); }
.jv-atp-done:disabled { opacity: .5; cursor: default; }

.jv-range { display: flex; align-items: center; gap: 12px; width: 320px; max-width: 100%; }
.jv-range input { flex: 1 1 auto; height: 4px; accent-color: #fff; cursor: pointer; }
.jv-range-reset { flex: 0 0 auto; font-size: .75rem; }
.jv-range-value { flex: 0 0 auto; min-width: 64px; white-space: nowrap; text-align: right; font-size: .875rem; font-variant-numeric: tabular-nums; color: #fff; }

.jv-page { max-width: 1100px; }
.jv-page-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.jv-page-head h1 { margin-bottom: 4px; }
.jv-page-sub { margin: 0 0 24px; font-size: .875rem; color: rgba(255,255,255,.62); }
.jv-page-note { margin: 0 32px 8px; font-size: .8rem; color: rgba(255,255,255,.62); }
.jv-section--flush { padding-left: 0; padding-right: 0; }
.jv-history-day { margin-bottom: 24px; }
.jv-history-label { margin: 0 0 8px; font-size: 1rem; font-weight: 700; }
.jv-tabs--static { mask-image: none; -webkit-mask-image: none; flex-wrap: wrap; margin-bottom: 16px; }

.jv-heatmap { display: flex; flex-direction: column; gap: 6px; overflow-x: auto; }
.jv-heatmap-months { display: grid; font-size: .7rem; color: rgba(255,255,255,.55); min-width: 640px; }
.jv-heatmap-grid { display: grid; grid-template-rows: repeat(7, 1fr); grid-auto-flow: column; gap: 3px; min-width: 640px; }
.jv-heatmap-cell { display: block; aspect-ratio: 1; border-radius: 2px; background: rgba(255,255,255,.07); }
.jv-heatmap-cell[data-level="1"] { background: color-mix(in srgb, var(--spice-button-active, #1ed760) 30%, transparent); }
.jv-heatmap-cell[data-level="2"] { background: color-mix(in srgb, var(--spice-button-active, #1ed760) 55%, transparent); }
.jv-heatmap-cell[data-level="3"] { background: color-mix(in srgb, var(--spice-button-active, #1ed760) 80%, transparent); }
.jv-heatmap-cell[data-level="4"] { background: var(--spice-button-active, #1ed760); }
.jv-heatmap-legend { display: flex; align-items: center; justify-content: flex-end; gap: 4px; font-size: .7rem; color: rgba(255,255,255,.55); }
.jv-heatmap-legend .jv-heatmap-cell { width: 11px; height: 11px; }

.jv-hours { display: flex; flex-direction: column; gap: 6px; }
.jv-hours-bars { display: grid; grid-template-columns: repeat(24, 1fr); align-items: end; gap: 4px; height: 140px; }
.jv-hours-col { display: flex; align-items: flex-end; height: 100%; }
.jv-hours-bar { width: 100%; border-radius: 3px 3px 0 0; background: rgba(255,255,255,.28); transition: background .15s ease; }
.jv-hours-col:hover .jv-hours-bar { background: var(--spice-button-active, #1ed760); }
.jv-hours-axis { display: grid; grid-template-columns: repeat(24, 1fr); font-size: .7rem; color: rgba(255,255,255,.55); }

.jv-board { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; }
.jv-board-row { display: grid; grid-template-columns: 40px 32px 1fr auto; align-items: center; gap: 12px; padding: 6px 12px; border-radius: 4px; }
.jv-board-row:hover { background: rgba(255,255,255,.07); }
.jv-board-row[data-me="true"] { background: rgba(255,255,255,.12); }
.jv-board-rank { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; color: rgba(255,255,255,.72); }
.jv-board-name { display: flex; flex-direction: column; min-width: 0; font-size: .9rem; }
.jv-board-name > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.jv-board-handle { font-size: .75rem; color: rgba(255,255,255,.55); }
.jv-board-value { font-size: .85rem; color: rgba(255,255,255,.8); font-variant-numeric: tabular-nums; white-space: nowrap; }

.jv-update { width: min(460px, 78vw); }
.jv-update-frame { margin: -8px; overflow: hidden; transition: height .28s cubic-bezier(.3,0,.1,1); }
.jv-update-inner { padding: 8px; }
.jv-update-view { display: flex; flex-direction: column; gap: 16px; animation: jv-update-in .22s ease both; }
@keyframes jv-update-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.jv-update-head { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 4px 0 2px; }
.jv-update-versions { display: flex; align-items: flex-end; justify-content: center; gap: 18px; }
.jv-update-arrow { display: flex; padding-bottom: 7px; color: rgba(255,255,255,.4); }
.jv-update-version { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.jv-update-label { font-size: .68rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,.5); }
.jv-update-number { font-size: 1.6rem; font-weight: 800; line-height: 1.1; color: #fff; font-variant-numeric: tabular-nums; }
.jv-update-number--old { color: rgba(255,255,255,.55); }
.jv-update-date { font-size: .78rem; color: rgba(255,255,255,.55); }
.jv-update-remind-title { margin: 0; font-size: .95rem; font-weight: 700; color: #fff; }
.jv-update-remind { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.jv-update-remind-option { height: 40px; border: 1px solid rgba(255,255,255,.18); border-radius: 500px; background: none; color: #fff;
  font: inherit; font-size: .82rem; font-weight: 700; cursor: pointer; transition: background .15s ease, border-color .15s ease, transform .15s ease; }
.jv-update-remind-option:hover { border-color: #fff; background: rgba(255,255,255,.08); transform: scale(1.03); }
.jv-update-notes { max-height: 34vh; overflow-y: auto; padding: 12px 14px; border-radius: 6px; background: rgba(255,255,255,.05); }
.jv-update-notes .jv-md { font-size: .85rem; }
.jv-update-notes .jv-md > :last-child { margin-bottom: 0; }
.jv-update-empty { margin: 0; font-size: .85rem; color: rgba(255,255,255,.6); }
.jv-update-how { margin: 0; font-size: .82rem; color: rgba(255,255,255,.65); }
.jv-update-command { display: flex; align-items: center; gap: 8px; margin-top: -10px; padding: 6px 6px 6px 12px; border-radius: 6px; background: rgba(255,255,255,.07); }
.jv-update-command code { flex: 1 1 auto; min-width: 0; overflow-x: auto; white-space: nowrap; font-family: ui-monospace, Consolas, monospace; font-size: .76rem; color: #fff; scrollbar-width: none; }
.jv-update-copy { display: flex; flex: 0 0 auto; padding: 6px; border: none; border-radius: 4px; background: none; color: rgba(255,255,255,.7); cursor: pointer; }
.jv-update-copy:hover { background: rgba(255,255,255,.1); color: #fff; }
.jv-update-copy[data-copied="true"] { color: var(--spice-button-active, #1ed760); }
.jv-update-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.jv-beta { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin: 0; font-size: .78rem; color: rgba(255,255,255,.6); }
.jv-beta-pill { margin-right: 4px; padding: 1px 6px; border: 1px solid rgba(255,255,255,.3); border-radius: 3px;
  font-size: .6rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: rgba(255,255,255,.75); }
.jv-beta-link { padding: 0; border: none; background: none; font: inherit; color: #fff; text-decoration: underline; cursor: pointer; }
.jv-welcome { display: flex; flex-direction: column; gap: 14px; margin: 4px 0 8px; padding: 0; list-style: none; }
.jv-welcome-point { display: flex; align-items: flex-start; gap: 14px; }
.jv-welcome-icon { display: flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 36px; height: 36px; border-radius: 50%;
  background: rgba(255,255,255,.08); color: #fff; overflow: hidden; }
.jv-welcome-icon img { width: 36px; height: 36px; object-fit: cover; }
.jv-welcome-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; font-size: .875rem; line-height: 1.4; color: rgba(255,255,255,.7); }
.jv-welcome-text strong { font-size: .95rem; font-weight: 700; color: #fff; }
.jv-modal-points { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; font-size: .875rem; line-height: 1.45; color: rgba(255,255,255,.85); }

.jv-social { display: flex; flex-direction: column; gap: 8px; }
.jv-social-button { position: relative; display: flex; align-items: center; justify-content: center; height: 48px; padding: 0 48px;
  border: 1px solid #727272; border-radius: 500px; background: transparent; color: #fff; font-family: inherit; font-size: 1rem;
  font-weight: 700; cursor: pointer; transition: border-color .1s ease; }
.jv-social-button:hover { border-color: #fff; }
.jv-social-icon { position: absolute; left: 20px; display: flex; align-items: center; }
.jv-social-icon--discord { color: #5865f2; }
.jv-divider { display: flex; align-items: center; gap: 12px; margin: 20px 0 4px; color: rgba(255,255,255,.62); font-size: .8rem; }
.jv-divider::before, .jv-divider::after { content: ""; flex: 1 1 auto; height: 1px; background: rgba(255,255,255,.18); }
.jv-login-waiting { align-items: center; gap: 12px; text-align: center; padding-top: 16px; }
.jv-login-waiting p { margin: 0; }
.jv-login-hint { font-size: .8rem; color: rgba(255,255,255,.62); }
.jv-spinner { width: 32px; height: 32px; border-radius: 50%; border: 3px solid rgba(255,255,255,.18); border-top-color: #fff;
  animation: jv-spin .8s linear infinite; }
@keyframes jv-spin { to { transform: rotate(360deg); } }

.jv-topbar-right { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
@container (max-width: 560px) {
  .jv-account { padding: 0 2px; }
  .jv-account-name { display: none; }
}
.jv-nav-pill { position: relative; }
.jv-nav-dot { position: absolute; top: 5px; right: 5px; width: 7px; height: 7px; border-radius: 50%; background: var(--spice-button-active, #1ed760); }

.jv-news-list { display: flex; flex-direction: column; gap: 8px; }
.jv-news-card { border-radius: 8px; background: rgba(255,255,255,.05); overflow: hidden; }
.jv-news-card[data-open="true"] { background: rgba(255,255,255,.08); }
.jv-news-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding: 16px 20px;
  border: none; background: none; color: #fff; text-align: left; cursor: pointer; font-family: inherit; }
.jv-news-heading { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.jv-news-title { font-size: 1rem; font-weight: 700; }
.jv-news-date { margin: 0; font-size: .8rem; color: rgba(255,255,255,.55); }
.jv-news-chevron { display: flex; color: rgba(255,255,255,.7); transition: transform .15s ease; }
.jv-news-card[data-open="true"] .jv-news-chevron { transform: rotate(180deg); }
.jv-news-body { padding: 0 20px 20px; }
.jv-news-card .jv-news-body { border-top: 1px solid rgba(255,255,255,.08); padding-top: 12px; }
.jv-news-image { display: block; max-width: 100%; border-radius: 6px; margin: 8px 0; }
.jv-news-button { margin: 8px 8px 0 0; }
.jv-news-popup { max-width: 640px; }
.jv-news-scroll { max-height: 55vh; overflow-y: auto; padding-right: 8px; }
.jv-news-scroll .jv-news-body { padding: 0; }

.jv-md { font-size: .9rem; line-height: 1.55; color: rgba(255,255,255,.85); }
.jv-md h2, .jv-md h3, .jv-md h4 { margin: 18px 0 8px; font-size: 1rem; font-weight: 700; color: #fff; }
.jv-md h2:first-child, .jv-md h3:first-child { margin-top: 4px; }
.jv-md p { margin: 0 0 10px; }
.jv-md ul, .jv-md ol { margin: 0 0 10px; padding-left: 20px; }
.jv-md li { margin: 3px 0; }
.jv-md hr { border: none; border-top: 1px solid rgba(255,255,255,.1); margin: 14px 0; }
.jv-md code { padding: 1px 5px; border-radius: 3px; background: rgba(255,255,255,.1); font-size: .82em; }
.jv-md strong { color: #fff; }
.jv-md-link { color: #fff; text-decoration: underline; cursor: pointer; }
.jv-md-song { display: inline-flex; align-items: center; gap: 5px; padding: 0; border: none; background: none; color: #fff;
  font: inherit; cursor: pointer; text-decoration: underline; text-decoration-color: rgba(255,255,255,.35); }
.jv-md-song:hover { color: var(--spice-button-active, #1ed760); text-decoration-color: currentColor; }
.jv-md-song-icon { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%;
  background: rgba(255,255,255,.14); }


.jv-connection { display: flex; align-items: center; gap: 12px; min-width: 0; }
.jv-connection-icon { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%;
  background: rgba(255,255,255,.08); flex: 0 0 auto; }
.jv-connection-icon--discord { color: #5865f2; }

.jv-login-code { margin: 4px 0; padding: 12px 20px; border-radius: 8px; background: rgba(255,255,255,.08); font-size: 1.6rem;
  font-weight: 800; letter-spacing: .12em; font-variant-numeric: tabular-nums; font-family: ui-monospace, "SF Mono", Consolas, monospace; }
`;

export function injectStyle(): void {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = CSS;
	document.head.appendChild(style);
}

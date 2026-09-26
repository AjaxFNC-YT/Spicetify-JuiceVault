const STYLE_ID = "juicevault-app-style";

const CSS = `
.jv-root { --jv-accent: #f5c518; position: relative; color: #fff; padding-bottom: 120px; }

.jv-hero { display: flex; align-items: flex-end; gap: 24px; padding: 56px 32px 24px; }
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

.jv-topbar { position: absolute; top: 16px; right: 32px; z-index: 6; display: flex; align-items: center; gap: 8px; }
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

.jv-settings { max-width: 880px; padding: 56px 32px 0; }
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

.jv-range { display: flex; align-items: center; gap: 12px; width: 320px; max-width: 100%; }
.jv-range input { flex: 1 1 auto; height: 4px; accent-color: #fff; cursor: pointer; }
.jv-range-reset { flex: 0 0 auto; font-size: .75rem; }
.jv-range-value { flex: 0 0 auto; min-width: 64px; white-space: nowrap; text-align: right; font-size: .875rem; font-variant-numeric: tabular-nums; color: #fff; }
`;

export function injectStyle(): void {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = CSS;
	document.head.appendChild(style);
}

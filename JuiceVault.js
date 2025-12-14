// NAME: JuiceVault
// AUTHOR: ajaxfnc
// DESCRIPTION: JuiceVault - Access all unreleased Juice WRLD music directly in Spotify
// VERSION: 1.00

(function JuiceVault() {
    // wait for fuckshit to load
    if (!Spicetify.Player || !Spicetify.Platform || !Spicetify.CosmosAsync || !Spicetify.Topbar) {
        setTimeout(JuiceVault, 300);
        return;
    }

    // vars or som
    const API_URL = "https://api.juicevault.xyz";
    let vaultSongs = [];
    let displayCount = 100;
    const CHUNK_SIZE = 100;

    let audio = new Audio();
    audio.crossOrigin = "anonymous";
    let volumeInterval = null;

    let isModalOpen = false;
    let currentSong = null;

    const icon999 = `<img src="https://i.imgur.com/3p5oZqu.png" alt="Juice WRLD" style="width:24px;height:24px;"/>`;
    const defaultCoverSVG = `https://i.imgur.com/trvHJ1w.png`;
    const iconVolume = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`;
    const iconVolumeMuted = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`;
    const iconVolumeLow = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon></svg>`;
    const iconVolumeMed = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
    const iconShuffle = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>`;
    const iconWebsite = `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M5,2 L7,2 C7.55228475,2 8,2.44771525 8,3 C8,3.51283584 7.61395981,3.93550716 7.11662113,3.99327227 L7,4 L5,4 C4.48716416,4 4.06449284,4.38604019 4.00672773,4.88337887 L4,5 L4,19 C4,19.5128358 4.38604019,19.9355072 4.88337887,19.9932723 L5,20 L19,20 C19.5128358,20 19.9355072,19.6139598 19.9932723,19.1166211 L20,19 L20,17 C20,16.4477153 20.4477153,16 21,16 C21.5128358,16 21.9355072,16.3860402 21.9932723,16.8833789 L22,17 L22,19 C22,20.5976809 20.75108,21.9036609 19.1762728,21.9949073 L19,22 L5,22 C3.40231912,22 2.09633912,20.75108 2.00509269,19.1762728 L2,19 L2,5 C2,3.40231912 3.24891996,2.09633912 4.82372721,2.00509269 L5,2 Z M21,2 L21.081,2.003 L21.2007258,2.02024007 L21.3121425,2.04973809 L21.4232215,2.09367336 L21.5207088,2.14599545 L21.6167501,2.21278596 L21.7071068,2.29289322 L21.8036654,2.40469339 L21.8753288,2.5159379 L21.9063462,2.57690085 L21.9401141,2.65834962 L21.9641549,2.73400703 L21.9930928,2.8819045 L22,3 L22,9 C22,9.55228475 21.5522847,10 21,10 C20.4477153,10 20,9.55228475 20,9 L20,5.414 L13.7071068,11.7071068 C13.3466228,12.0675907 12.7793918,12.0953203 12.3871006,11.7902954 L12.2928932,11.7071068 C11.9324093,11.3466228 11.9046797,10.7793918 12.2097046,10.3871006 L12.2928932,10.2928932 L18.584,4 L15,4 C14.4477153,4 14,3.55228475 14,3 C14,2.44771525 14.4477153,2 15,2 L21,2 Z"/></svg>`;

    let isShuffled = false;

    const styles = `
        .jv-backdrop {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(8px);
            z-index: 9999;
            opacity: 0;
            animation: jv-fade-in 0.2s forwards;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        @keyframes jv-fade-in { to { opacity: 1; } }

        /* Loading Spinner */
        .jv-loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255,255,255,0.2);
            border-top-color: #c0392b;
            border-radius: 50%;
            animation: jv-spin 0.8s linear infinite;
            margin: 0 auto;
        }
        @keyframes jv-spin { to { transform: rotate(360deg); } }

        .jv-window, .jv-window * {
            box-sizing: border-box; 
            font-family: var(--spice-font-description, inherit); 
        }

        .jv-window {
            width: 90%;
            height: 90vh; 
            max-height: 950px; // increased slightly for more space
            background: var(--spice-main, #121212);
            border-radius: 12px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            border: 1px solid rgba(255,255,255,0.1);
        }

        .jv-header {
            padding: 24px 32px;
            display: grid;
            grid-template-columns: 1fr 2fr 1fr;
            align-items: center;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            background: rgba(255,255,255,0.02);
            flex-shrink: 0;
            gap: 20px;
        }

        .jv-search-container {
            width: 100%;
            justify-self: center;
            max-width: 600px;
            position: relative;
        }
        .jv-search-input {
            width: 100%;
            background: rgba(255,255,255,0.1);
            border: 1px solid transparent;
            border-radius: 500px;
            padding: 12px 20px 12px 40px;
            color: var(--spice-text);
            font-size: 14px;
            outline: none;
            transition: 0.2s;
        }
        .jv-search-input:focus {
            background: rgba(255,255,255,0.15);
            border-color: rgba(255,255,255,0.2);
        }
        .jv-search-icon {
            position: absolute;
            left: 14px;
            top: 50%;
            transform: translateY(-50%);
            width: 16px;
            height: 16px;
            fill: var(--spice-subtext);
            pointer-events: none;
        }

        .jv-content {
            flex: 1;
            min-height: 0;
            overflow-y: scroll !important;
            padding: 24px 32px;
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            align-content: flex-start;
            justify-content: flex-start;
            scrollbar-color: rgba(255,255,255,0.3) transparent;
        }
        
        .jv-content::-webkit-scrollbar {
            width: 14px !important;
            display: block !important;
        }
        .jv-content::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.1) !important;
        }
        .jv-content::-webkit-scrollbar-thumb {
            background-color: rgba(255, 255, 255, 0.25) !important;
            border-radius: 7px !important;
            border: 3px solid transparent !important;
            background-clip: content-box !important;
        }
        .jv-content::-webkit-scrollbar-thumb:hover {
            background-color: rgba(255, 255, 255, 0.5) !important;
        }
        
        .jv-card {
            width: 180px;
            flex-shrink: 0;
            flex-grow: 0;
            background: var(--spice-card);
            padding: 12px;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.2s, transform 0.2s;
            display: flex;
            flex-direction: column;
            gap: 10px;
            overflow: hidden;
        }
        .jv-card:hover {
            background: var(--spice-card-hover);
            transform: translateY(-4px);
        }
        
        .jv-card-img-container {
            width: 100%;
            padding-top: 100%;
            position: relative;
            border-radius: 4px;
            overflow: hidden;
            background: #222;
        }
        .jv-card-img {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 4px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            transition: filter 0.2s;
        }
        .jv-card:hover .jv-card-img { filter: brightness(0.6); }
        
        .jv-card-play-overlay {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.8);
            width: 48px;
            height: 48px;
            background: rgba(0,0,0,0.6);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s, transform 0.2s, background 0.2s;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            cursor: pointer;
        }
        .jv-card-play-overlay svg { fill: #fff; width: 20px; height: 20px; margin-left: 2px; }
        .jv-card:hover .jv-card-play-overlay { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        .jv-card-play-overlay:hover { background: linear-gradient(135deg, #c0392b, #9b59b6); }
        
        .jv-card-download {
            position: absolute;
            bottom: 8px;
            right: 8px;
            width: 28px;
            height: 28px;
            background: rgba(0,0,0,0.7);
            border: none;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s, background 0.2s, transform 0.1s;
            z-index: 5;
        }
        .jv-card-download svg { width: 14px; height: 14px; stroke: #fff; fill: none; }
        .jv-card:hover .jv-card-download { opacity: 1; }
        .jv-card-download:hover { background: linear-gradient(135deg, #c0392b, #9b59b6); transform: scale(1.1); }
        
        .jv-card-info {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
        }
        .jv-card-info .jv-card-download {
            position: static;
            opacity: 0;
            width: 22px;
            height: 22px;
            flex-shrink: 0;
            border-radius: 4px;
            z-index: 10;
            pointer-events: auto;
        }
        .jv-card-info .jv-card-download svg { width: 12px; height: 12px; }
        
        .jv-card-title {
            font-size: 13px;
            font-weight: 700;
            color: var(--spice-text);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .jv-card-bottom {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
            margin-top: -2px;
        }
        .jv-card-bottom .jv-card-artist {
            flex: 1;
            margin-top: 0;
        }
        .jv-card-bottom .jv-card-download {
            position: static;
            opacity: 0;
            width: 22px;
            height: 22px;
            flex-shrink: 0;
            border-radius: 4px;
        }
        .jv-card:hover .jv-card-bottom .jv-card-download { opacity: 1; }
        .jv-card-bottom .jv-card-download svg { width: 12px; height: 12px; }
        
        .jv-card-artist {
            font-size: 11px;
            color: var(--spice-subtext);
            margin-top: -4px;
        }

        .jv-player {
            height: 90px;
            background: transparent;
            border-top: 1px solid rgba(255,255,255,0.1);
            display: flex;
            align-items: center;
            padding: 0 24px;
            justify-content: space-between;
            flex-shrink: 0;
            z-index: 10;
        }
        
        .jv-player-left { display: flex; align-items: center; width: 30%; gap: 14px; }
        .jv-np-img { width: 56px; height: 56px; border-radius: 4px; object-fit: cover; background: #222; box-shadow: 0 2px 4px rgba(0,0,0,0.4); }
        .jv-np-info { display: flex; flex-direction: column; justify-content: center; overflow: hidden; }

        .jv-player-center { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 40%; gap: 8px; }
        .jv-controls { display: flex; align-items: center; justify-content: center; gap: 24px; margin-right: 5px; }
        .jv-btn-control { background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: color 0.2s, transform 0.1s; }
        .jv-btn-control:hover { color: #fff; }
        .jv-btn-control:active { transform: scale(0.95); }
        .jv-btn-control.active { color: #c0392b; }
        .jv-btn-control svg { fill: currentColor; width: 16px; height: 16px; }

        .jv-play-main { width: 32px; height: 32px; border-radius: 50%; background: #fff; color: #121212; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.2s; }
        .jv-play-main:hover { transform: scale(1.1); }
        .jv-play-main svg { width: 16px; height: 16px; fill: currentColor; }

        .jv-progress-container { width: 100%; display: flex; align-items: center; gap: 8px; color: rgba(255,255,255,0.7); font-size: 11px; font-variant-numeric: tabular-nums; position: relative; }
        .jv-progress-bar { 
            flex: 1; 
            height: 4px; 
            background: rgba(255,255,255,0.2); 
            border-radius: 4px; 
            position: relative; 
            cursor: pointer; 
            overflow: visible;
        }
        .jv-progress-fill { 
            height: 100%; 
            background: linear-gradient(to right, #c0392b, #9b59b6); 
            width: 0%; 
            border-radius: 4px; 
            position: relative;
        }
        .jv-progress-fill::after {
            content: '';
            position: absolute;
            right: -6px;
            top: 50%;
            transform: translateY(-50%);
            width: 12px;
            height: 12px;
            background: #fff;
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            transition: transform 0.1s;
        }
        .jv-progress-bar:hover .jv-progress-fill::after { transform: translateY(-50%) scale(1.15); }

        .jv-player-right { width: 30%; display: flex; justify-content: flex-end; align-items: center; padding-right: 16px; gap: 10px; }
        .jv-download-btn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); color: var(--spice-text); width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s, transform 0.1s; }
        .jv-download-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.1); }
        .jv-download-btn svg { width: 14px; height: 14px; fill: currentColor; }
        .jv-player.disabled .jv-download-btn { opacity: 0.3; pointer-events: none; }
        .jv-volume-icon { color: rgba(255,255,255,0.7); display: flex; align-items: center; transition: color 0.2s; }
        .jv-player-right:hover .jv-volume-icon { color: var(--spice-text); }
        .jv-volume-slider { 
            -webkit-appearance: none; 
            width: 100px; 
            height: 4px; 
            background: rgba(255,255,255,0.2); 
            border-radius: 4px; 
            outline: none; 
            cursor: pointer;
            transition: background 0.2s;
        }
        .jv-volume-slider:hover { background: linear-gradient(to right, #c0392b, #9b59b6); }
        .jv-volume-slider::-webkit-slider-thumb { 
            -webkit-appearance: none; 
            width: 12px; 
            height: 12px; 
            border-radius: 50%; 
            background: #fff; 
            cursor: pointer; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            transition: transform 0.1s, box-shadow 0.1s;
        }
        .jv-volume-slider::-webkit-slider-thumb:hover { transform: scale(1.15); box-shadow: 0 2px 6px rgba(0,0,0,0.4); }

        .jv-title { font-size: 24px; font-weight: 700; color: #fff; display: flex; gap: 12px; align-items: center; }
        .jv-pill { background: #fff; color: #121212; font-size: 10px; padding: 2px 8px; border-radius: 10px; font-weight: 800; }
        .jv-header-actions { display: flex; gap: 12px; align-items: center; justify-self: end; }
        .jv-header-btn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.2s, transform 0.1s; display: flex; align-items: center; gap: 6px; }
        .jv-header-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.02); }
        .jv-header-btn svg { width: 14px; height: 14px; fill: currentColor; }
        .jv-icon-btn { background: none; border: none; color: #fff; cursor: pointer; opacity: 0.7; display: flex; align-items: center; justify-content: center; padding: 4px; transition: opacity 0.2s, transform 0.1s; }
        .jv-icon-btn:hover { opacity: 1; transform: scale(1.1); }
        .jv-icon-btn.active { opacity: 1; color: #c0392b; }
        .jv-close-btn { background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; opacity: 0.7; }
        .jv-close-btn:hover { opacity: 1; }

        /* Player clickable elements */
        .jv-np-img.clickable { cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
        .jv-np-img.clickable:hover { transform: scale(1.05); box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
        .jv-np-title.clickable { cursor: pointer; transition: color 0.2s; }
        .jv-np-title.clickable:hover { color: #c0392b; }
        
        /* Volume icon clickable */
        .jv-volume-icon.clickable { cursor: pointer; transition: color 0.2s, transform 0.1s; }
        .jv-volume-icon.clickable:hover { color: var(--spice-text); transform: scale(1.1); }
        .jv-volume-icon.muted { color: rgba(255,255,255,0.4) !important; }

        /* Cover popup */
        .jv-cover-popup {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            z-index: 100001;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: jv-fade-in 0.2s ease;
        }
        .jv-cover-popup img {
            max-width: 80%;
            max-height: 80%;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        }
        .jv-cover-popup-close {
            position: absolute;
            top: 20px;
            right: 30px;
            background: none;
            border: none;
            color: #fff;
            font-size: 40px;
            cursor: pointer;
            opacity: 0.7;
            transition: opacity 0.2s;
        }
        .jv-cover-popup-close:hover { opacity: 1; }
        @keyframes jv-fade-in { from { opacity: 0; } to { opacity: 1; } }

        .jv-native-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, rgba(18,18,18,0.98) 0%, rgba(30,20,40,0.98) 100%);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }
        .jv-native-overlay-title {
            font-weight: 800;
            font-size: 12px;
            letter-spacing: 2px;
            color: rgba(255,255,255,0.5);
            text-transform: uppercase;
        }
        .jv-native-overlay-song {
            font-size: 13px;
            font-weight: 600;
            background: linear-gradient(90deg, #c0392b, #9b59b6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            max-width: 300px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .jv-native-overlay-btn {
            margin-top: 4px;
            padding: 6px 16px;
            font-size: 11px;
            font-weight: 700;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 20px;
            color: #fff;
            cursor: pointer;
            transition: background 0.2s, transform 0.1s;
        }
        .jv-native-overlay-btn:hover {
            background: rgba(255,255,255,0.2);
            transform: scale(1.05);
        }
        body.juice-vault-active .Root__now-playing-bar { position: relative; }
        
        .jv-player.disabled .jv-btn-control,
        .jv-player.disabled .jv-play-main {
            opacity: 0.3;
            pointer-events: none;
            cursor: not-allowed;
        }
        .jv-player.disabled .jv-progress-bar,
        .jv-player.disabled .jv-volume-slider {
            pointer-events: none;
            opacity: 0.3;
        }
    `;

    function injectCSS() {
        const tag = document.createElement('style');
        tag.textContent = styles;
        document.head.appendChild(tag);
    }

    function initButton() {
        try { new Spicetify.Topbar.Button("JuiceVault", icon999, toggleModal, false, true); } catch (e) { console.error(e); }
    }

    function updateVolumeSliderFill(slider, value) {
        const pct = value * 100;
        slider.style.background = `linear-gradient(to right, #c0392b 0%, #9b59b6 ${pct}%, rgba(255,255,255,0.2) ${pct}%)`;
    }

    function downloadSong(song) {
        const downloadUrl = `${API_URL}/music/download/${song.id}`;
        window.open(downloadUrl, '_blank');
        Spicetify.showNotification(`Downloading: ${song.title || 'Song'}`);
    }

    function getVolumeIcon(vol) {
        const pct = vol * 100;
        if (pct === 0) return iconVolumeMuted;
        if (pct <= 25) return iconVolumeLow;
        if (pct <= 70) return iconVolumeMed;
        return iconVolume;
    }

    function updateVolumeUI() {
        const volSlider = document.getElementById('jv-volume');
        const volIcon = document.getElementById('jv-vol-icon');
        if (volSlider) {
            volSlider.value = audio.volume;
            updateVolumeSliderFill(volSlider, audio.volume);
        }
        if (volIcon) {
            volIcon.innerHTML = getVolumeIcon(audio.volume);
        }
    }

    function toggleShuffle() {
        isShuffled = !isShuffled;
        Spicetify.showNotification(isShuffled ? 'Shuffle ON' : 'Shuffle OFF');
        const shuffleBtn = document.getElementById('jv-shuffle');
        if (shuffleBtn) shuffleBtn.classList.toggle('active', isShuffled);
    }

    function getNextSongIndex() {
        if (!currentSong) return 0;
        const currentIdx = vaultSongs.findIndex(s => s.id === currentSong.id);
        if (isShuffled) {
            // Random song (excluding current)
            let randomIdx;
            do {
                randomIdx = Math.floor(Math.random() * vaultSongs.length);
            } while (randomIdx === currentIdx && vaultSongs.length > 1);
            return randomIdx;
        }
        // Sequential - go to next
        return currentIdx + 1 < vaultSongs.length ? currentIdx + 1 : -1;
    }

    function copyTitleToClipboard() {
        if (!currentSong) return;
        const title = currentSong.title || currentSong.file_name || 'Unknown';
        navigator.clipboard.writeText(title).then(() => {
            Spicetify.showNotification('Copied to clipboard!');
        }).catch(() => {
            Spicetify.showNotification('Failed to copy');
        });
    }

    function showCoverPopup() {
        if (!currentSong) return;
        const imgSrc = currentSong.cover ? `${API_URL}${currentSong.cover}` : defaultCoverSVG;

        const popup = document.createElement('div');
        popup.className = 'jv-cover-popup';
        popup.innerHTML = `
            <button class="jv-cover-popup-close">×</button>
            <img src="${imgSrc}" alt="Cover">
        `;

        popup.onclick = (e) => { if (e.target === popup) popup.remove(); };
        popup.querySelector('.jv-cover-popup-close').onclick = () => popup.remove();

        document.body.appendChild(popup);
    }

    function showNativeOverlay(songName) {
        removeNativeOverlay();
        const playerBar = document.querySelector('.Root__now-playing-bar');
        if (!playerBar) return;

        const overlay = document.createElement('div');
        overlay.className = 'jv-native-overlay';
        overlay.id = 'jv-native-overlay';
        overlay.innerHTML = `
            <div class="jv-native-overlay-title">Player is disabled</div>
            <div class="jv-native-overlay-song">Playing: ${songName || 'Unknown Track'}</div>
            <button class="jv-native-overlay-btn">Open JuiceVault</button>
        `;
        playerBar.appendChild(overlay);

        overlay.querySelector('.jv-native-overlay-btn').onclick = () => {
            if (!isModalOpen) toggleModal();
        };
    }


    function removeNativeOverlay() {
        const overlay = document.getElementById('jv-native-overlay');
        if (overlay) overlay.remove();
    }

    async function loadSongs() {
        try {
            const res = await fetch(`${API_URL}/music/list`);
            const data = await res.json();
            vaultSongs = data.songs || data.results || [];
            displayCount = CHUNK_SIZE;
            renderGallery();
        } catch (e) {
            console.error("Vault Error:", e);
            const content = document.querySelector('.jv-content');
            if (content) content.innerHTML = '<div style="width:100%; text-align:center; color:red">Failed to load vault. API offline?</div>';
        }
    }

    function debounce(func, wait) { let timeout; return function (...args) { const context = this; clearTimeout(timeout); timeout = setTimeout(() => func.apply(context, args), wait); }; }

    let isLoading = false;

    async function searchVault(query) {
        if (!query) { loadSongs(); return; }
        try {
            isLoading = true;
            showLoading();
            // Sanitize query - remove problematic chars that might break API
            const safeQuery = query.replace(/['']/g, "'").trim();
            const res = await fetch(`${API_URL}/music/search?q=${encodeURIComponent(safeQuery)}`);
            const data = await res.json();
            vaultSongs = data.results || [];
            displayCount = CHUNK_SIZE;
            isLoading = false;
            renderGallery();
        } catch (e) {
            console.error("Search Error:", e);
            isLoading = false;
            const container = document.getElementById('jv-song-list');
            if (container) container.innerHTML = `<div style="width:100%; text-align:center; padding-top:50px;"><div style="color:rgba(255,255,255,0.6);">Search failed. Try again.</div></div>`;
        }
    }

    function showLoading() {
        const container = document.getElementById('jv-song-list');
        if (container) {
            container.innerHTML = `<div style="width:100%; text-align:center; padding-top:80px;">
                <div class="jv-loading-spinner"></div>
                <div style="color:rgba(255,255,255,0.6); margin-top:16px;">Searching...</div>
            </div>`;
        }
    }

    function renderGallery() {
        const container = document.getElementById('jv-song-list');
        if (!container) return;
        if (isLoading) return; // Don't render while loading
        if (displayCount === CHUNK_SIZE) { container.innerHTML = ""; container.scrollTop = 0; }
        if (container.children.length === 1 && container.innerText.includes("Loading")) container.innerHTML = "";

        const currentCount = container.children.length;
        const toRender = vaultSongs.slice(currentCount, displayCount);
        if (vaultSongs.length === 0 && displayCount === CHUNK_SIZE) {
            container.innerHTML = `<div style="width:100%; text-align:center; padding-top:50px;"><div style="color:rgba(255,255,255,0.6);">No results found.</div></div>`;
            return;
        }

        toRender.forEach((song, idx) => {
            const realIndex = currentCount + idx;
            const card = document.createElement('div');
            card.className = 'jv-card';
            card.onclick = () => playSongAtIndex(realIndex);

            const title = song.title || song.file_name;
            const artist = song.artist || "Juice WRLD";
            const img = song.cover ? `${API_URL}${song.cover}` : defaultCoverSVG;
            card.innerHTML = `
                <div class="jv-card-img-container">
                    <img src="${img}" class="jv-card-img" loading="lazy">
                    <div class="jv-card-play-overlay">
                        <svg viewBox="0 0 16 16"><path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z"/></svg>
                    </div>
                </div>
                <div class="jv-card-title">${title}</div>
                <div class="jv-card-bottom">
                    <div class="jv-card-artist">${artist}</div>
                    <button class="jv-card-download" data-song-index="${realIndex}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                </div>
            `;

            const downloadBtn = card.querySelector('.jv-card-download');
            downloadBtn.onclick = (e) => {
                e.stopPropagation();
                downloadSong(song);
            };
            container.appendChild(card);
        });
    }

    function onScroll(e) { const el = e.target; if (el.scrollHeight - el.scrollTop - el.clientHeight < 1200) { if (displayCount < vaultSongs.length) { displayCount += CHUNK_SIZE; renderGallery(); } } }
    function playSongAtIndex(index) { if (index < 0 || index >= vaultSongs.length) return; playSong(vaultSongs[index]); }

    function playSong(song) {
        Spicetify.Player.pause();
        currentSong = song;
        audio.src = `${API_URL}/music/stream/${song.id}`;
        audio.volume = Spicetify.Player.getVolume();
        audio.play();
        renderPlayerState();
        document.body.classList.add('juice-vault-active');
        showNativeOverlay(song.title || song.file_name);
    }

    function playNext() {
        if (!currentSong) return;
        const nextIdx = getNextSongIndex();
        if (nextIdx !== -1) playSongAtIndex(nextIdx);
    }
    function playPrev() {
        if (!currentSong) return;
        const idx = vaultSongs.findIndex(s => s.id === currentSong.id);
        if (idx > 0) playSongAtIndex(idx - 1);
    }

    function togglePlay() {
        if (!currentSong) return;
        if (audio.paused) {
            Spicetify.Player.pause();
            audio.volume = Spicetify.Player.getVolume();
            audio.play();
            document.body.classList.add('juice-vault-active');
            showNativeOverlay(currentSong.title || currentSong.file_name);
        }
        else {
            audio.pause();
            document.body.classList.remove('juice-vault-active');
            removeNativeOverlay();
        }
        renderPlayerState();
    }

    function renderPlayerState() {
        const titleEl = document.getElementById('jv-np-title'); const artistEl = document.getElementById('jv-np-artist'); const imgEl = document.getElementById('jv-np-img');
        const playBtn = document.getElementById('jv-play-btn'); const volSlider = document.getElementById('jv-volume'); const bar = document.getElementById('jv-progress-fill');
        const timeEl = document.getElementById('jv-time-current'); const durEl = document.getElementById('jv-time-total');
        const playerEl = document.querySelector('.jv-player');
        if (!titleEl) return;

        if (playerEl) {
            if (currentSong) { playerEl.classList.remove('disabled'); }
            else { playerEl.classList.add('disabled'); }
        }

        if (currentSong) { titleEl.innerText = currentSong.title || "Unknown Track"; artistEl.innerText = currentSong.artist || "Juice WRLD"; imgEl.src = currentSong.cover ? `${API_URL}${currentSong.cover}` : defaultCoverSVG; }
        else { titleEl.innerText = "No Song Playing"; artistEl.innerText = ""; imgEl.src = defaultCoverSVG; }

        const isPlaying = !audio.paused;
        if (playBtn) playBtn.innerHTML = isPlaying
            ? '<svg viewBox="0 0 16 16"><path d="M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7H2.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-2.6z"/></svg>'
            : '<svg viewBox="0 0 16 16"><path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z"/></svg>';

        if (volSlider && document.activeElement !== volSlider) { volSlider.value = audio.volume; updateVolumeSliderFill(volSlider, audio.volume); }
        if (audio.duration && bar) { const pct = (audio.currentTime / audio.duration) * 100; bar.style.width = pct + '%'; if (timeEl) timeEl.innerText = formatTime(audio.currentTime); if (durEl) durEl.innerText = formatTime(audio.duration); }
    }

    function formatTime(seconds) { if (!seconds || isNaN(seconds)) return "0:00"; const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60); return `${m}:${s.toString().padStart(2, '0')}`; }

    audio.ontimeupdate = () => {
        const bar = document.getElementById('jv-progress-fill'); const timeEl = document.getElementById('jv-time-current'); const durEl = document.getElementById('jv-time-total');
        if (audio.duration) { const pct = (audio.currentTime / audio.duration) * 100; if (bar) bar.style.width = pct + '%'; if (timeEl) timeEl.innerText = formatTime(audio.currentTime); if (durEl) durEl.innerText = formatTime(audio.duration); }
    };
    audio.onended = () => {
        const nextIdx = getNextSongIndex();
        if (nextIdx !== -1) {
            playSongAtIndex(nextIdx);
            return;
        }
        // No more songs or shuffle returned -1
        document.body.classList.remove('juice-vault-active');
        removeNativeOverlay();
        renderPlayerState();
    };

    function startVolumeSync() {
        if (volumeInterval) clearInterval(volumeInterval);
        volumeInterval = setInterval(() => {
            const spotifyVol = Spicetify.Player.getVolume();
            if (Math.abs(audio.volume - spotifyVol) > 0.005) {
                audio.volume = spotifyVol;
                const volSlider = document.getElementById('jv-volume');
                if (volSlider && document.activeElement !== volSlider) { volSlider.value = spotifyVol; }
            }
        }, 100);
    }

    let isToggling = false;
    function toggleModal() {
        if (isToggling) return;
        isToggling = true;

        if (isModalOpen) {
            const el = document.getElementById('juice-modal-root'); if (el) el.remove(); isModalOpen = false;
            if (audio.paused) clearInterval(volumeInterval);
        } else {
            openModal(); isModalOpen = true;
            const currentVol = Spicetify.Player.getVolume(); audio.volume = currentVol;
            startVolumeSync();
        }

        setTimeout(() => { isToggling = false; }, 200);
    }

    function openModal() {
        const modal = document.createElement('div'); modal.id = 'juice-modal-root'; modal.className = 'jv-backdrop';
        modal.innerHTML = `
            <div class="jv-window">
                <div class="jv-header">
                    <div class="jv-title"><span>JuiceVault</span><span class="jv-pill">999</span></div>
                    <div class="jv-search-container">
                        <svg class="jv-search-icon" viewBox="0 0 16 16"><path d="M7 1.75a5.25 5.25 0 1 0 0 10.5 5.25 5.25 0 0 0 0-10.5zM.25 7a6.75 6.75 0 1 1 12.03 4.19l3.44 3.44a.75.75 0 1 1-1.06 1.06l-3.44-3.44A6.75 6.75 0 0 1 .25 7z"/></svg>
                        <input type="text" class="jv-search-input" id="jv-search" placeholder="Search unreleased..." autocomplete="off">
                    </div>
                    <div class="jv-header-actions">
                        <button class="jv-icon-btn" id="jv-open-site" title="Open Website">${iconWebsite}</button>
                        <button class="jv-close-btn" id="jv-close">✕</button>
                    </div>
                </div>
                <div class="jv-content" id="jv-song-list"><div style="width:100%; text-align:center; color:var(--spice-subtext); padding-top: 50px;">Loading 1.4k+ Songs...</div></div>
                <div class="jv-player">
                    <div class="jv-player-left">
                        <img src="${defaultCoverSVG}" class="jv-np-img clickable" id="jv-np-img" title="Click to view full size">
                        <div class="jv-np-info">
                            <div class="jv-np-title clickable" style="color:var(--spice-text); font-size:14px; font-weight:600;" id="jv-np-title" title="Click to copy">No Song Playing</div>
                            <div style="color:var(--spice-subtext); font-size:11px;" id="jv-np-artist"></div>
                        </div>
                    </div>
                    <div class="jv-player-center">
                        <div class="jv-controls">
                            <button class="jv-btn-control" id="jv-shuffle" title="Shuffle">${iconShuffle}</button>
                            <button class="jv-btn-control" id="jv-prev"><svg viewBox="0 0 16 16"><path d="M3.3 1a.7.7 0 0 1 .7.7v5.15l9.95-5.744a.7.7 0 0 1 1.05.606v12.575a.7.7 0 0 1-1.05.607L4 9.149V14.3a.7.7 0 0 1-.7.7H1.7a.7.7 0 0 1-.7-.7V1.7a.7.7 0 0 1 .7-.7h1.6z"/></svg></button>
                            <div class="jv-play-main" id="jv-play-btn"><svg viewBox="0 0 16 16"><path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z"/></svg></div>
                            <button class="jv-btn-control" id="jv-next"><svg viewBox="0 0 16 16"><path d="M12.7 1a.7.7 0 0 0-.7.7v5.15L2.05 1.107A.7.7 0 0 0 1 1.714v12.575a.7.7 0 0 0 1.05.607L12 9.149V14.3a.7.7 0 0 0 .7.7h1.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-1.6z"/></svg></button>
                        </div>
                        <div class="jv-progress-container">
                            <span id="jv-time-current">0:00</span>
                            <div class="jv-progress-bar" id="jv-seek-bar"><div class="jv-progress-fill" id="jv-progress-fill"></div></div>
                            <span id="jv-time-total">0:00</span>
                        </div>
                    </div>
                    <div class="jv-player-right">
                        <span class="jv-volume-icon" id="jv-vol-icon">${iconVolume}</span>
                        <input type="range" min="0" max="1" step="0.01" class="jv-volume-slider" id="jv-volume">
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        renderPlayerState();
        const handleSearch = debounce((e) => { searchVault(e.target.value); }, 300);

        document.getElementById('jv-close').onclick = toggleModal;
        document.getElementById('jv-play-btn').onclick = togglePlay;
        document.getElementById('jv-next').onclick = playNext;
        document.getElementById('jv-prev').onclick = playPrev;
        document.getElementById('jv-search').oninput = handleSearch;
        document.getElementById('jv-open-site').onclick = () => window.open('https://juicevault.xyz/', '_blank');
        document.getElementById('jv-shuffle').onclick = toggleShuffle;
        document.getElementById('jv-np-img').onclick = showCoverPopup;
        document.getElementById('jv-np-title').onclick = copyTitleToClipboard;
        modal.onclick = (e) => { if (e.target === modal) toggleModal(); };

        const songList = document.getElementById('jv-song-list');
        songList.onclick = (e) => {
            const downloadBtn = e.target.closest('.jv-card-download');
            if (downloadBtn) {
                e.stopPropagation();
                const songIndex = parseInt(downloadBtn.dataset.songIndex);
                if (!isNaN(songIndex) && vaultSongs[songIndex]) {
                    downloadSong(vaultSongs[songIndex]);
                }
                return;
            }
        };
        songList.onscroll = onScroll;
        const seek = document.getElementById('jv-seek-bar');
        seek.onclick = (e) => { if (audio.duration) { const rect = seek.getBoundingClientRect(); const x = e.clientX - rect.left; const pct = x / rect.width; audio.currentTime = pct * audio.duration; } };
        const vol = document.getElementById('jv-volume');
        vol.value = audio.volume;
        vol.oninput = (e) => {
            const val = parseFloat(e.target.value);
            audio.volume = val;
            updateVolumeSliderFill(vol, val);
            updateVolumeUI();
            try { Spicetify.Player.setVolume(val); } catch (e) { }
        };
        updateVolumeSliderFill(vol, audio.volume);

        loadSongs();
    }

    // Init
    injectCSS();
    initButton();
})();

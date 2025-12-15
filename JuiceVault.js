// NAME: JuiceVault
// AUTHOR: ajaxfnc
// DESCRIPTION: JuiceVault - Access all unreleased Juice WRLD music directly in Spotify
// VERSION: 1.10

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

    // Initialize EQ on first play so 0dB actually sounds like the original
    audio.addEventListener('play', function initEQOnce() {
        initEQ();
        connectAudioToEQ();
        if (audioContext?.state === 'suspended') audioContext.resume();
        audio.removeEventListener('play', initEQOnce); // Only run once
    }, { once: true });

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
    const iconEQ = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>`;
    const iconSettings = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
    const iconChangelog = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`;

    let isShuffled = false;
    let isEQOpen = false;

    // Settings with localStorage persistence
    const defaultSettings = { hideEQ: false, hideShuffle: false, eqMax: 12, disableVolumeSync: false };
    let settings = { ...defaultSettings };
    try {
        const saved = localStorage.getItem('juicevault-settings');
        if (saved) settings = { ...defaultSettings, ...JSON.parse(saved) };
    } catch (e) { }
    function saveSettings() { try { localStorage.setItem('juicevault-settings', JSON.stringify(settings)); } catch (e) { } }

    // EQ state persistence
    const defaultEQState = { bass: 0, mid: 0, treble: 0, reverb: 0, gain: 0, distortion: 0, stereoWidth: 0 };
    let eqState = { ...defaultEQState };
    try {
        const saved = localStorage.getItem('juicevault-eq-state');
        if (saved) eqState = { ...defaultEQState, ...JSON.parse(saved) };
    } catch (e) { }
    function saveEQState() { try { localStorage.setItem('juicevault-eq-state', JSON.stringify(eqState)); } catch (e) { } }

    // Version tracking for auto-changelog
    const CURRENT_VERSION = '1.1.0';


    const CHANGELOG = [
        { version: '1.1.0', date: '2025-12-14', changes: ['Added Equalizer with Bass/Mid/Treble/Reverb/Gain', 'Added Settings (Hide EQ, EQ up to 48dB, Hide Shuffle, Disable Volume Sync)', 'Added Changelog (and update detection)', 'Fixed search with special characters'] },
        { version: '1.0.0', date: '2025-12-13', changes: ['Initial release', 'Stream & download vault songs', 'Shuffle mode', 'Search functionality', 'Volume sync with Spotify'] }
    ];

    // Web Audio API EQ Setup
    let audioContext = null;
    let sourceNode = null;
    let bassFilter = null;
    let midFilter = null;
    let trebleFilter = null;
    let reverbNode = null;
    let masterGainNode = null;
    let distortionNode = null;
    let stereoWidthNode = null;
    let analyserNode = null;
    let isAudioConnected = false;

    function initEQ() {
        if (audioContext) return;
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Create filters
        bassFilter = audioContext.createBiquadFilter();
        bassFilter.type = 'lowshelf';
        bassFilter.frequency.value = 200;
        bassFilter.gain.value = 0;

        midFilter = audioContext.createBiquadFilter();
        midFilter.type = 'peaking';
        midFilter.frequency.value = 1000;
        midFilter.Q.value = 1;
        midFilter.gain.value = 0;

        trebleFilter = audioContext.createBiquadFilter();
        trebleFilter.type = 'highshelf';
        trebleFilter.frequency.value = 3000;
        trebleFilter.gain.value = 0;

        // Create reverb (ConvolverNode with generated impulse)
        reverbNode = audioContext.createConvolver();
        const reverbTime = 2; // seconds
        const sampleRate = audioContext.sampleRate;
        const length = sampleRate * reverbTime;
        const impulse = audioContext.createBuffer(2, length, sampleRate);
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
            }
        }
        reverbNode.buffer = impulse;

        // Create dry/wet mixing for reverb
        reverbNode.volume = 0; // Start at 0 (dry)

        // Create distortion
        distortionNode = audioContext.createWaveShaper();
        distortionNode.curve = makeDistortionCurve(0); // Start at 0 (no distortion)
        distortionNode.oversample = '4x';

        // Create stereo width control (using splitter/merger)
        stereoWidthNode = {
            splitter: audioContext.createChannelSplitter(2),
            merger: audioContext.createChannelMerger(2),
            leftGain: audioContext.createGain(),
            rightGain: audioContext.createGain(),
            width: 0 // -100 to 100, 0 = normal stereo
        };
        stereoWidthNode.leftGain.gain.value = 1;
        stereoWidthNode.rightGain.gain.value = 1;

        // Create analyser for visualizer
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 256;
        analyserNode.smoothingTimeConstant = 0.8;

        // Create master gain
        masterGainNode = audioContext.createGain();
        masterGainNode.gain.value = 1.0;

        // Apply saved EQ state
        if (bassFilter) bassFilter.gain.value = eqState.bass;
        if (midFilter) midFilter.gain.value = eqState.mid;
        if (trebleFilter) trebleFilter.gain.value = eqState.treble;
        if (distortionNode) distortionNode.curve = makeDistortionCurve(eqState.distortion);
        if (masterGainNode) masterGainNode.gain.value = 1 + (eqState.gain / 12);
    }

    // Helper function to create distortion curve
    function makeDistortionCurve(amount) {
        const k = amount;
        const samples = 44100;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    function connectAudioToEQ() {
        if (isAudioConnected || !audioContext) return;
        try {
            sourceNode = audioContext.createMediaElementSource(audio);

            // Main chain: source → bass → mid → treble → distortion
            sourceNode.connect(bassFilter);
            bassFilter.connect(midFilter);
            midFilter.connect(trebleFilter);
            trebleFilter.connect(distortionNode);

            // Split for stereo width processing
            distortionNode.connect(stereoWidthNode.splitter);
            stereoWidthNode.splitter.connect(stereoWidthNode.leftGain, 0);
            stereoWidthNode.splitter.connect(stereoWidthNode.rightGain, 1);
            stereoWidthNode.leftGain.connect(stereoWidthNode.merger, 0, 0);
            stereoWidthNode.rightGain.connect(stereoWidthNode.merger, 0, 1);

            // Dry path from merger
            const dryGain = audioContext.createGain();
            stereoWidthNode.merger.connect(dryGain);
            dryGain.connect(masterGainNode);

            // Wet path (reverb)
            const wetGain = audioContext.createGain();
            wetGain.gain.value = 0; // Start dry
            stereoWidthNode.merger.connect(reverbNode);
            reverbNode.connect(wetGain);
            wetGain.connect(masterGainNode);

            // Store wet/dry gains for later control
            reverbNode._wetGain = wetGain;
            reverbNode._dryGain = dryGain;

            // Apply saved reverb state
            wetGain.gain.value = eqState.reverb / 100;

            // Connect analyser for visualizer
            masterGainNode.connect(analyserNode);

            // Final output
            masterGainNode.connect(audioContext.destination);
            isAudioConnected = true;
        } catch (e) {
            console.error('EQ connection error:', e);
        }
    }

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
        }
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

        /* EQ Popup */
        .jv-eq-popup {
            position: absolute;
            bottom: 100%;
            right: 0;
            background: rgba(30,30,30,0.98);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 10px;
            min-width: 280px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            z-index: 100;
            animation: jv-fade-in 0.15s ease;
        }
        .jv-eq-title {
            font-size: 14px;
            font-weight: 700;
            color: #fff;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .jv-eq-reset {
            background: rgba(255,255,255,0.1);
            border: none;
            color: rgba(255,255,255,0.7);
            font-size: 11px;
            padding: 4px 10px;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s;
        }
        .jv-eq-reset:hover { background: rgba(255,255,255,0.2); color: #fff; }
        .jv-eq-band {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 14px;
        }
        .jv-eq-band:last-child { margin-bottom: 0; }
        .jv-eq-label {
            font-size: 12px;
            color: rgba(255,255,255,0.7);
            width: 50px;
            flex-shrink: 0;
        }
        .jv-eq-slider {
            flex: 1;
            -webkit-appearance: none;
            height: 4px;
            background: rgba(255,255,255,0.2);
            border-radius: 4px;
            outline: none;
            cursor: pointer;
        }
        .jv-eq-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #fff;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .jv-eq-value {
            font-size: 11px;
            color: rgba(255,255,255,0.6);
            width: 35px;
            text-align: right;
            font-variant-numeric: tabular-nums;
        }

        /* Settings/Changelog Modal Overlay */
        .jv-modal-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            animation: jv-fade-in 0.15s ease;
        }
        .jv-modal-content {
            background: rgba(15,15,15,0.7);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 24px;
            min-width: 400px;
            max-width: 500px;
            max-height: 70vh;
            overflow-y: auto;
        }
        .jv-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .jv-modal-title { font-size: 18px; font-weight: 700; color: #fff; }
        .jv-modal-close { background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; opacity: 0.7; }
        .jv-modal-close:hover { opacity: 1; }

        /* Settings specific */
        .jv-setting-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .jv-setting-row:last-child { border-bottom: none; }
        .jv-setting-label { color: rgba(255,255,255,0.9); font-size: 13px; }
        .jv-setting-toggle {
            width: 40px; height: 22px;
            background: rgba(255,255,255,0.2);
            border-radius: 11px;
            position: relative;
            cursor: pointer;
            transition: background 0.2s;
        }
        .jv-setting-toggle.active { background: #c0392b; }
        .jv-setting-toggle::after {
            content: '';
            position: absolute;
            top: 2px; left: 2px;
            width: 18px; height: 18px;
            background: #fff;
            border-radius: 50%;
            transition: left 0.2s;
        }
        .jv-setting-toggle.active::after { left: 20px; }
        .jv-setting-select {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            color: #fff;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
        }
        .jv-setting-section {
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid rgba(255,255,255,0.15);
        }
        .jv-setting-section-title {
            font-size: 12px;
            color: #c0392b;
            font-weight: 600;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        /* Changelog specific */
        .jv-changelog-entry { margin-bottom: 20px; }
        .jv-changelog-entry:last-child { margin-bottom: 0; }
        .jv-changelog-version { font-size: 14px; font-weight: 700; color: #c0392b; }
        .jv-changelog-date { font-size: 11px; color: rgba(255,255,255,0.5); margin-left: 8px; }
        .jv-changelog-list { margin: 8px 0 0 16px; padding: 0; }
        .jv-changelog-list li { font-size: 12px; color: rgba(255,255,255,0.8); margin-bottom: 4px; }

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
        .jv-player.disabled .jv-play-main,
        .jv-player.disabled .jv-volume-icon {
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
        const gradient = `linear-gradient(to right, #c0392b 0%, #9b59b6 ${pct}%, rgba(255,255,255,0.2) ${pct}%)`;

        // Nuclear option: remove and re-add to force browser update
        slider.style.removeProperty('background');
        slider.offsetHeight; // Force reflow
        slider.style.setProperty('background', gradient, 'important');
    }

    function showVolumeTooltip(value) {
        let tooltip = document.getElementById('jv-volume-tooltip');
        const slider = document.getElementById('jv-volume');
        if (!tooltip && slider) {
            tooltip = document.createElement('div');
            tooltip.id = 'jv-volume-tooltip';
            tooltip.style.cssText = 'position:fixed;background:rgba(20,20,20,0.95);border:1px solid rgba(255,255,255,0.2);color:#fff;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;white-space:nowrap;pointer-events:none;z-index:9999;';
            document.body.appendChild(tooltip);
        }
        if (tooltip && slider) {
            const rect = slider.getBoundingClientRect();
            tooltip.style.left = `${rect.left + rect.width / 2}px`;
            tooltip.style.top = `${rect.top - 30}px`;
            tooltip.style.transform = 'translateX(-50%)';
        }
        const pct = Math.round(value * 100);
        if (tooltip) {
            tooltip.textContent = `${pct}%`;
            tooltip.style.display = 'block';
        }
    }

    function hideVolumeTooltip() {
        const tooltip = document.getElementById('jv-volume-tooltip');
        if (tooltip) tooltip.style.display = 'none';
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

    function openSettings() {
        const jvWindow = document.querySelector('.jv-window');
        if (!jvWindow || document.getElementById('jv-settings-modal')) return;

        const overlay = document.createElement('div');
        overlay.className = 'jv-modal-overlay';
        overlay.id = 'jv-settings-modal';
        overlay.innerHTML = `
            <div class="jv-modal-content">
                <div class="jv-modal-header">
                    <span class="jv-modal-title">Settings</span>
                    <button class="jv-modal-close" id="jv-settings-close">×</button>
                </div>
                <div class="jv-setting-row">
                    <span class="jv-setting-label">Hide EQ Button</span>
                    <div class="jv-setting-toggle ${settings.hideEQ ? 'active' : ''}" data-setting="hideEQ"></div>
                </div>
                <div class="jv-setting-row">
                    <span class="jv-setting-label">Hide Shuffle Button</span>
                    <div class="jv-setting-toggle ${settings.hideShuffle ? 'active' : ''}" data-setting="hideShuffle"></div>
                </div>
                <div class="jv-setting-row">
                    <span class="jv-setting-label">Disable Volume Sync</span>
                    <div class="jv-setting-toggle ${settings.disableVolumeSync ? 'active' : ''}" data-setting="disableVolumeSync"></div>
                </div>
                <div class="jv-setting-row">
                    <span class="jv-setting-label">Max EQ (dB)</span>
                    <select class="jv-setting-select" data-setting="eqMax">
                        <option value="12" ${settings.eqMax == 12 ? 'selected' : ''}>±12 dB</option>
                        <option value="24" ${settings.eqMax == 24 ? 'selected' : ''}>±24 dB</option>
                        <option value="35" ${settings.eqMax == 35 ? 'selected' : ''}>±35 dB</option>
                        <option value="48" ${settings.eqMax == 48 ? 'selected' : ''}>±48 dB (Not recommended)</option>
                    </select>
                </div>
            </div>
        `;

        jvWindow.appendChild(overlay);

        // Wire up handlers
        overlay.querySelector('#jv-settings-close').onclick = () => overlay.remove();
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        overlay.querySelectorAll('.jv-setting-toggle').forEach(toggle => {
            toggle.onclick = () => {
                const key = toggle.dataset.setting;
                settings[key] = !settings[key];
                toggle.classList.toggle('active', settings[key]);
                saveSettings();
                applySettings();
            };
        });

        overlay.querySelectorAll('.jv-setting-select').forEach(select => {
            select.onchange = (e) => {
                const key = select.dataset.setting;
                settings[key] = parseFloat(e.target.value);
                saveSettings();
                applySettings();
            };
        });
    }

    function openChangelog(isAutoShow = false) {
        const jvWindow = document.getElementById('juice-modal-root');
        if (!jvWindow) return;

        // Check if this is first install or update
        const savedVersion = localStorage.getItem('juicevault-version');
        const isFirstInstall = !savedVersion;
        const isUpdate = savedVersion && savedVersion !== CURRENT_VERSION;

        // Save current version
        localStorage.setItem('juicevault-version', CURRENT_VERSION);

        const overlay = document.createElement('div');
        overlay.className = 'jv-modal-overlay';
        overlay.id = 'jv-changelog-modal';

        let title = 'Changelog';
        let welcomeMessage = '';

        if (isAutoShow) {
            if (isFirstInstall) {
                title = 'Welcome to JuiceVault! 🎉';
                welcomeMessage = `
                    <div style="padding: 20px; background: rgba(192, 57, 43, 0.1); border-radius: 8px; margin-bottom: 20px;">
                        <p style="margin: 0 0 10px 0; font-size: 16px; color: var(--spice-text); font-weight: 600;">Thanks for installing JuiceVault!</p>
                        <p style="margin: 0; font-size: 14px; color: var(--spice-subtext); line-height: 1.5;">JuiceVault is your gateway to unreleased Juice WRLD music, You can stream, download, and enjoy play songs directly in spotify with EQ controls and other features.</p>
                    </div>
                `;
            } else if (isUpdate) {
                title = `Updated to v${CURRENT_VERSION} 🎊`;
                welcomeMessage = `
                    <div style="padding: 16px; background: rgba(155, 89, 182, 0.1); border-radius: 8px; margin-bottom: 16px;">
                        <p style="margin: 0; font-size: 14px; color: var(--spice-text);">✨ JuiceVault has been updated with new features and improvements!</p>
                    </div>
                `;
            }
        }

        // Build changelog HTML
        const changelogHTML = CHANGELOG.map(entry => `
            <div class="jv-changelog-entry">
                <span class="jv-changelog-version">v${entry.version}</span>
                <span class="jv-changelog-date">${entry.date}</span>
                <ul class="jv-changelog-list">
                    ${entry.changes.map(c => `<li>${c}</li>`).join('')}
                </ul>
            </div>
        `).join('');

        overlay.innerHTML = `
            <div class="jv-modal-content">
                <div class="jv-modal-header">
                    <span class="jv-modal-title">${title}</span>
                    <button class="jv-modal-close" id="jv-changelog-close">×</button>
                </div>
                ${welcomeMessage}
                ${changelogHTML}
            </div>
        `;

        jvWindow.appendChild(overlay);
        overlay.querySelector('#jv-changelog-close').onclick = () => overlay.remove();
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    }

    // Check version and show changelog on load if needed
    function checkVersionAndShowChangelog() {
        try {
            const savedVersion = localStorage.getItem('juicevault-version');
            if (!savedVersion || savedVersion !== CURRENT_VERSION) {
                // Wait 2 seconds for Spotify UI to load
                setTimeout(() => {
                    showStandaloneChangelog();
                }, 2000);
            }
        } catch (e) {
            console.error('[JuiceVault] Version check error:', e);
        }
    }

    // Show changelog as standalone overlay (doesn't require modal root)
    function showStandaloneChangelog() {
        const savedVersion = localStorage.getItem('juicevault-version');
        const isFirstInstall = !savedVersion;
        const isUpdate = savedVersion && savedVersion !== CURRENT_VERSION;

        // Save current version
        localStorage.setItem('juicevault-version', CURRENT_VERSION);

        // Track first install via API
        if (isFirstInstall) {
            try {
                fetch(`${API_URL}/misc/spicetify/newInstall?v=${CURRENT_VERSION}`, { method: 'GET' });
            } catch (e) {
                // Silent fail, analytics not critical
            }
        }

        let title = 'Changelog';
        let welcomeMessage = '';
        let githubButton = '';
        let viewMoreButton = '';

        if (isFirstInstall) {
            title = 'Welcome to JuiceVault! 🎉';
            welcomeMessage = `
                <div style="padding: 20px; background: rgba(192, 57, 43, 0.1); border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0 0 10px 0; font-size: 16px; color: var(--spice-text); font-weight: 600;">Thanks for installing JuiceVault!</p>
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: var(--spice-subtext); line-height: 1.5;">JuiceVault is your gateway to unreleased Juice WRLD music, You can stream, download, and enjoy play songs directly in spotify with EQ controls and other features.</p>
                    <button id="jv-github-btn" style="padding: 8px 16px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: var(--spice-text); cursor: pointer; font-size: 13px; transition: all 0.2s;">
                        ⭐ GitHub Repository
                    </button>
                </div>
            `;
            githubButton = true;
            viewMoreButton = `<button id="jv-view-more-btn" style="margin-top: 16px; padding: 10px 20px; background: rgba(155, 89, 182, 0.2); border: 1px solid rgba(155, 89, 182, 0.4); border-radius: 6px; color: var(--spice-text); cursor: pointer; font-size: 14px; font-weight: 600; width: 100%; transition: all 0.2s;">View Full Changelog</button>`;
        } else if (isUpdate) {
            title = `Updated to v${CURRENT_VERSION} 🎊`;
            welcomeMessage = `
                <div style="padding: 16px; background: rgba(155, 89, 182, 0.1); border-radius: 8px; margin-bottom: 16px;">
                    <p style="margin: 0; font-size: 14px; color: var(--spice-text);">✨ JuiceVault has been updated with new features and improvements!</p>
                </div>
            `;
            viewMoreButton = `<button id="jv-view-more-btn" style="margin-top: 16px; padding: 10px 20px; background: rgba(155, 89, 182, 0.2); border: 1px solid rgba(155, 89, 182, 0.4); border-radius: 6px; color: var(--spice-text); cursor: pointer; font-size: 14px; font-weight: 600; width: 100%; transition: all 0.2s;">View Full Changelog</button>`;
        }

        // Show only last 3 changelogs for welcome/update
        const changelogToShow = (isFirstInstall || isUpdate) ? CHANGELOG.slice(0, 3) : CHANGELOG;
        const changelogHTML = changelogToShow.map(entry => `
            <div class="jv-changelog-entry">
                <span class="jv-changelog-version">v${entry.version}</span>
                <span class="jv-changelog-date">${entry.date}</span>
                <ul class="jv-changelog-list">
                    ${entry.changes.map(c => `<li>${c}</li>`).join('')}
                </ul>
            </div>
        `).join('');

        const overlay = document.createElement('div');
        overlay.className = 'jv-modal-overlay';
        overlay.id = 'jv-standalone-changelog';
        overlay.innerHTML = `
            <div class="jv-modal-content">
                <div class="jv-modal-header">
                    <span class="jv-modal-title">${title}</span>
                    <button class="jv-modal-close" id="jv-standalone-changelog-close">×</button>
                </div>
                ${welcomeMessage}
                ${changelogHTML}
                ${viewMoreButton}
            </div>
        `;

        document.body.appendChild(overlay);

        // Wire up buttons
        overlay.querySelector('#jv-standalone-changelog-close').onclick = () => overlay.remove();
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        if (githubButton) {
            overlay.querySelector('#jv-github-btn').onclick = () => {
                window.open('https://github.com/AjaxFNC-YT/Spicetify-JuiceVault', '_blank');
            };
            // Add hover effect
            const ghBtn = overlay.querySelector('#jv-github-btn');
            ghBtn.onmouseenter = () => ghBtn.style.background = 'rgba(255,255,255,0.2)';
            ghBtn.onmouseleave = () => ghBtn.style.background = 'rgba(255,255,255,0.1)';
        }

        if (viewMoreButton) {
            overlay.querySelector('#jv-view-more-btn').onclick = () => {
                overlay.remove();
                showFullStandaloneChangelog();
            };
            // Add hover effect
            const vmBtn = overlay.querySelector('#jv-view-more-btn');
            vmBtn.onmouseenter = () => {
                vmBtn.style.background = 'rgba(155, 89, 182, 0.3)';
                vmBtn.style.transform = 'translateY(-2px)';
            };
            vmBtn.onmouseleave = () => {
                vmBtn.style.background = 'rgba(155, 89, 182, 0.2)';
                vmBtn.style.transform = 'translateY(0)';
            };
        }
    }

    // Show full changelog as standalone overlay
    function showFullStandaloneChangelog() {
        const changelogHTML = CHANGELOG.map(entry => `
            <div class="jv-changelog-entry">
                <span class="jv-changelog-version">v${entry.version}</span>
                <span class="jv-changelog-date">${entry.date}</span>
                <ul class="jv-changelog-list">
                    ${entry.changes.map(c => `<li>${c}</li>`).join('')}
                </ul>
            </div>
        `).join('');

        const overlay = document.createElement('div');
        overlay.className = 'jv-modal-overlay';
        overlay.id = 'jv-full-changelog';
        overlay.innerHTML = `
            <div class="jv-modal-content">
                <div class="jv-modal-header">
                    <span class="jv-modal-title">Full Changelog</span>
                    <button class="jv-modal-close" id="jv-full-changelog-close">×</button>
                </div>
                ${changelogHTML}
            </div>
        `;

        document.body.appendChild(overlay);
        overlay.querySelector('#jv-full-changelog-close').onclick = () => overlay.remove();
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    }

    function applySettings() {
        // Hide/show EQ button
        const eqBtn = document.getElementById('jv-eq-btn');
        if (eqBtn) eqBtn.style.display = settings.hideEQ ? 'none' : '';

        // Hide/show Shuffle button
        const shuffleBtn = document.getElementById('jv-shuffle');
        if (shuffleBtn) shuffleBtn.style.display = settings.hideShuffle ? 'none' : '';
    }

    function toggleEQ() {
        const existing = document.getElementById('jv-eq-popup');
        if (existing) {
            existing.remove();
            isEQOpen = false;
            document.getElementById('jv-eq-btn')?.classList.remove('active');
            return;
        }

        // Init EQ on first use
        initEQ();
        connectAudioToEQ();
        if (audioContext?.state === 'suspended') audioContext.resume();

        isEQOpen = true;
        document.getElementById('jv-eq-btn')?.classList.add('active');

        const playerRight = document.querySelector('.jv-player-right');
        if (!playerRight) return;

        const popup = document.createElement('div');
        popup.className = 'jv-eq-popup';
        popup.id = 'jv-eq-popup';
        popup.innerHTML = `
            <div class="jv-eq-title">
                <span>Equalizer</span>
                <button class="jv-eq-reset" id="jv-eq-reset">Reset</button>
            </div>
            <div class="jv-eq-band">
                <span class="jv-eq-label">Bass</span>
                <input type="range" min="-${settings.eqMax}" max="${settings.eqMax}" step="1" value="${bassFilter?.gain.value || 0}" class="jv-eq-slider" id="jv-eq-bass">
                <span class="jv-eq-value" id="jv-eq-bass-val">${bassFilter?.gain.value || 0} dB</span>
            </div>
            <div class="jv-eq-band">
                <span class="jv-eq-label">Mid</span>
                <input type="range" min="-${settings.eqMax}" max="${settings.eqMax}" step="1" value="${midFilter?.gain.value || 0}" class="jv-eq-slider" id="jv-eq-mid">
                <span class="jv-eq-value" id="jv-eq-mid-val">${midFilter?.gain.value || 0} dB</span>
            </div>
            <div class="jv-eq-band">
                <span class="jv-eq-label">Treble</span>
                <input type="range" min="-${settings.eqMax}" max="${settings.eqMax}" step="1" value="${trebleFilter?.gain.value || 0}" class="jv-eq-slider" id="jv-eq-treble">
                <span class="jv-eq-value" id="jv-eq-treble-val">${trebleFilter?.gain.value || 0} dB</span>
            </div>
            <div class="jv-eq-band">
                <span class="jv-eq-label">Reverb</span>
                <input type="range" min="0" max="100" step="1" value="${eqState.reverb}" class="jv-eq-slider" id="jv-eq-reverb">
                <span class="jv-eq-value" id="jv-eq-reverb-val">${eqState.reverb}%</span>
            </div>
            <div class="jv-eq-band">
                <span class="jv-eq-label">Gain</span>
                <input type="range" min="-12" max="12" step="1" value="${eqState.gain}" class="jv-eq-slider" id="jv-eq-gain">
                <span class="jv-eq-value" id="jv-eq-gain-val">${eqState.gain} dB</span>
            </div>
        `;

        playerRight.style.position = 'relative';
        playerRight.appendChild(popup);

        // Wire up sliders
        document.getElementById('jv-eq-bass').oninput = (e) => {
            const val = parseFloat(e.target.value);
            if (bassFilter) bassFilter.gain.value = val;
            eqState.bass = val;
            saveEQState();
            document.getElementById('jv-eq-bass-val').textContent = `${val} dB`;
        };
        document.getElementById('jv-eq-mid').oninput = (e) => {
            const val = parseFloat(e.target.value);
            if (midFilter) midFilter.gain.value = val;
            eqState.mid = val;
            saveEQState();
            document.getElementById('jv-eq-mid-val').textContent = `${val} dB`;
        };
        document.getElementById('jv-eq-treble').oninput = (e) => {
            const val = parseFloat(e.target.value);
            if (trebleFilter) trebleFilter.gain.value = val;
            eqState.treble = val;
            saveEQState();
            document.getElementById('jv-eq-treble-val').textContent = `${val} dB`;
        };
        document.getElementById('jv-eq-reverb').oninput = (e) => {
            const val = parseFloat(e.target.value);
            if (reverbNode && reverbNode._wetGain) {
                reverbNode._wetGain.gain.value = val / 100; // 0-1 range
            }
            eqState.reverb = val;
            saveEQState();
            document.getElementById('jv-eq-reverb-val').textContent = `${val}%`;
        };
        document.getElementById('jv-eq-gain').oninput = (e) => {
            const val = parseFloat(e.target.value);
            if (masterGainNode) {
                masterGainNode.gain.value = 1 + (val / 12); // -12dB to +12dB maps to ~0.25 to ~4
            }
            eqState.gain = val;
            saveEQState();
            document.getElementById('jv-eq-gain-val').textContent = `${val} dB`;
        };
        document.getElementById('jv-eq-reset').onclick = () => {
            if (bassFilter) bassFilter.gain.value = 0;
            if (midFilter) midFilter.gain.value = 0;
            if (trebleFilter) trebleFilter.gain.value = 0;
            if (reverbNode && reverbNode._wetGain) reverbNode._wetGain.gain.value = 0;
            if (masterGainNode) masterGainNode.gain.value = 1.0;
            document.getElementById('jv-eq-bass').value = 0;
            document.getElementById('jv-eq-mid').value = 0;
            document.getElementById('jv-eq-treble').value = 0;
            document.getElementById('jv-eq-reverb').value = 0;
            document.getElementById('jv-eq-gain').value = 0;
            document.getElementById('jv-eq-bass-val').textContent = '0 dB';
            document.getElementById('jv-eq-mid-val').textContent = '0 dB';
            document.getElementById('jv-eq-treble-val').textContent = '0 dB';
            document.getElementById('jv-eq-reverb-val').textContent = '0%';
            document.getElementById('jv-eq-gain-val').textContent = '0 dB';
        };

        // Close on click outside
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!popup.contains(e.target) && e.target.id !== 'jv-eq-btn') {
                    popup.remove();
                    isEQOpen = false;
                    document.getElementById('jv-eq-btn')?.classList.remove('active');
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 10);
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
            // Sanitize query - normalize quotes, remove problematic chars
            const safeQuery = query.replace(/['']/g, "'").replace(/[()]/g, "").trim();
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

        // Update volume slider with currentVolume (not audio.volume which is capped at 1.0)
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
            if (settings.disableVolumeSync) return;
            const spotifyVol = Spicetify.Player.getVolume();
            if (Math.abs(audio.volume - spotifyVol) > 0.005) {
                audio.volume = spotifyVol;
                const volSlider = document.getElementById('jv-volume');
                if (volSlider && document.activeElement !== volSlider) {
                    volSlider.value = spotifyVol;
                    updateVolumeSliderFill(volSlider, spotifyVol);
                }
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
                        <button class="jv-icon-btn" id="jv-changelog-btn" title="Changelog">${iconChangelog}</button>
                        <button class="jv-icon-btn" id="jv-settings-btn" title="Settings">${iconSettings}</button>
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
                        <button class="jv-btn-control" id="jv-eq-btn" title="Equalizer">${iconEQ}</button>
                        <span class="jv-volume-icon" id="jv-vol-icon">${iconVolume}</span>
                        <input type="range" min="0" max="1" step="0.01" class="jv-volume-slider" id="jv-volume">
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        applySettings();
        renderPlayerState();
        const handleSearch = debounce((e) => { searchVault(e.target.value); }, 300);

        document.getElementById('jv-close').onclick = toggleModal;
        document.getElementById('jv-play-btn').onclick = togglePlay;
        document.getElementById('jv-next').onclick = playNext;
        document.getElementById('jv-prev').onclick = playPrev;
        document.getElementById('jv-search').oninput = handleSearch;
        document.getElementById('jv-open-site').onclick = () => window.open('https://juicevault.xyz/', '_blank');
        document.getElementById('jv-shuffle').onclick = toggleShuffle;
        document.getElementById('jv-eq-btn').onclick = toggleEQ;
        document.getElementById('jv-settings-btn').onclick = openSettings;
        document.getElementById('jv-changelog-btn').onclick = openChangelog;
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
            showVolumeTooltip(val);
            updateVolumeUI();
            if (!settings.disableVolumeSync) {
                try { Spicetify.Player.setVolume(val); } catch (e) { }
            }
        };
        vol.onmouseup = hideVolumeTooltip;
        vol.onmouseleave = hideVolumeTooltip;
        updateVolumeSliderFill(vol, audio.volume);

        loadSongs();
    }

    // Init
    injectCSS();
    initButton();
    checkVersionAndShowChangelog();
})();

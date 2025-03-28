<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Audio Player</title>
    <style>
        @import url('https://fonts.cdnfonts.com/css/dseg7-classic');
        body {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background-color: black;
            margin: 0;
            font-family: monospace;
        }
        .player {
            background-color: black;
            padding: 20px;
            border-radius: 15px;
            text-align: center;
            width: 100%;
            max-width: 400px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .display {
            background-color: black;
            padding: 10px;
            font-size: 2em;
            margin-bottom: 10px;
            width: 90%;
            max-width: 400px;
            border-radius: 8px;
            color: #f00;
            font-family: 'DSEG7 Classic', monospace;
            letter-spacing: 2px;
            text-shadow: 0 0 5px #f00, 0 0 10px #f00;
            white-space: nowrap;
            overflow: hidden;
            position: relative;
            height: 2em;
            line-height: 2em;
        }
        .display-text {
            display: inline-block;
            white-space: nowrap;
            position: absolute;
            left: 100%;
        }
        .display-text.static {
            position: static; /* Center non-scrolling text */
            width: 100%;
            text-align: center;
        }
        .time-counter {
            background-color: black;
            padding: 5px;
            font-size: 1.2em;
            margin-bottom: 15px;
            min-width: 120px;
            border-radius: 8px;
            color: #f00;
            font-family: 'DSEG7 Classic', monospace;
            letter-spacing: 2px;
            text-shadow: 0 0 5px #f00, 0 0 10px #f00;
            white-space: nowrap;
            overflow: hidden;
            position: relative;
            height: 1.5em;
            line-height: 1.5em;
        }
        .modes {
            display: flex;
            justify-content: center;
            margin-bottom: 15px;
            flex-wrap: wrap;
        }
        .modes button {
            background-color: transparent;
            color: #f00;
            border: 2px solid #f00;
            padding: 8px 10px;
            margin: 5px;
            cursor: pointer;
            font-size: 0.9em;
            transition: background-color 0.3s, color 0.3s;
            min-width: 100px;
            text-align: center;
        }
        .timer-buttons {
            display: flex;
            justify-content: center;
            margin-bottom: 15px;
            flex-wrap: wrap;
        }
        .timer-buttons button {
            background-color: transparent;
            color: #DAA520;
            border: 2px solid #DAA520;
            padding: 8px 10px;
            margin: 5px;
            cursor: pointer;
            font-size: 0.9em;
            transition: background-color 0.3s, color 0.3s;
        }
        .timer-buttons button:disabled {
            cursor: not-allowed;
        }
        .controls {
            display: flex;
            justify-content: center;
            margin-top: 15px;
            flex-wrap: wrap;
        }
        .controls button {
            background: transparent;
            color: #FF0000;
            border: 2px solid #FF0000;
            padding: 8px 10px;
            margin: 5px;
            cursor: pointer;
            font-size: 0.9em;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 30px;
            transition: background-color 0.3s, color 0.3s, border-color 0.3s;
        }
        .controls button::before,
        .controls button::after {
            content: '';
            display: inline-block;
            width: 0;
            height: 0;
            transition: border-color 0.3s, background 0.3s;
        }
        #fastReverse::before {
            border-right: 8px solid #FF0000;
            border-top: 4px solid transparent;
            border-bottom: 4px solid transparent;
            margin-right: 2px;
        }
        #fastReverse::after {
            border-right: 8px solid #FF0000;
            border-top: 4px solid transparent;
            border-bottom: 4px solid transparent;
        }
        #fastForward::before {
            border-left: 8px solid #FF0000;
            border-top: 4px solid transparent;
            border-bottom: 4px solid transparent;
            margin-right: 2px;
        }
        #fastForward::after {
            border-left: 8px solid #FF0000;
            border-top: 4px solid transparent;
            border-bottom: 4px solid transparent;
        }
        #playPause.play::before {
            border-left: 8px solid #FF0000;
            border-top: 4px solid transparent;
            border-bottom: 4px solid transparent;
        }
        #playPause.pause::before {
            width: 3px;
            height: 8px;
            background: #FF0000;
            margin-right: 3px;
        }
        #playPause.pause::after {
            width: 3px;
            height: 8px;
            background: #FF0000;
        }
        #stop::before {
            width: 8px;
            height: 8px;
            background: #FF0000;
        }
        button.pressed {
            background-color: #00FF00;
            color: #000000;
            border-color: #00FF00;
        }
        .controls button.pressed::before,
        .controls button.pressed::after {
            border-color: #00FF00;
            background: #00FF00;
        }
        audio {
            display: none;
        }
    </style>
</head>
<body>
    <div class="player" id="player">
        <div class="display" id="ledDisplay">
            <span class="display-text">OFF</span>
        </div>
        <div class="time-counter" id="timeCounter">00:00:00</div>
        <div class="modes">
            <button id="focusMode">FOCUS</button>
            <button id="relaxMode">RELAX</button>
            <button id="tinnitusMode">TINNITUS</button>
        </div>
        <div class="timer-buttons">
            <button id="sleepMode">SLEEP</button>
            <button id="timer15">15</button>
            <button id="timer30">30</button>
            <button id="timer45">45</button>
            <button id="timer60">60</button>
        </div>
        <div class="controls">
            <button id="fastReverse"></button>
            <button id="playPause" class="play"></button>
            <button id="stop"></button>
            <button id="fastForward"></button>
        </div>
        <audio id="audioPlayer">
            <source src="" type="audio/mpeg">
            Your browser does not support the audio element.
        </audio>
    </div>
    <script>
        console.log("Script loaded");

        const ledDisplay = document.getElementById('ledDisplay');
        const displayText = ledDisplay.querySelector('.display-text');
        const timeCounter = document.getElementById('timeCounter');
        const audioPlayer = document.getElementById('audioPlayer');
        const modeButtons = {
            focus: document.getElementById('focusMode'),
            relax: document.getElementById('relaxMode'),
            tinnitus: document.getElementById('tinnitusMode'),
            sleep: document.getElementById('sleepMode')
        };
        const timerButtons = {
            15: document.getElementById('timer15'),
            30: document.getElementById('timer30'),
            45: document.getElementById('timer45'),
            60: document.getElementById('timer60')
        };
        const controlButtons = {
            playPause: document.getElementById('playPause'),
            stop: document.getElementById('stop'),
            fastReverse: document.getElementById('fastReverse'),
            fastForward: document.getElementById('fastForward')
        };

        let isPlaying = false;
        let activeMode = null;
        let currentTrackIndex = 0;
        let activeTimer = null;
        let timerTimeout = null;
        let tickerTimeout = null;
        let messageInterval = null;
        let currentTrackName = '';
        let countdownInterval = null;
        let scrollAnimationFrame = null;

        // Separate mantras and quotes for TINNITUS mode
        const mantras = [
            "FOCUS HERE. LET THE SOUND FADE.",
            "STAY HERE. IGNORE THE RINGING.",
            "LOOK HERE. KEEP FOCUSED HERE.",
            "LISTEN CLOSE. FORGET THE NOISE.",
            "STAY CALM. LET IT FADE AWAY.",
            "FOCUS NOW. THE RINGING FADES.",
            "KEEP HERE. NOISE DISAPPEARS.",
            "STARE HERE. SOUND FADES OUT.",
            "FOCUS DEEP. IGNORE THE RING.",
            "STAY STILL. LET IT FADE OUT.",
            "LOOK NOW. FORGET THE SOUND.",
            "KEEP FOCUSED. NOISE IS GONE.",
            "STAY HERE. RINGING FADES NOW.",
            "FOCUS HERE. SOUND IS FADING.",
            "LISTEN HERE. NOISE FADES OUT.",
            "STAY CALM. IGNORE THE RING.",
            "FOCUS NOW. LET IT FADE AWAY.",
            "KEEP HERE. THE SOUND FADES.",
            "LOOK HERE. RINGING IS GONE.",
            "STAY FOCUSED. NOISE FADES OUT.",
            "BREATHE DEEP. LET IT FADE.",
            "STAY PRESENT. NOISE FADES NOW.",
            "FOCUS HERE. RINGING IS GONE.",
            "LISTEN SOFT. FORGET THE RING.",
            "KEEP CALM. SOUND FADES OUT.",
            "STARE HERE. NOISE IS GONE.",
            "FOCUS NOW. LET IT SLIP AWAY.",
            "STAY STILL. RINGING FADES OUT.",
            "LOOK HERE. SOUND IS GONE.",
            "KEEP FOCUSED. LET IT FADE.",
            "STAY HERE. NOISE FADES AWAY.",
            "FOCUS DEEP. RINGING IS GONE.",
            "LISTEN CLOSE. SOUND FADES NOW.",
            "STAY CALM. FORGET THE NOISE.",
            "FOCUS HERE. LET IT FADE OUT.",
            "KEEP HERE. RINGING FADES NOW.",
            "STARE HERE. NOISE FADES OUT.",
            "FOCUS NOW. SOUND IS FADING.",
            "STAY STILL. LET THE NOISE GO.",
            "LOOK HERE. RINGING FADES AWAY.",
            "KEEP FOCUSED. NOISE FADES OUT.",
            "STAY HERE. SOUND FADES NOW.",
            "FOCUS DEEP. LET IT FADE AWAY.",
            "LISTEN SOFT. RINGING IS GONE.",
            "STAY CALM. NOISE FADES OUT.",
            "FOCUS HERE. SOUND FADES AWAY.",
            "KEEP HERE. LET IT FADE OUT.",
            "STARE HERE. RINGING FADES NOW.",
            "FOCUS NOW. NOISE IS GONE.",
            "STAY STILL. SOUND FADES OUT.",
            "LOOK HERE. LET IT FADE AWAY.",
            "KEEP FOCUSED. RINGING FADES OUT.",
            "STAY HERE. NOISE FADES NOW.",
            "FOCUS DEEP. SOUND IS GONE.",
            "LISTEN CLOSE. LET IT FADE OUT.",
            "STAY CALM. RINGING FADES AWAY.",
            "FOCUS HERE. NOISE FADES OUT.",
            "KEEP HERE. SOUND FADES NOW.",
            "STARE HERE. LET IT FADE AWAY.",
            "FOCUS NOW. RINGING IS GONE.",
            "STAY STILL. NOISE FADES OUT.",
            "LOOK HERE. SOUND FADES AWAY.",
            "KEEP FOCUSED. LET IT FADE OUT.",
            "STAY HERE. RINGING FADES NOW.",
            "FOCUS DEEP. NOISE IS GONE.",
            "LISTEN SOFT. SOUND FADES OUT.",
            "STAY CALM. LET IT FADE AWAY.",
            "FOCUS HERE. RINGING FADES OUT.",
            "KEEP HERE. NOISE FADES NOW.",
            "STARE HERE. SOUND FADES AWAY.",
            "FOCUS NOW. LET IT FADE OUT.",
            "STAY STILL. RINGING FADES AWAY.",
            "LOOK HERE. NOISE FADES OUT.",
            "KEEP FOCUSED. SOUND FADES NOW.",
            "STAY HERE. LET IT FADE AWAY.",
            "FOCUS DEEP. RINGING IS GONE.",
            "LISTEN CLOSE. NOISE FADES OUT.",
            "STAY CALM. SOUND FADES AWAY.",
            "FOCUS HERE. LET IT FADE OUT.",
            "KEEP HERE. RINGING FADES NOW.",
            "STARE HERE. NOISE FADES AWAY.",
            "FOCUS NOW. SOUND FADES OUT.",
            "STAY STILL. LET IT FADE AWAY.",
            "LOOK HERE. RINGING FADES OUT.",
            "KEEP FOCUSED. NOISE FADES NOW.",
            "STAY HERE. SOUND FADES AWAY.",
            "FOCUS DEEP. LET IT FADE OUT.",
            "LISTEN SOFT. RINGING FADES NOW.",
            "STAY CALM. NOISE FADES AWAY.",
            "FOCUS HERE. SOUND FADES OUT.",
            "KEEP HERE. LET IT FADE AWAY.",
            "STARE HERE. RINGING FADES OUT.",
            "FOCUS NOW. NOISE FADES NOW.",
            "STAY STILL. SOUND FADES AWAY.",
            "LOOK HERE. LET IT FADE OUT.",
            "KEEP FOCUSED. RINGING FADES NOW.",
            "STAY HERE. NOISE FADES OUT.",
            "FOCUS DEEP. SOUND FADES AWAY.",
            "LISTEN CLOSE. LET IT FADE NOW.",
            "STAY CALM. RINGING FADES OUT.",
            "FOCUS HERE. NOISE FADES AWAY.",
            "KEEP HERE. SOUND FADES OUT.",
            "STARE HERE. LET IT FADE AWAY.",
            "FOCUS NOW. RINGING FADES OUT.",
            "STAY STILL. NOISE FADES NOW.",
            "LOOK HERE. SOUND FADES OUT.",
            "KEEP FOCUSED. LET IT FADE AWAY.",
            "STAY HERE. RINGING FADES AWAY.",
            "FOCUS DEEP. NOISE FADES OUT.",
            "LISTEN SOFT. SOUND FADES NOW.",
            "STAY CALM. LET IT FADE OUT."
        ];

        const quotes = [
            // Omar Khayyam quotes (10 quotes)
            `"THE MOVING FINGER WRITES AND MOVES ON." - Omar Khayyam, Rubaiyat, c. 1120 CE`,
            `"LIFE MOVES FORWARD. DO NOT DWELL." - Omar Khayyam, Rubaiyat, c. 1120 CE`,
            `"BE HAPPY FOR THIS MOMENT IS YOUR LIFE." - Omar Khayyam, Rubaiyat, c. 1120 CE`,
            `"FIND JOY NOW. THIS MOMENT MATTERS." - Omar Khayyam, Rubaiyat, c. 1120 CE`,
            `"A LOAF OF BREAD A JUG OF WINE AND YOU." - Omar Khayyam, Rubaiyat, c. 1120 CE`,
            `"SIMPLE PLEASURES BRING TRUE HAPPINESS." - Omar Khayyam, Rubaiyat, c. 1120 CE`,
            `"THE WORLD IS BUT A MOMENTARY DREAM." - Omar Khayyam, Rubaiyat, c. 1120 CE`,
            `"LIFE IS FLEETING. LET WORRIES FADE." - Omar Khayyam, Rubaiyat, c. 1120 CE`,
            `"DRINK FOR YOU KNOW NOT WHENCE YOU CAME." - Omar Khayyam, Rubaiyat, c. 1120 CE`,
            `"LIVE FULLY. THE PAST IS UNKNOWN." - Omar Khayyam, Rubaiyat, c. 1120 CE`,
            // Rumi quotes (3 quotes)
            `"BEYOND IDEAS OF RIGHT AND WRONG A FIELD." - Jalal ad-Din Rumi, Masnavi, c. 1270 CE`,
            `"THE WOUND IS WHERE THE LIGHT ENTERS YOU." - Jalal ad-Din Rumi, Masnavi, c. 1270 CE`,
            `"SILENCE IS THE LANGUAGE OF THE DIVINE." - Jalal ad-Din Rumi, Masnavi, c. 1270 CE`,
            // Hafez quotes (3 quotes)
            `"THE HEART IS A THOUSAND STRINGED LUTE." - Khwaja Shams-ud-Din Hafiz, Divan, c. 1370 CE`,
            `"EVEN AFTER ALL THIS TIME THE SUN STAYS." - Khwaja Shams-ud-Din Hafiz, Divan, c. 1370 CE`,
            `"FEAR IS THE CHEAPEST ROOM IN THE HOUSE." - Khwaja Shams-ud-Din Hafiz, Divan, c. 1370 CE`,
            // Saadi quotes (2 quotes)
            `"A GARDEN IS A DELIGHT TO THE EYE." - Saadi Shirazi, Gulistan, c. 1258 CE`,
            `"PATIENCE IS THE KEY TO ALL RELIEF." - Saadi Shirazi, Gulistan, c. 1258 CE`,
            // Attar quotes (2 quotes)
            `"THE SOUL IS A BIRD OF THE SACRED." - Farid ud-Din Attar, The Conference of the Birds, c. 1177 CE`,
            `"TRAVEL THE PATH OF LOVE ALONE." - Farid ud-Din Attar, The Conference of the Birds, c. 1177 CE`
        ];

        // Function to shuffle array (Fisher-Yates shuffle)
        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        }

        const playlists = {
            focus: [
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/FOCUS/a-long-way-166385.mp3", name: "A Long Way" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/FOCUS/atmospheric-ambience-background_maven-11492.mp3", name: "Atmospheric Ambience Background" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/FOCUS/atmospheric-lo-fi-dreamy-lounge-music-259873.mp3", name: "Atmospheric Lo-Fi Dreamy Lounge" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/FOCUS/cosmic-ambient-236235.mp3", name: "Cosmic Ambient" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/FOCUS/focus+1-Ilariio.mp3", name: "Focus 1-Ilariio" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/FOCUS/follows-dark-ambient-194926.mp3", name: "Follows Dark Ambient" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/FOCUS/generative-digital-ambient-music-9416.mp3", name: "Generative Digital Ambient" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/FOCUS/lost-in-tokyo-242003.mp3", name: "Lost in Tokyo" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/FOCUS/nebula-space-clouds-9387.mp3", name: "Nebula Space Clouds" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/FOCUS/piano-dreamcloud-meditation-179215.mp3", name: "Piano Dreamcloud Meditation" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/FOCUS/space-atmospheric-background-124841+(1).mp3", name: "Space Atmospheric Background" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/FOCUS/tokyo-219288.mp3", name: "Tokyo" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/FOCUS/voices-are-calling-atmospheric-ambient-with-vocal-225458+(1).mp3", name: "Voices Are Calling" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/FOCUS/zero-one-five-atmospheric-mix-283340.mp3", name: "Zero One Five Atmospheric Mix" }
            ],
            relax: [
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/RELAX/Neon+Reflections+At+Twilight_1743146881.mp3", name: "Neon Reflections At Twilight" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/RELAX/cold-fusion-reactor-dystopian-cinematic-ambient-music-238558.mp3", name: "Cold Fusion Reactor" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/RELAX/cursed-crypt-dark-ambience-230666.mp3", name: "Cursed Crypt Dark Ambience" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/RELAX/deep-space-ambient-meditation-172134.mp3", name: "Deep Space Ambient Meditation" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/RELAX/lost-boy-atmospheric-emotional-cinematic-orchestral-pop-music-277891.mp3", name: "Lost Boy" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/RELAX/perfect-beauty-191271.mp3", name: "Perfect Beauty" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/RELAX/relaxing-deep-space-ambient-189720.mp3", name: "Relaxing Deep Space Ambient" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/RELAX/soothing-meditation-315918.mp3", name: "Soothing Meditation" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/RELAX/space-atmospheric-background-124841.mp3", name: "Space Atmospheric Background" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/RELAX/the-obsidian-enigma-dystopian-cinematic-ambient-music-238556.mp3", name: "The Obsidian Enigma" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/RELAX/the-realization-ambient-piano-230860.mp3", name: "The Realization" }
            ],
            tinnitus: [
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/SNOW/10-minutes-spaceship-fantasy-ambient-for-relaxation-155043.mp3", name: "Spaceship Fantasy Ambient" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/SNOW/ambientwill-312101.mp3", name: "Ambient Will" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/SNOW/gruesome-gloom-dark-ambience-230661.mp3", name: "Gruesome Gloom Dark Ambience" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/SNOW/nostromo-atmospheric-294093.mp3", name: "Nostromo Atmospheric" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/SNOW/otherworldly-factory-149701.mp3", name: "Otherworldly Factory" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/SNOW/shadowed-catacombs-dark-ambience-230655.mp3", name: "Shadowed Catacombs Dark Ambience" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/SNOW/the-futuristic-ambience-everything-is-one-179395.mp3", name: "Futuristic Ambience" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/SNOW/zero-one-five-atmospheric-mix-283340.mp3", name: "Zero One Five Atmospheric Mix" }
            ],
            sleep: [
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/SLEEP/frequency-of-sleep-meditation-113050.mp3", name: "Frequency of Sleep Meditation" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/SLEEP/ghostly-groove-dark-ambience-230665.mp3", name: "Ghostly Groove Dark Ambience" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/SLEEP/last-place-on-earth-sad-dystopian-apocalypse-war-soundtrack-128885.mp3", name: "Last Place on Earth" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/SLEEP/music-for-sleep-song-of-the-sea-250856.mp3", name: "Song of the Sea" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/SLEEP/red-haze-dystopian-cinematic-ambient-music-238554.mp3", name: "Red Haze" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/SLEEP/sleep-music-vol15-195425.mp3", name: "Sleep Music Vol 15" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/SLEEP/sleep-music-vol16-195422.mp3", name: "Sleep Music Vol 16" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/SLEEP/sound-ambience-sonido-ambiente-68-15693.mp3", name: "Sound Ambience" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/SLEEP/sounds-for-meditation-and-mental-clarity-symphony-of-inner-peace-261838.mp3", name: "Symphony of Inner Peace" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/SLEEP/spa-ambient-10min-253179.mp3", name: "Spa Ambient 10min" },
                { src: "https://f004.backblazeb2.com/file/rainplus1-files/SLEEP/the-waterfall-meditation-271046.mp3", name: "The Waterfall Meditation" }
            ]
        };

        function resetPlayer() {
            console.log("Resetting player");
            isPlaying = false;
            activeMode = null;
            currentTrackIndex = 0;
            activeTimer = null;
            if (timerTimeout) clearTimeout(timerTimeout);
            if (tickerTimeout) clearTimeout(tickerTimeout);
            if (messageInterval) clearTimeout(messageInterval);
            if (countdownInterval) clearInterval(countdownInterval);
            if (scrollAnimationFrame) cancelAnimationFrame(scrollAnimationFrame);
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
            updateTrackDisplay('OFF', false);
            updateTimeCounter(0);
            controlButtons.playPause.classList.remove('pause', 'pressed');
            controlButtons.playPause.classList.add('play');
            document.querySelectorAll('button').forEach(btn => btn.classList.remove('pressed'));
            Object.values(timerButtons).forEach(btn => {
                btn.disabled = true;
                btn.style.cursor = 'not-allowed';
            });
            ledDisplay.classList.remove('tinnitus-mode');
        }

        function updateTrackDisplay(text, animate = true, isHypnotic = false) {
            console.log("Updating display with:", text, "Animate:", animate, "IsHypnotic:", isHypnotic);
            if (scrollAnimationFrame) cancelAnimationFrame(scrollAnimationFrame);
            displayText.classList.remove('static');
            displayText.textContent = text;

            if (animate) {
                const duration = isHypnotic ? text.length * 500 : (text.length * 400 + 4000); // 400ms per character + 4s base for non-TINNITUS
                scrollText(duration);
                return duration;
            } else {
                displayText.classList.add('static'); // Center non-scrolling text
                displayText.style.left = '0';
                return 0;
            }
        }

        function scrollText(duration) {
            if (scrollAnimationFrame) cancelAnimationFrame(scrollAnimationFrame);
            const startTime = performance.now();
            const displayWidth = ledDisplay.offsetWidth;
            const textWidth = displayText.offsetWidth;
            const totalDistance = displayWidth + textWidth;

            function animate(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const position = 100 - (progress * (100 + (textWidth / displayWidth) * 100));
                displayText.style.left = `${position}%`;

                if (progress < 1) {
                    scrollAnimationFrame = requestAnimationFrame(animate);
                } else {
                    displayText.style.left = '100%'; // Reset position for next scroll
                }
            }

            scrollAnimationFrame = requestAnimationFrame(animate);
        }

        function startMessageCycle() {
            if (messageInterval) clearTimeout(messageInterval);
            ledDisplay.classList.add('tinnitus-mode');

            const shuffledMantras = shuffleArray([...mantras]);
            const shuffledQuotes = shuffleArray([...quotes]);

            let mantraIndex = 0;
            let quoteIndex = 0;
            let isMantraTurn = true;

            const displayNextMessage = () => {
                if (isMantraTurn) {
                    const scrollDuration = updateTrackDisplay(shuffledMantras[mantraIndex], true, true);
                    mantraIndex = (mantraIndex + 1) % shuffledMantras.length;
                    isMantraTurn = false;
                    messageInterval = setTimeout(displayNextMessage, scrollDuration + 3000);
                } else {
                    const scrollDuration = updateTrackDisplay(shuffledQuotes[quoteIndex], true, true);
                    quoteIndex = (quoteIndex + 1) % shuffledQuotes.length;
                    isMantraTurn = true;
                    messageInterval = setTimeout(displayNextMessage, scrollDuration);
                }
            };

            displayNextMessage();
        }

        function startTickerCycle() {
            if (!isPlaying || !currentTrackName || activeMode === 'tinnitus') return;
            if (tickerTimeout) clearTimeout(tickerTimeout);

            // Scroll the track name twice
            const singleScrollDuration = updateTrackDisplay(currentTrackName, true, false);
            tickerTimeout = setTimeout(() => {
                const secondScrollDuration = updateTrackDisplay(currentTrackName, true, false);
                tickerTimeout = setTimeout(() => {
                    updateTrackDisplay('PLAYING.', false);
                    tickerTimeout = setTimeout(() => {
                        startTickerCycle(); // Repeat the cycle
                    }, 180000); // 3 minutes
                }, secondScrollDuration);
            }, singleScrollDuration);
        }

        function formatTime(seconds) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }

        function updateTimeCounter(remainingTime) {
            timeCounter.textContent = formatTime(remainingTime);
        }

        function startCountdown() {
            if (countdownInterval) clearInterval(countdownInterval);
            countdownInterval = setInterval(() => {
                if (!isPlaying) return;
                const remainingTime = Math.max(0, audioPlayer.duration - audioPlayer.currentTime);
                updateTimeCounter(remainingTime);
                if (remainingTime <= 0) {
                    clearInterval(countdownInterval);
                }
            }, 1000);
        }

        function setMode(mode, button) {
            console.log("Setting mode:", mode);
            if (isPlaying) resetPlayer();
            activeMode = mode;
            const playlistLength = playlists[mode].length;
            currentTrackIndex = Math.floor(Math.random() * playlistLength);
            Object.values(modeButtons).forEach(btn => btn.classList.remove('pressed'));
            button.classList.add('pressed');
            const track = playlists[mode][currentTrackIndex];
            audioPlayer.src = track.src;
            currentTrackName = track.name;

            if (mode === 'tinnitus') {
                updateTrackDisplay('TINNITUS MODE', false);
            } else {
                updateTrackDisplay(track.name, false);
            }

            if (mode === 'sleep') {
                Object.values(timerButtons).forEach(btn => {
                    btn.disabled = false;
                    btn.style.cursor = 'pointer';
                });
            } else {
                Object.values(timerButtons).forEach(btn => {
                    btn.disabled = true;
                    btn.style.cursor = 'not-allowed';
                });
            }
        }

        function playTrack() {
            console.log("Playing track:", playlists[activeMode][currentTrackIndex].name);
            audioPlayer.src = playlists[activeMode][currentTrackIndex].src;
            audioPlayer.play().catch(err => console.error('Play error:', err));
            currentTrackName = playlists[activeMode][currentTrackIndex].name;

            if (activeMode === 'tinnitus') {
                updateTrackDisplay('RELAX', false);
                setTimeout(() => {
                    if (isPlaying) {
                        startMessageCycle();
                    }
                }, 1000);
            } else {
                startTickerCycle();
            }

            audioPlayer.onloadedmetadata = () => {
                updateTimeCounter(audioPlayer.duration);
                startCountdown();
            };
        }

        function nextTrack() {
            if (!activeMode) return;
            const playlistLength = playlists[activeMode].length;
            currentTrackIndex = (currentTrackIndex + 1) % playlistLength;
            updateTrackDisplay('NEXT', false);
            setTimeout(() => {
                currentTrackName = playlists[activeMode][currentTrackIndex].name;
                if (isPlaying) playTrack();
            }, 500);
        }

        function previousTrack() {
            if (!activeMode) return;
            const playlistLength = playlists[activeMode].length;
            currentTrackIndex = (currentTrackIndex - 1 + playlistLength) % playlistLength;
            updateTrackDisplay('PREV', false);
            setTimeout(() => {
                currentTrackName = playlists[activeMode][currentTrackIndex].name;
                if (isPlaying) playTrack();
            }, 500);
        }

        function setTimer(minutes) {
            console.log("Setting timer for:", minutes, "minutes");
            if (activeTimer) {
                timerButtons[activeTimer].classList.remove('pressed');
            }
            activeTimer = minutes;
            timerButtons[minutes].classList.add('pressed');
            if (timerTimeout) clearTimeout(timerTimeout);
            timerTimeout = setTimeout(() => {
                resetPlayer();
                updateTrackDisplay('TIMER OFF', false);
            }, minutes * 60 * 1000);
        }

        modeButtons.focus.addEventListener('click', () => setMode('focus', modeButtons.focus));
        modeButtons.relax.addEventListener('click', () => setMode('relax', modeButtons.relax));
        modeButtons.tinnitus.addEventListener('click', () => setMode('tinnitus', modeButtons.tinnitus));
        modeButtons.sleep.addEventListener('click', () => setMode('sleep', modeButtons.sleep));

        timerButtons[15].addEventListener('click', () => setTimer(15));
        timerButtons[30].addEventListener('click', () => setTimer(30));
        timerButtons[45].addEventListener('click', () => setTimer(45));
        timerButtons[60].addEventListener('click', () => setTimer(60));

        controlButtons.playPause.addEventListener('click', () => {
            if (!activeMode) {
                updateTrackDisplay('NO MODE', false);
                return;
            }
            isPlaying = !isPlaying;
            controlButtons.playPause.classList.toggle('play', !isPlaying);
            controlButtons.playPause.classList.toggle('pause', isPlaying);
            controlButtons.playPause.classList.toggle('pressed', isPlaying);
            if (isPlaying) {
                playTrack();
            } else {
                audioPlayer.pause();
                if (tickerTimeout) clearTimeout(tickerTimeout);
                if (countdownInterval) clearInterval(countdownInterval);
                updateTrackDisplay('PAUSED', false);
                updateTimeCounter(audioPlayer.duration - audioPlayer.currentTime);
            }
        });

        controlButtons.stop.addEventListener('click', resetPlayer);

        controlButtons.fastReverse.addEventListener('click', () => {
            if (activeMode) {
                previousTrack();
                controlButtons.fastReverse.classList.add('pressed');
                setTimeout(() => controlButtons.fastReverse.classList.remove('pressed'), 200);
            }
        });

        controlButtons.fastForward.addEventListener('click', () => {
            if (activeMode) {
                nextTrack();
                controlButtons.fastForward.classList.add('pressed');
                setTimeout(() => controlButtons.fastForward.classList.remove('pressed'), 200);
            }
        });

        audioPlayer.addEventListener('ended', () => {
            if (activeMode) {
                nextTrack();
                if (isPlaying) playTrack();
            }
        });

        window.addEventListener('load', () => {
            console.log("Window loaded, initializing player");
            resetPlayer();
        });
    </script>
</body>
</html>

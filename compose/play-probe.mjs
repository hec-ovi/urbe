/**
 * Plays scripted scenarios in a running game, headless and read-only.
 *
 * `node compose/play-probe.mjs <world id | play url> [scenario ...] [options]`
 *
 * A world id opens `/?mode=game&out=/out/games/<id>` on `--base`. A play URL is
 * used as given, except that a catalog `game=<id>` becomes the same `out`
 * preview: a probed session never saves. The page gets `&automation`, which
 * installs Engine's automation probe, and a street crowd of `--crowd` unless
 * the URL names one. Every request the page makes is screened: GET and HEAD
 * pass, a talk line gets a stand-in reply in the browser, NPC speech and the
 * cancel of lines rendered ahead reach /api/voice only while the voice scenario
 * runs, and anything else is refused.
 * Without the voice scenario the page gets `voice=off` unless the URL names
 * it, so the other scenarios put nothing on the voice GPU. The page's Vite
 * socket never opens, so it reports nothing to the dev server. Every call on
 * the page answers within a time limit, 60 s or its own wait plus that, so a
 * page that stalls fails its scenario, with each call it made and what the
 * page answered in the report's `trace`, instead of hanging the run.
 *
 * The browser takes its commands on this process's DevTools pipe and quits when
 * the pipe closes, however this process ends. SIGINT, SIGTERM and SIGHUP also
 * write the report and remove the browser's profile first.
 *
 * Scenarios: talk and chat (the default), spawn, voice, follow, lead, scene, story, ui, look, crowd. spawn
 * checks that the player stands on the ground where the game put them, holds
 * still on the pause menu, where the world holds, and stands on the ground
 * again when play goes on. voice speaks a
 * person's first line and the reply to a chat line through the engine's Voice
 * box and page audio (muted); it needs the Voice box running behind the engine.
 * follow asks the nearest people with the chat's 'Come with me' until one comes
 * along, walks away and watches them close the gap, then lets them go with
 * 'You can go now'. lead asks for the nearest place someone offers to show,
 * reads where the game says they are taking the player, walks behind them on
 * their own path until the talk about the place opens by itself at the
 * doorstep, and leaves it; both then watch the person go back to their day,
 * their feet on the ground as after every talk.
 * scene stands the player at the edge of each quest scene the preview stages
 * at quest start, or the one --scene names, and screenshots it once it stands.
 * A preview starts its quests fresh, so a scene a later step stages stays
 * dormant there and is listed as not visited, unless --advance-to first
 * fast-forwards the story until that step is active; a game with no scenery,
 * or none staged, has nothing to play there.
 * story walks a questline, the main story unless --quest names another, from
 * its first step to an ending. For each objective it checks that the place is
 * one the world has and the walk graph reaches and that its people are alive,
 * opens the step (waiting for its hour, standing at its venue) and does it as
 * a player would: talks to its person, sees the story topic load and commits
 * its reply, arrives, inspects a scene's evidence, walks an escort, or takes,
 * delivers, works, listens or observes with E. A step the player's path does
 * not finish is completed by the probe's fast-forward; both are recorded.
 * Each scene a step stages is visited, checked and screenshot as scene does.
 * ui opens a conversation with the main story's first person when it opens
 * with a talk, else with the nearest person, with the developer readouts off
 * (details=off): context starts folded in the H hint, speech reveals under
 * the name, a click completes it, and a subsequent answer types again with
 * Space completing it from the reply row. Replies stay clear of speech. H
 * and Escape close only the hint, and
 * the card holds the scene and stakes. It presses Escape in the talk, N with
 * the pointer free, then Escape on the street: the chat closes without the
 * pause menu, N brings the menu, the menu comes up on the street with the
 * clock and the crowd holding still, and Resume plays on. It screenshots the
 * speech, the hint, free talk, actions, the street after it and the menu.
 * crowd stands the player facing the busiest knot of people nearby (walkers
 * when six or more walk together, else whoever is near, from inside their
 * building), screenshots it wide and near, and reports how many bodies,
 * heights, builds, tops, trousers, garment sets and hairstyles they wear.
 * Options:
 *   --out <dir>          screenshots and report.json; default a new folder under the OS temp dir, never inside this checkout
 *   --base <url>         Engine origin for a world id, default http://localhost:5306
 *   --browser <path>     Chromium-family binary; default URBE_BROWSER, then Brave, Chrome or Chromium on PATH
 *   --backend <mode>     webgl (default, at low quality unless the URL names one) or webgpu; headless WebGPU
 *                        offers an adapter but cannot build the city's pipelines
 *   --talk <mode>        stub (default) answers talk in the browser; live lets the line reach the model, and the
 *                        engine keeps each exchange in that world's dialogue memory, a game's also in the game's
 *                        dialogue-memory.json, where it outlives a restart
 *   --throwaway-engine   the engine serving the URL is a throwaway one nobody plays, with engine/out mounted
 *                        read-only; --talk live on a game's out (/out/games) needs it
 *   --line <text>        the chat scenario's line
 *   --scene <id>         the scene scenario's scene; default every one staged
 *   --advance-to <step>  the scene scenario first fast-forwards the story until this step is active
 *   --quest <id>         the questline story walks and --advance-to advances; default the main story
 *   --shots <file>       the look scenario's shots: [{ name, at: [x, y, z], target?: [x, y, z], wait? }]
 *   --crowd <n>          default 120
 *   --timeout <seconds>  load limit, default 600
 *
 * Exit status: 0 every scenario passed or had nothing to play; 1 a check failed or a scenario errored;
 * 2 the game never became playable; 128 plus the signal's
 * number when a signal stopped the run.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { constants, tmpdir } from 'node:os';
import { delimiter, isAbsolute, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const CHECKOUT = fileURLToPath( new URL( '..', import.meta.url ) );
const WORLD_ID = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;
const BROWSERS = [ '/opt/brave.com/brave/brave', 'brave-browser', 'google-chrome', 'chromium', 'chromium-browser' ];
const VIEWPORT = { width: 1600, height: 900 };
const FLAGS = [
	'--headless', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
	'--disable-background-networking', '--disable-component-update', '--mute-audio', '--hide-scrollbars',
	// No player presses a key to let the page's audio run.
	'--autoplay-policy=no-user-gesture-required',
	'--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan',
	`--window-size=${VIEWPORT.width},${VIEWPORT.height}`, '--remote-debugging-pipe'
];
const STUB_REPLY = 'I stand in for the model, which nobody asked.';
/** The talk route and the stand-in answer to it: the stream's events. */
const TALK_PATH = '/api/talk/stream';
/** What the talk route answers when no model can: people then decide by their disposition (`--talk none`). */
const TALK_NONE = stub( 'application/json', JSON.stringify( { error: 'no model answers in this probe' } ) );
const TALK_STUB = stub( 'application/x-ndjson', [
	{ type: 'delta', text: STUB_REPLY }, { type: 'sentence', index: 0, text: STUB_REPLY }, { type: 'done', reply: STUB_REPLY }
].map( ( event ) => `${JSON.stringify( event )}\n` ).join( '' ) );
/** How long one call on the page may take, beyond any wait it makes in the page itself. */
const PAGE_MS = 60000;
/** How long a chat line may take to settle: the game gives up a reply that sends nothing for 90 s. */
const SAY_MS = 120000;
/**
 * How long a talk waits for the focused body to show. A rig is fitted a few
 * milliseconds a frame (the engine's frame budget), so on software WebGL's
 * slow frames it takes a minute or two where a GPU takes a second or two.
 */
const FOCUSED_MS = 240000;
/** NPC speech routes, which pass only while the voice scenario runs: a line, a batch rendered ahead, and the cancel of a batch under its group. */
const VOICE_PATHS = new Set( [ '/api/voice', '/api/voice/prefetch' ] );
const VOICE_CANCEL = '/api/voice/prefetch/';
/** How long a line may take to start playing: a render queued behind another on a busy GPU. */
const VOICE_WAIT_MS = 120000;
/** The look fields the crowd bakes and the focused body is dressed with: body is the crowd variant's mesh. */
const LOOK = [ 'body', 'hairStyle', 'skin', 'shirt', 'trousers', 'hair', 'eyebrows', 'sleeve', 'hem' ];
/** How many of the nearest people follow and lead ask along before they give up. */
const ASKED = 12;
/** A place a lead may show lies at most this straight distance away, so the walk there fits the run. */
const LEAD_REACH = 300;
/** How long the walk behind a leader may take, at 1.4 m/s along the pavement. */
const LEAD_WAIT_MS = 480000;
/** How many of the nearest people the access scenario talks to, looking for a friendly resident of its building. */
const ACCESS_ASKED = 16;
/** How long the access scenario trails a leader home: on software WebGL a city frame takes seconds, and a walker moves a frame's worth of it. */
const ACCESS_LEAD_MS = 3600000;
/** How long the access scenario waits for a home's floor to stand solid: software WebGL builds a floor in tens of seconds. */
const DOOR_WAIT_MS = 480000;
/** How close a follower comes: it stops 1.8 m from the player. */
const FOLLOW_NEAR = 2.5;
/** Continuity modes of somebody on their way back into their day, or in it. */
const BACK_TO_DAY = [ 'resuming', 'schedule' ];
/** How far feet may stand off the ground under them, in metres: the controller's own 0.02 m skin and a little. */
const FOOTING = 0.05;
/** How long a person just let go is watched walking back into their day. */
const WALK_OFF_MS = 2000;
/** How long a visited scene may take to stand: an indoor one waits for its floor to load first. */
/** How long a browser may take to answer: a shared-machine wrapper may queue it behind another headless browser first. */
const BROWSER_START_MS = Number( process.env.URBE_BROWSER_START_SECONDS ?? 1800 ) * 1000;
const SCENE_WAIT_MS = 30000;
/** How long a story step may take to open, and its people to come or its place to load. */
const STEP_MS = 30000;
/** How long an escort may walk: its route at a slow 0.8 m/s, a crowded headless frame rate included, plus a minute. */
const ESCORT_PACE = 0.8;
const ESCORT_SLACK_MS = 60000;
/** A story longer than this many steps is walking in circles. */
const MAX_STEPS = 120;
/**
 * The browser's side of the pointer lock the probe holds, for the ui
 * scenario: the lock lost as the browser reports it, and a lock granted.
 */
const RELEASE = 'game.input.handlers.pointerlockchange()';
const GRANT = 'game.input.onLockChange( window.urbe.input.locked = true )';
/** The world clock in seconds; the probe's state rounds it to whole minutes. */
const CLOCK = 'game.clock.seconds';
/** The notices on screen now, as the player reads them. */
const NOTICES = 'game.view.toast.element.querySelectorAll( \'.toast-text\' ).values().map( ( line ) => line.textContent ).toArray()';
/** Keeps what the companion signals from now on in `game.companion.heard`, each frame's signals as the host takes them. */
const COMPANION_SIGNALS = 'game && ( ( companion ) => { if ( ! companion.heard ) { const update = companion.update.bind( companion ); companion.heard = []; companion.update = ( request ) => { const signals = update( request ); for ( const signal of signals ) companion.heard.push( JSON.parse( JSON.stringify( signal ) ) ); return signals; }; } return true; } )( window.urbe.automation.game.companion )';
/** How many of the nearest people the talk scenario walks up to: hair colours near the pack's grey hide a bug in one sample. */
const TALKS = 6;
/** Conversations the talk scenario needs before its checks count. */
const MIN_TALKS = 3;
/** No page socket to Vite: frame reports and console lines stay in the page. */
const QUIET_VITE = `( () => {
	window.WebSocket = new Proxy( window.WebSocket, {
		construct: ( Socket, args ) => args[ 1 ] === 'vite-hmr'
			? Object.assign( new EventTarget(), { readyState: 0, OPEN: 1, send() {}, close() {} } )
			: Reflect.construct( Socket, args )
	} );
} )();`;
/** What the loading view shows, and whether the probe answers. */
const READINESS = `( () => {
	const game = window.urbe, error = document.querySelector( '.hud-loading-error' );
	return {
		probe: Boolean( game?.automation ), draws: game?.stats?.drawCalls ?? 0,
		loaded: Boolean( document.querySelector( '.hud-loading' )?.hidden ),
		step: document.querySelector( '.hud-loading-step' )?.textContent ?? '',
		error: error && ! error.hidden ? error.textContent : document.body?.textContent.startsWith( 'Could not start' ) ? document.body.textContent : null
	};
} )()`;

const SCENARIOS = {

	/**
	 * Walks up to each of the nearest people in turn, presses E and leaves
	 * again: each person's crowd look before, their crowd and focused look in
	 * the conversation, and both after it, compared field by field.
	 */
	async talk( { probe, shot } ) {

		const people = await probe( 'people()' );
		const shots = [];
		const talks = [];
		let apart = null;
		for ( const person of people.slice( 0, TALKS ) ) {

			const approached = await probe( `approach(${JSON.stringify( person.id )})` ).catch( () => null );
			if ( approached?.target?.person !== person.id ) continue;
			if ( ! shots.length ) shots.push( await shot( 'talk-street' ) );
			const { conversation } = await probe( 'press()' );
			const talked = { id: person.id, before: approached.person.look, conversation };
			talks.push( talked );
			if ( ! conversation ) continue;

			talked.during = await probe( `appearance({ timeoutMs: ${FOCUSED_MS} })`, FOCUSED_MS + PAGE_MS );
			if ( shots.length === 1 ) {

				await sleep( 800 );
				shots.push( await shot( 'talk-conversation' ) );
				const { feet } = await probe( 'state()' );
				apart = Math.round( Math.hypot( ...feet.map( ( value, axis ) => value - approached.person.position[ axis ] ) ) * 100 ) / 100;

			}
			await probe( 'leave()' );
			talked.after = await probe( `appearance(${JSON.stringify( { id: conversation.person } )})` );
			talked.feet = await walkOff( probe, conversation.person );

		}
		const opened = talks.filter( ( talked ) => talked.conversation && talked.during );
		const checks = [
			check( `E reaches ${MIN_TALKS} or more people`, talks.length >= MIN_TALKS, { people: people.length, reached: talks.length } ),
			check( 'E opens a conversation with each of them', talks.length > 0 && opened.length === talks.length,
				{ failed: talks.filter( ( talked ) => ! opened.includes( talked ) ).map( ( talked ) => talked.id ) } )
		];
		if ( ! opened.length ) return { checks, shots, data: { people, talks } };

		checks.push(
			check( 'the player stays beside the person', apart !== null && apart < 3, { metres: apart } ),
			check( 'the focused body shows', opened.every( ( talked ) => talked.during.hero ),
				{ missing: opened.filter( ( talked ) => ! talked.during.hero ).map( ( talked ) => talked.id ) } ),
			each( 'the crowd look holds through E', opened, ( talked ) => [ talked.before, talked.during.crowd, [ 'seed', ...LOOK ] ] ),
			each( 'the focused body wears the crowd look', opened, ( talked ) => [ talked.during.crowd, talked.during.hero ?? {}, LOOK ] ),
			each( 'the crowd look holds after the talk', opened, ( talked ) => [ talked.before, talked.after?.crowd ?? {}, [ 'seed', ...LOOK ] ] ),
			each( 'a focused body left showing them still wears it', opened.filter( ( talked ) => talked.after?.hero ),
				( talked ) => [ talked.after.crowd, talked.after.hero, LOOK ] ),
			grounded( 'each person walks off the talk with their feet on the ground', opened.map( ( talked ) => [ talked.id, talked.feet ] ) )
		);

		return { checks, shots, data: { people, talks } };

	},

	/** Says one line in the open conversation, or in a new one with the nearest person. */
	async chat( { probe, shot, options, talk } ) {

		const conversation = ( await probe( 'state()' ) ).conversation ?? await probe( 'converse()' );
		const checks = [ check( 'a conversation is open', Boolean( conversation ) ) ];
		if ( ! conversation ) return { checks };

		checks.push( check( 'the person has an identity to talk as', Boolean( conversation.npcId && conversation.name ), conversation ) );
		const sent = talk.length;
		const said = await probe( `say(${JSON.stringify( options.line )})`, SAY_MS );
		const requests = talk.slice( sent );
		checks.push(
			check( 'the line reaches /api/talk/stream', requests.length > 0, requests[ 0 ] ),
			check( 'a reply shows', Boolean( said.reply ) && ( options.talk === 'live' || said.reply === STUB_REPLY ), { reply: said.reply } ),
			check( 'the chat shows no error', ! said.error, { status: said.status } )
		);

		return { checks, shots: [ await shot( 'chat' ) ], data: { conversation, said, requests } };

	},

	/**
	 * The player where the game put them: standing on the ground, held still
	 * on the pause menu while the world holds (the pointer lost on the street,
	 * as a new game opens), and standing on the ground when play goes on.
	 */
	async spawn( { probe, shot } ) {

		const start = await probe( 'footing()' );
		await probe( RELEASE );
		const held = [];
		for ( let sample = 0; sample < 6; sample ++ ) {

			await sleep( 500 );
			held.push( ( await probe( 'footing()' ) ).feet[ 1 ] );

		}
		const paused = ! await probe( 'game.view.pause.element.hidden' );
		const shots = [ await shot( 'spawn-paused' ) ];
		await probe( 'game.view.pause.buttons.get( \'resume\' ).click()' );
		await probe( GRANT );
		await sleep( 1500 );
		const played = await probe( 'footing()' );
		shots.push( await shot( 'spawn-played' ) );
		const standing = ( footing ) => footing?.gap !== null && Math.abs( footing.gap ) <= FOOTING;

		return {
			checks: [
				check( 'the player starts standing on the ground', standing( start ), start ),
				check( 'the pointer lost on the street pauses', paused ),
				check( 'the player holds still while the world holds', held.every( ( y ) => y === start.feet[ 1 ] ), { start: start.feet[ 1 ], held } ),
				check( 'the player stands on the ground when play goes on', standing( played ), played )
			],
			shots, data: { start, held, played }
		};

	},

	/**
	 * Opens a conversation with someone who has an identity, waits for their
	 * first line to play to its end, then says a line and waits for the reply to
	 * play to its end: each line goes through /api/voice and the page's Web Audio.
	 */
	async voice( { probe, shot, options, voice } ) {

		let conversation = ( await probe( 'state()' ) ).conversation;
		for ( const person of await probe( 'people()' ) ) {

			if ( conversation?.npcId ) break;
			if ( conversation ) await probe( 'leave()' );
			conversation = await probe( `converse(${JSON.stringify( person.id )}, { attempts: 1 })` );

		}
		const checks = [ check( 'a conversation with a person is open', Boolean( conversation?.npcId ), conversation ) ];
		if ( ! conversation?.npcId ) return { checks };

		const greeting = await probe( `voice({ played: 1, timeoutMs: ${VOICE_WAIT_MS} })`, VOICE_WAIT_MS + PAGE_MS );
		const said = await probe( `say(${JSON.stringify( options.line )})`, SAY_MS );
		const reply = await probe( `voice({ played: ${( greeting?.played ?? 0 ) + 1}, timeoutMs: ${VOICE_WAIT_MS} })`, VOICE_WAIT_MS + PAGE_MS );
		const { chat } = await probe( 'state()' );
		const first = voice.find( ( request ) => request.path === '/api/voice' );
		const prefetches = voice.filter( ( request ) => request.path === '/api/voice/prefetch' );
		// DevTools reports a stream the page reads to its end as canceled, so a
		// whole line is the page's own count: played, and none failed.
		checks.push(
			check( 'the game has its own voice and the engine offers it', greeting?.status === 'ok', greeting ),
			check( 'the first line comes from /api/voice as audio', first?.status === 200 && first.type === 'audio/wav', first ),
			check( 'lines rendered ahead are queued', prefetches.every( ( request ) => request.status === 202 ), prefetches ),
			check( 'the first line plays to its end', greeting?.played >= 1, greeting ),
			check( 'audio arrives past the WAV header', greeting?.bytes > 44, { bytes: greeting?.bytes } ),
			check( 'the reply to a chat line plays to its end', Boolean( said.reply ) && reply?.played > greeting?.played, { reply: said.reply, played: reply?.played } ),
			check( 'no line fails', reply?.failed === 0, { failed: reply?.failed, error: reply?.error } )
		);

		return { checks, shots: [ await shot( 'voice' ) ], data: { conversation, greeting, said, reply, lines: chat.lines, requests: voice } };

	},

	/**
	 * Asks the nearest people with the chat's 'Come with me' until one comes
	 * along, stands 12 to 20 m away and watches them close the gap, then lets
	 * them go with 'You can go now' and watches them go back to their day.
	 */
	async follow( { probe, shot } ) {

		const asked = await askAlong( probe, ( offers ) => offers.find( ( offer ) => offer.kind === 'follow' && offer.available ) );
		const checks = [ check( 'someone agrees to come along from the chat action', Boolean( asked.companion ), { tried: asked.tried } ) ];
		if ( ! asked.companion ) return { checks, data: asked };

		const { npcId } = asked.companion;
		const away = await probe( `standAway(${JSON.stringify( npcId )})` );
		const samples = await companionUntil( probe, ( companion ) => ! companion || companion.distance <= FOLLOW_NEAR && companion.walk === 'waiting', 40000 );
		const last = samples.at( - 1 );
		const footing = await footingOf( probe, ( await probe( `person(${JSON.stringify( npcId )})` ) )?.id );
		const shots = [ await shot( 'follow' ) ];
		const dismissed = await dismiss( probe, npcId );
		checks.push(
			check( 'the chat closes and the person follows', asked.companion.kind === 'follow' && samples.every( ( sample ) => sample?.mode === 'following' ), { first: samples[ 0 ] } ),
			check( 'the player stands 12 to 20 m away', away.placed && away.distance >= 12, away ),
			check( 'the follower closes the gap and waits beside the player', last?.distance <= FOLLOW_NEAR && last.walk === 'waiting',
				{ from: away.distance, to: last?.distance ?? null, walk: last?.walk ?? null } ),
			check( 'the follower walks on the way', samples.some( ( sample ) => sample?.walk === 'walking' ), { walks: samples.map( ( sample ) => sample?.walk ) } ),
			grounded( 'the follower stands on the ground', [ [ npcId, [ footing ] ] ] ),
			check( '"You can go now" lets the follower go', Boolean( dismissed.acted?.clicked ) && dismissed.companion === null, dismissed ),
			check( 'the person goes back to their day', BACK_TO_DAY.includes( dismissed.person?.mode ), dismissed.person ),
			grounded( 'the person walks off with their feet on the ground', [ [ npcId, dismissed.feet ] ] )
		);

		return { checks, shots, data: { asked, away, samples, footing, dismissed } };

	},

	/**
	 * Asks the nearest people to show a place until one leads the way to the
	 * nearest they offer, walks behind them on the path they take, and checks
	 * that the talk about the place opens by itself when they arrive, with the
	 * place in the talk request. Leaving it, the person goes back to their day.
	 */
	/**
	 * Addresses, locks and cards in a furnished building with numbered homes,
	 * the one --building names, else the one with most. At its door, the
	 * nearest people are talked to until one is a friendly resident of it out
	 * of their home (people are established as they are talked to, each
	 * housed in a dwelling of an opened building). In that talk, asked from
	 * the chat's row, they hand over a copy of their home's card (with --talk
	 * none they decide by their disposition, as with no model), and asked to
	 * show where they live they lead the player to its door by its address,
	 * riding the lift with the player, and open it. There a neighbour's door
	 * stays shut and solid to the player, whose prompt says what it needs, and
	 * their own, once closed again, opens with the card and the player walks in.
	 */
	async access( { probe, shot, options } ) {

		if ( ( await probe( 'state()' ) ).conversation ) await probe( 'leave()' );
		const buildings = await probe( 'buildings()' );
		const building = options.building ? buildings.find( ( entry ) => entry.parcelId === options.building ) : buildings.find( ( entry ) => entry.apartments > 0 );
		if ( ! building ) return { skipped: 'no furnished building with numbered homes', data: { buildings } };
		const fps = await probe( 'frameRate({ seconds: 20 })', 20000 + PAGE_MS );
		const out = ( one ) => one.place && ! ( one.place.kind === 'parcel' && one.place.id === building.parcelId ) && ! [ 'working', 'sleeping' ].includes( one.activity );
		// At the building's door: software WebGL walks a person a few centimetres a frame, so the people met live near it.
		const visited = await probe( `visit({ kind: 'parcel', id: ${JSON.stringify( building.parcelId )} }, { timeoutMs: 60000 })`, 60000 + PAGE_MS );
		const around = await until( () => probe( `people({ limit: ${ACCESS_ASKED} })` ), ( people ) => people.length >= 6, 120000 );
		let resident = null;
		const tried = [];
		for ( const person of around ) {

			const conversation = await probe( `converse(${JSON.stringify( person.id )}, { attempts: 1 })` );
			if ( conversation?.npcId ) {

				const one = ( await probe( `residents(${JSON.stringify( building.parcelId )})` ) ).find( ( candidate ) => candidate.npcId === conversation.npcId ) ?? null;
				tried.push( { id: person.id, npcId: conversation.npcId, resident: one && [ one.address, one.disposition, one.activity ] } );
				// Talking to them still: the card is asked in this talk.
				if ( one?.unitId && one.disposition === 'friendly' && out( one ) ) {

					resident = one;
					break;

				}

			}
			if ( conversation ) await probe( 'leave()' );

		}
		const data = { building, fps, visited, around: around.length, tried, resident };
		const checks = [ check( 'a friendly resident is out of their home to talk to', Boolean( resident ), { tried } ) ];
		if ( ! resident ) return { checks, data };
		const shots = [];
		const { unitId, scope } = resident;
		const label = resident.address.split( ', ' ).at( - 1 );

		// Asked from the chat's row, they hand over a copy of their home's card.
		const row = ( await probe( 'state()' ) ).chat.actions;
		const ask = row.find( ( action ) => action.id === `card:${scope}` ) ?? null;
		data.asked = ask ? await probe( `act(${JSON.stringify( ask.id )})` ) : null;
		const given = data.given = await until( () => probe( 'access()' ), ( access ) => access.cards.some( ( card ) => card.grants.includes( scope ) ), 30000 );
		data.cardNotices = await probe( NOTICES );
		shots.push( await shot( 'access-card-given' ) );
		const card = given.cards.find( ( one ) => one.grants.includes( scope ) ) ?? null;
		data.cardChat = ( await probe( 'state()' ) ).chat.lines;
		checks.push(
			check( 'the chat\'s row asks for access to their apartment', ask?.label === 'Can you give me access to your apartment?', { row } ),
			check( 'the friendly resident hands over their home\'s card', Boolean( card ), { cards: given.cards } ),
			check( 'the card names its issuer and what it opens', card?.issuer === resident.name && card?.access === resident.address && /key card$/.test( card?.label ?? '' ), card ),
			check( 'a notice says the card was added', data.cardNotices.some( ( text ) => text.includes( card?.label ?? '\u0000' ) ), data.cardNotices )
		);

		// In the same talk, asked to show where they live, they lead the player there by its address, by the lift, and open their door.
		await probe( COMPANION_SIGNALS );
		const offers = ( await probe( 'state()' ) ).conversation ? await probe( 'offers()' ) : [];
		const homeward = offers.find( ( offer ) => offer.kind === 'lead' && offer.destination?.relation === 'home' ) ?? null;
		data.homeward = homeward ? await probe( `act(${JSON.stringify( homeward.offerId )})` ) : null;
		const back = data.back = await trailHome( probe, resident.npcId );
		await sleep( 2000 );
		data.homeDoor = await probe( `door(${JSON.stringify( unitId )})` );
		shots.push( await shot( 'access-led-home' ) );
		checks.push(
			check( 'they offer to show where they live, by its address', homeward?.destination?.name === resident.address, { homeward, offers: offers.map( ( offer ) => [ offer.label, offer.destination?.name ] ) } ),
			check( 'they lead the player to their apartment by its address', back.notices.some( ( text ) => text.includes( resident.address ) ), back.notices ),
			check( 'they ride the lift with the player', back.rode, { rode: back.rode, heights: back.heights } ),
			check( 'they arrive at their door', back.arrived, back.companion ),
			check( 'they open their door for the player', data.homeDoor?.wanted === 1 || data.homeDoor?.open > 0.5, data.homeDoor )
		);
		if ( ( await probe( 'state()' ) ).conversation ) await probe( 'leave()' );

		// A neighbour's door stays shut and solid: the player has no card for it.
		const units = await probe( `game.addresses.building(${JSON.stringify( building.parcelId )}).units.map( ( unit ) => ( { id: unit.id, floor: unit.floor, kind: unit.kind, label: unit.label, address: unit.address } ) )` );
		const own = units.find( ( unit ) => unit.id === unitId );
		const neighbour = data.neighbour = units.filter( ( unit ) => unit.kind === 'apartment' && unit.id !== unitId )
			.sort( ( a, b ) => Math.abs( a.floor - own.floor ) - Math.abs( b.floor - own.floor ) || a.floor - b.floor )[ 0 ] ?? null;
		const locked = data.locked = neighbour ? await probe( `standAtDoor(${JSON.stringify( neighbour.id )}, { timeoutMs: ${DOOR_WAIT_MS} })`, DOOR_WAIT_MS + PAGE_MS ) : null;
		shots.push( await shot( 'access-locked' ) );
		data.pressedLocked = await probe( 'press()' );
		data.lockedNotices = await probe( NOTICES );
		await sleep( 1500 );
		const shut = data.shut = neighbour ? await probe( `door(${JSON.stringify( neighbour.id )})` ) : null;
		const blocked = data.blocked = neighbour ? await probe( `walk({ unitId: ${JSON.stringify( neighbour.id )}, frames: 60 })`, DOOR_WAIT_MS ) : null;
		checks.push(
			check( 'the player stands at the neighbour\'s door', locked?.placed === true, locked ),
			check( 'the neighbour\'s door is locked to the player', locked?.lock?.locked === true, locked?.lock ),
			check( 'the prompt says what the door needs', locked?.prompt === `Locked: ${neighbour?.label} needs an access card`, { prompt: locked?.prompt } ),
			check( 'E leaves the locked door shut', shut?.open === 0 && shut?.wanted === 0, shut ),
			check( 'the locked door stops the player', blocked?.past !== null && blocked?.past < 0, blocked ),
			check( 'a notice says what the locked door needs', data.lockedNotices.some( ( text ) => text === `Locked: ${neighbour?.label} needs an access card` ), data.lockedNotices )
		);

		// Their own door, once it has closed again, opens with the card, and the player walks in.
		data.closed = await until( () => probe( `door(${JSON.stringify( unitId )})` ), ( door ) => door?.open === 0, 120000 );
		const unlocked = data.unlocked = await probe( `standAtDoor(${JSON.stringify( unitId )}, { timeoutMs: ${DOOR_WAIT_MS} })`, DOOR_WAIT_MS + PAGE_MS );
		shots.push( await shot( 'access-unlocked' ) );
		data.pressedOpen = await probe( 'press()' );
		const opened = data.opened = await until( () => probe( `door(${JSON.stringify( unitId )})` ), ( door ) => door?.open >= 0.95, 60000 );
		const entered = data.entered = await probe( `walk({ unitId: ${JSON.stringify( unitId )}, frames: 90, metres: 2 })`, DOOR_WAIT_MS );
		shots.push( await shot( 'access-inside' ) );
		checks.push(
			check( `with the card ${label}'s door is unlocked to the player`, unlocked.lock?.locked === false, unlocked.lock ),
			check( 'the prompt offers to open it', unlocked.prompt === `E  open the door to ${label}`, { prompt: unlocked.prompt } ),
			check( 'E opens the door', opened?.open >= 0.95, opened ),
			check( 'the player walks in', entered.past !== null && entered.past > 0.5, entered )
		);

		return { checks, shots, data };

	},

	async lead( { probe, shot, talk } ) {

		const asked = await askAlong( probe, ( offers ) => offers
			.filter( ( offer ) => offer.kind === 'lead' && offer.available && offer.distance !== null && offer.distance <= LEAD_REACH )
			.sort( ( a, b ) => a.distance - b.distance )[ 0 ] );
		const checks = [ check( 'someone agrees to show a place from the chat action', Boolean( asked.companion ), { tried: asked.tried } ) ];
		if ( ! asked.companion ) return { checks, data: asked };

		const { npcId } = asked.companion;
		const place = asked.offer.destination.name;
		const setOff = await probe( NOTICES );
		const sent = talk.length;
		const trailed = await probe( `trail(${JSON.stringify( npcId )}, { timeoutMs: ${LEAD_WAIT_MS} })`, LEAD_WAIT_MS + PAGE_MS );
		const spoken = await until( () => probe( 'state()' ), ( state ) => state.chat.lines.some( ( line ) => line.from === 'npc' ) || ! state.chat.sending && state.chat.lines.length > 0, 10000 );
		const arrival = { notices: await probe( NOTICES ), footing: await footingOf( probe, trailed.conversation?.person ) };
		const requests = talk.slice( sent );
		const shots = [ await shot( 'lead-arrival' ) ];
		const walked = trailed.samples.filter( ( sample ) => sample.destination?.distance !== null );
		const left = await probe( 'leave()' );
		const ended = await until( () => probe( 'companion()' ), ( companion ) => companion === null, 5000 );
		const person = await until( () => probe( `person(${JSON.stringify( npcId )})` ), ( held ) => BACK_TO_DAY.includes( held?.mode ), 5000 );
		const feet = await walkOff( probe, person?.id );
		checks.push(
			check( 'the chat closes and the person leads', asked.companion.kind === 'lead' && trailed.samples.every( ( sample ) => sample.mode === 'leading' ), { first: trailed.samples[ 0 ] } ),
			check( 'the way to the place shrinks', walked.length > 1 && walked.at( - 1 ).destination.distance < walked[ 0 ].destination.distance,
				{ from: walked[ 0 ]?.destination.distance ?? null, to: walked.at( - 1 )?.destination.distance ?? null, seconds: trailed.ms / 1000 } ),
			check( 'the player reads where the leader is taking them', setOff.some( ( text ) => text.includes( place ) ), { place, notices: setOff } ),
			check( 'the leader arrives', trailed.companion?.walk === 'arrived', trailed.companion ),
			check( 'the leader stops at the place\'s doorstep', trailed.companion?.destination?.distance <= 0.5, trailed.companion?.destination ),
			check( 'the player reads that they have arrived there', arrival.notices.some( ( text ) => text.includes( place ) && text !== setOff.find( ( seen ) => seen.includes( place ) ) ), { place, notices: arrival.notices } ),
			grounded( 'the leader stands on the ground at the place', [ [ npcId, [ arrival.footing ] ] ] ),
			check( 'the talk about the place opens by itself with the leader', trailed.conversation?.npcId === npcId, trailed.conversation ),
			check( 'the talk request carries the place', requests.some( ( request ) => request.guide?.placeId ), requests ),
			check( 'the leader speaks first, unasked', spoken.chat.lines[ 0 ]?.from === 'npc', spoken.chat.lines ),
			check( 'leaving the talk lets the leader go', left.conversation === null && ended === null, ended ),
			check( 'the person goes back to their day', BACK_TO_DAY.includes( person?.mode ), person ),
			grounded( 'the person walks off with their feet on the ground', [ [ npcId, feet ] ] )
		);

		return { checks, shots, data: { asked, setOff, trailed, arrival, requests, lines: spoken.chat.lines, person, feet } };

	},

	/**
	 * Stands the player at each shot of the --shots file and screenshots it, to
	 * review a look at chosen spots (a gutter, a lane line, a facade, a room):
	 * `[{ name, at: [x, y, z], target?: [x, y, z], wait?, read? }]`, `at` the
	 * feet in world metres, `target` where the crosshair aims, `wait` the
	 * seconds to let the place stream in and settle (default 4), `read` a
	 * JavaScript expression on the running game (`window.urbe`) whose JSON
	 * value lands in the report beside the shot, to measure what it shows.
	 */
	async look( { probe, shot, options } ) {

		if ( ! options.shots ) return { skipped: 'name the shots with --shots <file.json>' };
		const list = JSON.parse( readFileSync( options.shots, 'utf8' ) );
		const point = ( value ) => value ? { x: value[ 0 ], y: value[ 1 ], z: value[ 2 ] } : null;
		const checks = [], shots = [], reads = {};
		for ( const { name, at, target = null, wait = 4, read = null } of list ) {

			const placed = await probe( `game.placePlayer(${JSON.stringify( point( at ) )}, ${JSON.stringify( point( target ) )})` );
			await sleep( wait * 1000 );
			shots.push( await shot( `look-${name}` ) );
			checks.push( check( `${name}: the player stands there`, placed === true, { at, target } ) );
			if ( read ) reads[ name ] = await probe( `game && JSON.parse( JSON.stringify( ( () => { const urbe = window.urbe; return ( ${read} ); } )() ?? null ) )` ).catch( ( error ) => ( { error: error.message } ) );

		}

		return { checks, shots, data: { reads } };

	},

	/**
	 * Visits each quest scene the preview stages at quest start, or the one
	 * --scene names: stands the player at the edge of its frame, waits for it
	 * to stand around them and screenshots it. No scene may have failed. The
	 * preview starts its quests fresh, so a scene a later step stages is
	 * dormant there and listed as not visited.
	 */
	async scene( { probe, shot, options } ) {

		const advanced = options[ 'advance-to' ]
			? await probe( `advance(${JSON.stringify( { questId: options.quest ?? null, toStepId: options[ 'advance-to' ], timeoutMs: STEP_MS } )})`, MAX_STEPS * STEP_MS )
			: null;
		const scenes = await probe( 'scenes()' );
		if ( ! scenes.length ) return { skipped: 'no scenery in this game' };
		const named = options.scene ? scenes.filter( ( scene ) => scene.sceneId === options.scene ) : scenes;
		const failed = scenes.filter( ( scene ) => scene.failed );
		const visiting = named.filter( ( scene ) => scene.status === 'staged' && ! scene.failed );
		const unvisited = named.filter( ( scene ) => scene.status !== 'staged' ).map( ( { sceneId, status } ) => `${sceneId} (${status})` );
		const checks = [ check( 'no quest scene failed', failed.length === 0, failed.map( ( { sceneId, failed: code } ) => ( { sceneId, code } ) ) ) ];
		if ( advanced ) {

			checks.push( check( `the story fast-forwards to ${options[ 'advance-to' ]}`, [ 'reached', 'passed' ].includes( advanced.stopped ),
				{ stopped: advanced.stopped, refused: advanced.completed.filter( ( step ) => ! step.ok ) } ) );

		}
		if ( options.scene ) checks.push( check( `the game has scene ${options.scene}`, named.length > 0, { scenes: scenes.map( ( scene ) => scene.sceneId ) } ) );
		if ( named.length && ! visiting.length && ! failed.length && ! advanced ) {

			return { skipped: `no quest scene is staged at quest start, and the preview starts its quests fresh: ${unvisited.join( ', ' )} not visited`, data: { scenes } };

		}
		const shots = [];
		const visits = [];
		for ( const scene of visiting ) {

			const { checks: visited, ...visit } = await visitScene( probe, shot, scene );
			shots.push( visit.shot );
			visits.push( visit );
			checks.push( ...visited );

		}

		return { checks, shots, data: { advanced, scenes, visits, unvisited } };

	},

	/**
	 * Walks a questline from its first step to an ending, doing each step as a
	 * player would where the probe can and fast-forwarding it where that does
	 * not finish it, and visits each scene a step stages. Each step's record
	 * holds its place, route and people, what opened it, what the player's
	 * path did and whether the fast-forward was needed.
	 */
	async story( { probe, shot, options } ) {

		const start = await probe( `quest(${JSON.stringify( options.quest ?? null )})` );
		if ( ! start ) return { skipped: 'no questline in this game' };
		if ( start.state === 'blocked' ) return { checks: [ check( `${start.questId} is cast`, false, start ) ], data: { start } };
		const { questId } = start;
		const steps = [];
		const visits = [];
		const checks = [];
		const shots = [];
		let quest = start;
		while ( ! quest.ending && quest.objective && steps.length < MAX_STEPS ) {

			const { stepId } = quest.objective;
			if ( steps.some( ( record ) => record.stepId === stepId ) ) break;
			const record = await playStep( probe, questId, quest );
			steps.push( record );
			checks.push( ...record.checks.map( ( item ) => ( { ...item, name: `${stepId}: ${item.name}` } ) ) );
			quest = await probe( `quest(${JSON.stringify( questId )})` );
			console.log( `  ${stepId} ${record.kind}: ${record.via ? `done by ${record.via}` : 'not done'}${record.failed.length ? `; failed: ${record.failed.join( '; ' )}` : ''}` );
			if ( ! record.via ) break;
			const known = await probe( 'scenes()' );
			for ( const scene of known.filter( ( each ) => each.questId === questId && ! visits.some( ( visit ) => visit.sceneId === each.sceneId ) ) ) {

				if ( scene.failed ) {

					visits.push( { sceneId: scene.sceneId, afterStep: stepId, failed: scene.failed } );
					checks.push( check( `${scene.sceneId} stands`, false, { code: scene.failed } ) );

				}
				if ( scene.status !== 'staged' || scene.failed ) continue;
				const { checks: visited, ...visit } = await visitScene( probe, shot, scene );
				visits.push( { ...visit, afterStep: stepId } );
				checks.push( ...visited );
				shots.push( visit.shot );

			}
			// Standing in a scene may itself arrive where a later step sends the player.
			quest = await probe( `quest(${JSON.stringify( questId )})` );
			for ( const done of quest.completed.filter( ( id ) => ! steps.some( ( record ) => record.stepId === id ) ) ) {

				steps.push( { stepId: done, via: 'scene visit', note: `completed while visiting the scenes staged after ${stepId}`, checks: [], failed: [] } );

			}

		}
		if ( ( await probe( 'state()' ) ).conversation ) await probe( 'leave()' );
		shots.push( await shot( 'story-end' ) );
		checks.push( check( 'the story reaches an ending', Boolean( quest.ending ), { state: quest.state, objective: quest.objective, completed: quest.completed.length } ) );

		return { checks, shots, data: { questId, ending: quest.ending, steps, visits, end: quest } };

	},

	/**
	 * Stands the player a few metres from the busiest knot of people on the
	 * pavements around them, facing it, then nearer, and screenshots both: the
	 * crowd's bodies and clothes side by side. Reports how many different
	 * bodies, heights, tops, trousers and garment sets the people near the
	 * player wear.
	 */
	async crowd( { probe, shot } ) {

		const people = await probe( 'people({ radius: 80, limit: 80 })' );
		if ( people.length < 3 ) return { skipped: `only ${people.length} people around` };
		const near = ( a, b ) => Math.hypot( a.position[ 0 ] - b.position[ 0 ], a.position[ 2 ] - b.position[ 2 ] );
		// Out on the pavements, where a knot is people walking, when there are a few.
		const street = [];
		for ( const person of people ) if ( await probe( `game.crowd.members.get(${JSON.stringify( person.id )})?.edge ? true : false` ) ) street.push( person );
		const knots = ( pool ) => pool.map( ( person ) => ( { person, around: pool.filter( ( other ) => near( person, other ) < 9 ) } ) )
			.sort( ( a, b ) => b.around.length - a.around.length )[ 0 ];
		const walking = knots( street );
		const knot = walking && walking.around.length >= 6 ? walking : knots( people );
		const centre = [ 0, 1, 2 ].map( ( axis ) => knot.around.reduce( ( sum, person ) => sum + person.position[ axis ], 0 ) / knot.around.length );
		// Stood where most of them face, so faces and fronts show.
		let fx = 0, fz = 0;
		for ( const person of knot.around ) {

			const heading = await probe( `game.crowd.members.get(${JSON.stringify( person.id )})?.heading ?? 0` );
			fx += Math.sin( heading );
			fz += Math.cos( heading );

		}
		const facing = Math.atan2( fx, fz );
		// Inside a building, the player stands inside it too.
		const parcel = await probe( `game.crowd.members.get(${JSON.stringify( knot.person.id )})?.parcelId ?? null` );
		const shots = [];
		const stands = [];
		for ( const [ name, distances ] of [ [ 'crowd-wide', [ 7, 9, 5 ] ], [ 'crowd-near', [ 3.5, 4.5, 2.5 ] ] ] ) {

			let stood = null;
			for ( const d of distances ) for ( const turn of [ 0, 0.4, - 0.4, 0.8, - 0.8, 1.2, - 1.2, 1.6, - 1.6, 2.2, - 2.2, 3.1 ] ) {

				if ( stood ) break;
				const a = facing + turn;
				const spot = { x: centre[ 0 ] + Math.sin( a ) * d, y: centre[ 1 ] + 0.05, z: centre[ 2 ] + Math.cos( a ) * d };
				const target = { x: centre[ 0 ], y: centre[ 1 ] + 1.1, z: centre[ 2 ] };
				if ( parcel && ! await probe( `game.crowd.places.get(${JSON.stringify( parcel )})?.contains?.(${JSON.stringify( spot )}) ?? true` ) ) continue;
				if ( await probe( `game.placePlayer(${JSON.stringify( spot )}, ${JSON.stringify( target )})` ) ) stood = { spot, d, a };

			}
			stands.push( stood );
			if ( ! stood ) continue;
			await sleep( 9000 );
			shots.push( await shot( name ) );

		}
		const looks = people.map( ( person ) => person.look );
		const builds = [];
		for ( const person of people ) builds.push( await probe( `game.crowd.members.get(${JSON.stringify( person.id )})?.look?.builds ?? null` ) );
		const distinct = ( pick ) => new Set( looks.map( ( look ) => JSON.stringify( pick( look ) ) ) ).size;
		const variety = {
			people: looks.length,
			bodies: distinct( ( look ) => look.body ),
			heights: distinct( ( look ) => look.height ),
			tops: distinct( ( look ) => look.shirt ),
			trousers: distinct( ( look ) => look.trousers ),
			garments: distinct( ( look ) => look.garments ),
			hairstyles: distinct( ( look ) => look.hairStyle ),
			builds: new Set( builds.map( ( build ) => JSON.stringify( build && Object.values( build ).map( ( amount ) => Math.round( amount * 50 ) ) ) ) ).size
		};
		return {
			checks: [ check( 'the player stands before the knot', stands.some( Boolean ), { centre, around: knot.around.length } ) ],
			shots, data: { variety, centre, street: street.length, around: knot.around.map( ( person ) => person.id ), looks, builds }
		};

	},

	/**
	 * The conversation and pause screens as a player meets them: the main
	 * story's first person when it opens with a talk, else the nearest person;
	 * Escape in that conversation, N with the pointer free, then Escape on the
	 * street, then Resume. The probe holds the pointer lock a headless browser
	 * never grants, so it stands in for the browser: the chat's release, the
	 * street's Escape and the lock Resume asks for.
	 */
	async ui( { probe, shot } ) {

		const quest = await probe( 'quest()' );
		const first = quest?.objective?.kind === 'talk' ? { questId: quest.questId, stepId: quest.objective.stepId, timeoutMs: STEP_MS } : null;
		const ready = first && await probe( `ready(${JSON.stringify( first )})`, STEP_MS * 2 + PAGE_MS );
		const reached = ready?.available && await probe( `reach(${JSON.stringify( first )})`, STEP_MS * 2 + PAGE_MS );
		const conversation = reached?.offered ? ( await probe( 'press()' ) ).conversation : await probe( 'converse()' );
		const checks = [ check( 'a conversation is open', Boolean( conversation ), { story: first, reached } ) ];
		if ( ! conversation ) return { checks };

		const { chat } = await probe( 'state()' );
		const layoutBefore = await talkLayout( probe );
		await sleep( 350 );
		const subtitle = ( await probe( 'state()' ) ).chat.subtitle;
		const layoutDuring = await talkLayout( probe );
		const shots = [ await shot( 'ui-chat-typing' ) ];
		if ( chat.subtitle.whole ) checks.push(
			check( 'the opening speech grows progressively', grew( chat.subtitle, subtitle ), { before: chat.subtitle, after: subtitle } ),
			check( 'the speaker layout reserves speech space and replies do not cover it', clearSpeech( layoutBefore ) && clearSpeech( layoutDuring ) && Math.abs( layoutBefore.speaker.top - layoutDuring.speaker.top ) < 1 && Math.abs( layoutBefore.speech.height - layoutDuring.speech.height ) < 1, { before: layoutBefore, after: layoutDuring } )
		);
		const opening = await currentOpening( probe );
		const header = await probe( 'game.view.dialog.element.querySelector( \'#conversation-name\' ).textContent' );
		const story = reached?.offered ? {
			stake: await probe( 'game.view.dialog.story.querySelector( \'.chat-quest-stake\' )?.textContent ?? null' ),
			marked: await probe( 'game.view.dialog.choices.querySelectorAll( \'.chat-choice-commits\' ).length' ),
			commits: quest.active.find( ( step ) => step.stepId === first.stepId )?.choices?.filter( ( choice ) => choice.completesStep ).length ?? 0
		} : null;
		await probe( 'game.view.dialog.said.click()' );
		const completed = ( await probe( 'state()' ) ).chat.subtitle;
		shots.push( await shot( 'ui-chat' ) );
		checks.push( check( 'the subtitle contains speech and click completes its reveal', completed.text === subtitle.whole && ! completed.revealing && subtitle.whole.startsWith( subtitle.text ), { subtitle, completed } ) );
		if ( chat.hint.available ) {
			checks.push( check( 'conversation context starts folded', ! chat.hint.open && chat.hint.unread, chat.hint ) );
			await probe( `game.view.dialog.element.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'h', bubbles: true } ) )` );
			await sleep( 300 );
			const opened = ( await probe( 'state()' ) ).chat.hint;
			const bounds = await probe( 'game.view.dialog.hint.panel.getBoundingClientRect().toJSON()' );
			const card = {
				visible: ! await probe( 'game.view.dialog.hint.panel.hidden' ), focused: await probe( 'game.view.dialog.hint.close.matches( \':focus\' )' ),
				journal: ! await probe( 'game.view.dialog.hint.journal.hidden' ),
				fits: bounds.left >= 0 && bounds.top >= 0 && bounds.right <= VIEWPORT.width && bounds.bottom <= VIEWPORT.height
			};
			checks.push( check( 'H opens readable context and marks it read', opened.open && ! opened.unread && card.visible && card.focused && card.fits, { opened, card } ) );
			shots.push( await shot( 'ui-chat-hint' ) );
			await probe( `game.view.dialog.hint.close.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape', bubbles: true } ) )` );
			const closed = await probe( 'state()' );
			checks.push( check( 'Escape closes the hint and keeps the conversation open', ! closed.chat.hint.open && closed.chat.open && Boolean( closed.conversation ), closed.chat.hint ) );
			await probe( `game.view.dialog.element.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'h', bubbles: true } ) )` );
			await probe( `game.view.dialog.element.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'h', bubbles: true } ) )` );
			checks.push( check( 'H closes the hint without ending the talk', !( await probe( 'state()' ) ).chat.hint.open && Boolean( ( await probe( 'state()' ) ).conversation ) ) );
		}
		// A question produces another authored line without accepting the story decision.
		const question = reached?.offered && quest.active.find( step => step.stepId === first.stepId )?.choices?.find( choice => ! choice.completesStep && chat.choices.some( shown => ! shown.disabled && shown.text === choice.text ) );
		if ( question ) {
			const answer = await probe( `choose(${JSON.stringify( question.text )})` );
			await sleep( 350 );
			const next = ( await probe( 'state()' ) ).chat.subtitle;
			checks.push( check( 'the next NPC line also types progressively', answer.clicked && grew( answer.chat.subtitle, next ), { before: answer.chat.subtitle, after: next } ) );
			shots.push( await shot( 'ui-chat-next-typing' ) );
			await probe( 'game.view.dialog.choices.querySelector( \'button:not(:disabled)\' ).focus()' );
			const keydown = await probe( `game.view.dialog.choices.querySelector( 'button:not(:disabled)' ).dispatchEvent( new KeyboardEvent( 'keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true } ) )` );
			await probe( `game.view.dialog.choices.querySelector( 'button:not(:disabled)' ).dispatchEvent( new KeyboardEvent( 'keyup', { key: ' ', code: 'Space', bubbles: true, cancelable: true } ) )` );
			const skipped = ( await probe( 'state()' ) ).chat;
			checks.push( check( 'Space completes speech from a focused reply without selecting it', ! keydown && ! skipped.subtitle.revealing && skipped.subtitle.text === next.whole && skipped.lines.length === answer.chat.lines.length, { subtitle: skipped.subtitle, linesBefore: answer.chat.lines.length, linesAfter: skipped.lines.length } ) );
			shots.push( await shot( 'ui-chat-next-complete' ) );
		}
		await probe( 'game.view.dialog.setTalkOpen( true )' );
		await sleep( 300 );
		shots.push( await shot( 'ui-chat-free-talk' ) );
		await probe( 'game.view.dialog.setTalkOpen( false )' );
		await probe( 'game.view.dialog.asks.open = true' );
		shots.push( await shot( 'ui-chat-actions' ) );
		const details = [ await probe( 'game.view.readout.element.hidden' ), await probe( 'game.view.stats.element.hidden' ) ];
		await probe( RELEASE );
		await probe( 'game.view.dialog.input.dispatchEvent( new KeyboardEvent( \'keydown\', { key: \'Escape\', code: \'Escape\', bubbles: true } ) )' );
		await sleep( 500 );
		const escaped = { conversation: ( await probe( 'state()' ) ).conversation, paused: ! await probe( 'game.view.pause.element.hidden' ) };
		shots.push( await shot( 'ui-chat-escape' ) );
		// With the pointer still free after the chat, N brings the pause menu as Escape does.
		await probe( 'game.view.element.dispatchEvent( new KeyboardEvent( \'keydown\', { key: \'n\', code: \'KeyN\', bubbles: true } ) )' );
		await sleep( 500 );
		const menuKey = ! await probe( 'game.view.pause.element.hidden' );
		await probe( GRANT );

		await probe( RELEASE );
		await sleep( 500 );
		const before = await probe( CLOCK );
		const crowd = await probe( 'people()' );
		await sleep( 1500 );
		const after = await probe( CLOCK );
		const moved = ( await probe( 'people()' ) ).filter( ( person ) => {

			const was = crowd.find( ( each ) => each.id === person.id );
			return was && Math.hypot( ...person.position.map( ( value, axis ) => value - was.position[ axis ] ) ) > 0.01;

		} );
		const paused = ! await probe( 'game.view.pause.element.hidden' );
		shots.push( await shot( 'ui-pause' ) );
		await probe( 'game.view.pause.buttons.get( \'resume\' ).click()' );
		await probe( GRANT );
		await sleep( 1000 );
		const resumed = { paused: ! await probe( 'game.view.pause.element.hidden' ), seconds: await probe( CLOCK ) };
		checks.push(
			check( 'the chat names who is talking', header === conversation.name, { header, name: conversation.name } ),
			...( story ? [
				check( 'a story talk keeps its scene in the hint and transcript, then the person speaks', opening.from === 'scene' && opening.next === 'npc' && chat.hint.scene === opening.text, opening ),
				check( 'the hint explains why this conversation matters', Boolean( story.stake ) && ! chat.story?.objective, { story: chat.story, stake: story.stake } ),
				check( 'the reply that moves the story on is marked', story.commits > 0 && story.marked === story.commits, story )
			] : [] ),
			check( 'the developer readouts are off', details.every( Boolean ), { readout: details[ 0 ], stats: details[ 1 ] } ),
			check( 'Escape in a conversation closes it', escaped.conversation === null, escaped ),
			check( 'Escape in a conversation does not pause', ! escaped.paused, escaped ),
			check( 'N with the pointer free pauses', menuKey ),
			check( 'Escape on the street pauses', paused ),
			check( 'the clock stands still while paused', after === before, { before, after } ),
			check( 'the crowd stands still while paused', moved.length === 0, { moved: moved.map( ( person ) => person.id ) } ),
			check( 'Resume plays on', ! resumed.paused && resumed.seconds > after, resumed )
		);

		return { checks, shots, data: { conversation, chat, story, escaped, menuKey, paused: { before, after }, resumed } };

	}

};

async function main() {

	const options = parse( process.argv.slice( 2 ) );
	const url = playUrl( options );
	const played = posix.resolve( '/', url.searchParams.get( 'out' ) ?? '' );
	if ( options.talk === 'live' && played.startsWith( '/out/games/' ) && ! options[ 'throwaway-engine' ] ) {

		fail( `--talk live would leave this probe's lines in ${played}'s dialogue memory, on the engine serving it and in the game's dialogue-memory.json; run it against a throwaway engine with engine/out mounted read-only and pass --throwaway-engine` );

	}
	const out = outputDir( options.out );
	const report = {
		started: new Date().toISOString(), target: options.target, url: url.href, talk: options.talk, scenarios: [],
		talkRequests: [], voiceRequests: [], blocked: [], console: []
	};
	let session = null;
	let signal = null;
	let status = 2;

	process.once( 'exit', () => session?.kill() );
	const stopped = new Promise( ( _, stop ) => {

		for ( const name of [ 'SIGINT', 'SIGTERM', 'SIGHUP' ] ) process.once( name, () => stop( new Error( `stopped by ${signal = name}` ) ) );

	} );

	try {

		session = new Browser( browserPath( options.browser ) );
		status = await Promise.race( [ play( session, url, out, options, report ), stopped ] );

	} catch ( error ) {

		report.error = error.message;
		console.error( `probe: ${error.message}` );
		if ( ! signal ) await session?.page?.screenshot( join( out, 'failed.png' ) ).catch( () => {} );

	} finally {

		report.finished = new Date().toISOString();
		writeFileSync( join( out, 'report.json' ), `${JSON.stringify( report, null, '\t' )}\n` );
		await session?.close();

	}
	console.log( `report: ${join( out, 'report.json' )}` );
	process.exit( signal ? 128 + constants.signals[ signal ] : status );

}

/** Opens the game, waits until it plays and runs each scenario; the exit status, 0 or 1. */
async function play( session, url, out, options, report ) {

	await session.started;
	report.browser = session.version;
	console.log( `probe: ${url.href}` );
	console.log( `output: ${out}` );

	const page = await session.open();
	watch( page, report, options );
	await page.send( 'Page.addScriptToEvaluateOnNewDocument', { source: QUIET_VITE } );
	// A smaller page draws fewer pixels a frame, which software WebGL pays for by the pixel.
	const [ width, height ] = ( options.viewport ?? `${VIEWPORT.width}x${VIEWPORT.height}` ).split( 'x' ).map( Number );
	await page.send( 'Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false } );
	await page.navigate( url.href );
	report.ready = await playable( page, options.timeout );
	console.log( `playable in ${report.ready.seconds} s: ${report.ready.state.backend} ${report.ready.state.tier}, ${report.ready.state.crowd} people` );

	const context = {
		options, talk: report.talkRequests, voice: report.voiceRequests,
		shot: async ( name ) => {

			await page.screenshot( join( out, `${name}.png` ) );
			return `${name}.png`;

		}
	};
	let status = 0;
	for ( const name of options.scenarios ) {

		const started = Date.now();
		const trace = [];
		const result = await SCENARIOS[ name ]( { ...context, probe: prober( page, trace ) } ).catch( ( error ) => ( { error: error.message, trace } ) );
		const outcome = result.error ? 'error' : result.skipped ? 'skip' : result.checks?.length && result.checks.every( ( item ) => item.ok ) ? 'pass' : 'fail';
		if ( outcome === 'error' || outcome === 'fail' ) status = 1;
		report.scenarios.push( { name, status: outcome, seconds: ( Date.now() - started ) / 1000, ...result } );
		console.log( `${name}: ${outcome}${result.error || result.skipped ? ` (${result.error ?? result.skipped})` : ''}` );
		for ( const item of result.checks ?? [] ) if ( ! item.ok ) console.log( `  failed: ${item.name} ${JSON.stringify( item.detail ?? {} )}` );

	}

	return status;

}

function parse( argv ) {

	const { values, positionals } = parseArgs( { args: argv, allowPositionals: true, options: {
		out: { type: 'string' }, base: { type: 'string', default: 'http://localhost:5306' },
		browser: { type: 'string' }, backend: { type: 'string', default: 'webgl' },
		talk: { type: 'string', default: 'stub' }, 'throwaway-engine': { type: 'boolean', default: false }, building: { type: 'string' }, viewport: { type: 'string' },
		line: { type: 'string', default: 'Hi. What do you do around here?' }, scene: { type: 'string' },
		'advance-to': { type: 'string' }, quest: { type: 'string' }, shots: { type: 'string' },
		crowd: { type: 'string', default: '120' }, timeout: { type: 'string', default: '600' }
	} } );
	const [ target, ...named ] = positionals;
	const scenarios = named.length ? named : [ 'talk', 'chat' ];
	const unknown = scenarios.filter( ( name ) => ! Object.hasOwn( SCENARIOS, name ) );
	const problems = [
		! target && 'name a world id or a play URL',
		unknown.length && `unknown scenario ${unknown.join( ', ' )}; known: ${Object.keys( SCENARIOS ).join( ', ' )}`,
		! [ 'webgpu', 'webgl' ].includes( values.backend ) && '--backend is webgl or webgpu',
		! [ 'stub', 'live', 'none' ].includes( values.talk ) && '--talk is stub, live or none',
		! /^\d+$/.test( values.crowd ) && '--crowd is a whole number',
		values.viewport !== undefined && ! /^\d{3,4}x\d{3,4}$/.test( values.viewport ) && '--viewport is <width>x<height>',
		! /^\d+$/.test( values.timeout ) && '--timeout is whole seconds'
	].filter( Boolean );
	if ( problems.length ) {

		console.error( `play-probe: ${problems.join( '; ' )}\nusage: node compose/play-probe.mjs <world id | play url> [talk] [chat] [spawn] [voice] [follow] [lead] [scene] [story] [ui] [look] [crowd] [access] [--out dir] [--base url] [--browser path] [--backend webgl|webgpu] [--talk stub|live|none] [--throwaway-engine] [--building parcel] [--viewport WxH] [--line text] [--scene id] [--advance-to step] [--quest id] [--shots file.json] [--crowd n] [--timeout seconds]` );
		process.exit( 2 );

	}

	return { ...values, target, scenarios, crowd: Number( values.crowd ), timeout: Number( values.timeout ) };

}

/** The read-only preview to open: never a catalog session, always with the probe. */
function playUrl( { target, base, crowd, backend, scenarios } ) {

	let url;
	if ( /^https?:\/\//.test( target ) ) url = new URL( target );
	else if ( WORLD_ID.test( target ) ) url = new URL( `/?out=${encodeURIComponent( `/out/games/${target}` )}`, base );
	else fail( `not a world id or play URL: ${target}` );
	const query = url.searchParams;
	const game = query.get( 'game' );
	if ( game ) {

		query.delete( 'game' );
		query.set( 'out', `/out/games/${game}` );

	}
	query.set( 'mode', 'game' );
	query.set( 'automation', '1' );
	if ( ! query.has( 'crowd' ) ) query.set( 'crowd', String( crowd ) );
	if ( ! scenarios.includes( 'voice' ) && ! query.has( 'voice' ) ) query.set( 'voice', 'off' );
	// The ui scenario sees the screen as a player does, without the developer readouts.
	if ( scenarios.includes( 'ui' ) && ! query.has( 'details' ) ) query.set( 'details', 'off' );
	if ( backend === 'webgl' && ! query.has( 'backend' ) ) {

		query.set( 'backend', 'webgl' );
		if ( ! query.has( 'quality' ) ) query.set( 'quality', 'low' );

	}

	return url;

}

function outputDir( requested ) {

	const dir = resolve( requested ?? join( tmpdir(), 'urbe-play-probe', new Date().toISOString().replace( /[:.]/g, '-' ) ) );
	const within = relative( CHECKOUT, dir );
	if ( within === '' || ( within !== '..' && ! within.startsWith( `..${sep}` ) && ! isAbsolute( within ) ) ) {

		fail( `${dir} is inside the checkout; choose an output directory outside it` );

	}
	mkdirSync( dir, { recursive: true } );

	return dir;

}

/**
 * Screens every request: GET and HEAD pass, a talk line is stubbed (or let
 * through when `talk` is live), NPC speech passes while the voice scenario
 * runs, anything else is refused. Records refused requests, talk and voice
 * requests, console warnings, page errors and failed responses into `report`.
 */
function watch( page, report, { talk, scenarios } ) {

	const at = () => ( Date.now() - Date.parse( report.started ) ) / 1000;
	const log = ( entry ) => { if ( report.console.length < 300 ) report.console.push( { at: at(), ...entry } ); };
	const speaks = scenarios.includes( 'voice' );
	/** Talk and voice requests let through, awaiting their response, by network id. */
	const live = new Map();
	page.on( 'Runtime.consoleAPICalled', ( { type, args } ) => {

		if ( [ 'error', 'warning', 'assert' ].includes( type ) ) log( { type, text: args.map( ( arg ) => arg.value ?? arg.description ?? '' ).join( ' ' ).slice( 0, 600 ) } );

	} );
	page.on( 'Runtime.exceptionThrown', ( { exceptionDetails } ) => log( {
		type: 'exception', text: String( exceptionDetails.exception?.description ?? exceptionDetails.text ).slice( 0, 600 )
	} ) );
	page.on( 'Network.responseReceived', ( { requestId, response } ) => {

		const entry = live.get( requestId );
		if ( entry ) Object.assign( entry, { status: response.status, type: response.mimeType } );
		if ( response.status >= 400 ) log( { type: 'http', text: `${response.status} ${response.url}` } );

	} );
	// A body streams on after its response starts: the bytes received, and whether it ended or broke off.
	page.on( 'Network.loadingFinished', ( { requestId, encodedDataLength } ) => {

		const entry = live.get( requestId );
		if ( entry ) Object.assign( entry, { bytes: encodedDataLength, finished: at() } );
		live.delete( requestId );

	} );
	page.on( 'Network.loadingFailed', ( { requestId, errorText, canceled } ) => {

		const entry = live.get( requestId );
		if ( entry ) Object.assign( entry, { error: canceled ? 'canceled' : errorText, finished: at() } );
		live.delete( requestId );

	} );
	page.on( 'Fetch.requestPaused', ( { requestId, networkId, request } ) => {

		const { method } = request;
		const path = new URL( request.url ).pathname;
		if ( method === 'POST' && path === TALK_PATH ) {

			const entry = { at: at(), path, ...talkRequest( request ) };
			report.talkRequests.push( entry );
			if ( talk === 'live' ) {

				live.set( networkId, entry );
				return page.send( 'Fetch.continueRequest', { requestId } );

			}
			if ( talk === 'none' ) {

				// No model answers: people decide what they are asked by their disposition.
				Object.assign( entry, { status: 502, stubbed: true } );
				return page.send( 'Fetch.fulfillRequest', { requestId, responseCode: 502, ...TALK_NONE } );

			}
			Object.assign( entry, { status: 200, stubbed: true } );
			return page.send( 'Fetch.fulfillRequest', { requestId, responseCode: 200, ...TALK_STUB } );

		}
		if ( speaks && ( method === 'POST' && VOICE_PATHS.has( path ) || method === 'DELETE' && path.startsWith( VOICE_CANCEL ) ) ) {

			const entry = { at: at(), path };
			report.voiceRequests.push( entry );
			live.set( networkId, entry );
			return page.send( 'Fetch.continueRequest', { requestId } );

		}
		if ( method === 'GET' || method === 'HEAD' ) return page.send( 'Fetch.continueRequest', { requestId } );
		report.blocked.push( { at: at(), request: `${method} ${path}` } );
		return page.send( 'Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' } );

	} );

}

/**
 * A scenario's calls on the page's automation probe: each answers within
 * `ms` or throws naming the call, and goes into `trace` with its seconds and
 * the page's answer or the failure.
 */
function prober( page, trace ) {

	return async ( call, ms = PAGE_MS ) => {

		const entry = { call };
		trace.push( entry );
		const started = Date.now();
		try {

			return entry.value = await page.evaluate( `window.urbe.automation.${call}`, ms );

		} catch ( error ) {

			entry.error = error.message;
			throw new Error( `${call}: ${error.message}` );

		} finally {

			entry.seconds = ( Date.now() - started ) / 1000;

		}

	};

}

/** A reveal must begin incomplete and add characters without changing the complete line. */
function grew( before, after ) {

	return before.revealing && before.text.length < before.whole.length && before.whole === after.whole &&
		after.text.length > before.text.length && after.whole.startsWith( after.text );

}

/** The reserved speech and speaker layout, outside the badge's finite entrance transform. */
async function talkLayout( probe ) {

	return {
		speech: await probe( 'game.view.dialog.said.getBoundingClientRect().toJSON()' ),
		options: await probe( 'game.view.dialog.choices.parentElement.getBoundingClientRect().toJSON()' ),
		speaker: await probe( 'game.view.dialog.badge.parentElement.getBoundingClientRect().toJSON()' )
	};

}

function clearSpeech( { speech, options } ) {

	return options.width === 0 || speech.right <= options.left || speech.left >= options.right || speech.bottom <= options.top || speech.top >= options.bottom;

}

/** The current talk's opening, after any recalled lines the transcript keeps above it. */
async function currentOpening( probe ) {

	const first = "game.view.dialog.transcript.querySelector( '.chat-line:not(.is-earlier)' )";
	return {
		from: await probe( `${first}?.className.match( /\\bis-(\\w+)/ )?.[ 1 ] ?? null` ),
		text: await probe( `${first}?.lastElementChild?.textContent ?? ''` ),
		next: await probe( `${first}?.nextElementSibling?.className.match( /\\bis-(\\w+)/ )?.[ 1 ] ?? null` )
	};

}

/** A fulfilled response's headers and base64 body. */
function stub( type, body ) {

	return { responseHeaders: [ { name: 'Content-Type', value: type } ], body: Buffer.from( body ).toString( 'base64' ) };

}

/** What one talk request carried: the line, the person, which fields describe them, and any place they led the player to and offers they may make. */
function talkRequest( request ) {

	const text = request.postData ?? ( request.postDataEntries ?? [] ).map( ( entry ) => Buffer.from( entry.bytes ?? '', 'base64' ).toString() ).join( '' );
	try {

		const { line, npc, behavior, guide, offers } = JSON.parse( text );
		return {
			line, npcId: npc?.npcId ?? null, npcFields: Object.keys( npc ?? {} ).sort(), behavior: behavior?.mode ?? null,
			...( guide ? { guide } : {} ), ...( offers ? { offers } : {} )
		};

	} catch {

		return { unreadable: text.slice( 0, 200 ) };

	}

}

/** How long a loaded game may take to install its automation probe: software WebGL draws its first frames slowly. */
const AUTOMATION_GRACE_MS = 90000;

/** Waits for the probe to answer on a drawn city, printing the loading steps. */
async function playable( page, timeoutSeconds ) {

	const started = Date.now();
	let step = '';
	let loadedAt = null;
	while ( Date.now() - started < timeoutSeconds * 1000 ) {

		const now = await page.evaluate( READINESS ).catch( () => null );
		const seconds = Math.round( ( Date.now() - started ) / 1000 );
		if ( now?.error ) throw new Error( `the game could not start: ${now.error.slice( 0, 600 )}` );
		if ( now?.probe && now.draws > 20 ) return { seconds, state: await page.evaluate( 'window.urbe.automation.state()' ) };
		if ( now?.loaded && ! now.probe && ( loadedAt ??= Date.now() ) < Date.now() - AUTOMATION_GRACE_MS ) {

			throw new Error( 'the game plays but answers no automation probe; restart Engine so it serves the current source' );

		}
		if ( now?.step && now.step !== step ) console.log( `[${seconds} s] ${step = now.step}` );
		await sleep( 1000 );

	}
	throw new Error( `the game was not playable within ${timeoutSeconds} s (last step: ${step || 'none'})` );

}

function check( name, ok, detail ) {

	return { name, ok, ...( detail === undefined ? {} : { detail } ) };

}

/** Each field of `fields` in which `actual` does not repeat `expected`, with both values. */
function differences( expected, actual, fields ) {

	return Object.fromEntries( fields.filter( ( field ) => expected[ field ] !== actual[ field ] )
		.map( ( field ) => [ field, { expected: expected[ field ] ?? null, actual: actual[ field ] ?? null } ] ) );

}

/** A check that holds for every talk, `compare` giving its [expected, actual, fields]; the detail names each person and field that differs. */
function each( name, talks, compare ) {

	const detail = Object.fromEntries( talks
		.map( ( talked ) => [ talked.id, differences( ...compare( talked ) ) ] )
		.filter( ( [ , fields ] ) => Object.keys( fields ).length ) );

	return check( name, Object.keys( detail ).length === 0, detail );

}

/**
 * Trails the companion `npcId` (`trail`, riding a lift with them) until they
 * have arrived and their talk opens, then reads what the companion signalled
 * meanwhile (`COMPANION_SIGNALS` installed first): the notices the player
 * read, whether the leader rode a lift with the player and climbed or fell a
 * storey or more, and whether they arrived within a step of their place.
 */
async function trailHome( probe, npcId ) {

	const started = await until( () => probe( 'companion()' ), ( current ) => current?.npcId === npcId && current.mode !== null, 60000 );
	const trailed = started?.npcId === npcId ? await probe( `trail(${JSON.stringify( npcId )}, { timeoutMs: ${ACCESS_LEAD_MS} })`, ACCESS_LEAD_MS + PAGE_MS ) : null;
	const heard = await probe( 'game.companion.heard.splice( 0 )' );
	const samples = trailed?.samples ?? [];
	const heights = samples.map( ( sample ) => sample.y );
	const companion = trailed?.companion ?? null;
	return {
		started, companion, heard, samples: samples.length,
		notices: heard.filter( ( signal ) => signal.notice ).map( ( signal ) => signal.notice ),
		heights: heights.length ? [ Math.min( ...heights ), Math.max( ...heights ) ] : null,
		rode: samples.some( ( sample ) => sample.lift && sample.playerLift === sample.lift ) && heights.length > 0 && Math.max( ...heights ) - Math.min( ...heights ) > 2.5,
		arrived: [ 'arrived', 'ready', 'talking' ].includes( companion?.phase ) || ( companion?.walk === 'arrived' && ( companion.destination?.distance ?? 1e9 ) <= 0.6 ) || heard.some( ( signal ) => signal.kind === 'arrival' ),
		conversation: trailed?.conversation ?? null
	};

}

/**
 * Opens a conversation with each of the nearest people in turn until one
 * agrees to the offer `choose` picks from what they offer, chosen from the
 * chat's actions. `{ companion, offer, tried }`, companion null when nobody came.
 */
async function askAlong( probe, choose ) {

	// A conversation an earlier scenario left open owns E.
	if ( ( await probe( 'state()' ) ).conversation ) await probe( 'leave()' );
	const tried = [];
	for ( const person of await probe( `people({ limit: ${ASKED} })` ) ) {

		const conversation = await probe( `converse(${JSON.stringify( person.id )}, { attempts: 1 })` );
		if ( ! conversation ) continue;
		const offers = conversation.npcId ? await probe( 'offers()' ) : [];
		const offer = choose( offers );
		tried.push( { id: person.id, npcId: conversation.npcId, offers: offers.map( ( item ) => ( { label: item.label, reason: item.reason, distance: item.distance } ) ), chose: offer?.label ?? null } );
		const acted = offer ? await probe( `act(${JSON.stringify( offer.offerId )})` ) : null;
		// Refused, the person says why and the chat stays open.
		if ( ! acted || acted.conversation ) {

			await probe( 'leave()' );
			continue;

		}
		const companion = await until( () => probe( 'companion()' ), ( current ) => current?.npcId === conversation.npcId && current.mode !== null, 5000 );
		if ( companion?.npcId === conversation.npcId ) return { companion, offer, tried };

	}

	return { companion: null, tried };

}

/** Talks to the companion `npcId` again and lets them go with 'You can go now'. */
async function dismiss( probe, npcId ) {

	const id = ( await probe( `person(${JSON.stringify( npcId )})` ) )?.id ?? null;
	const conversation = id ? await probe( `converse(${JSON.stringify( id )})` ) : null;
	const acted = conversation ? await probe( 'act("dismiss")' ) : null;
	const companion = await until( () => probe( 'companion()' ), ( current ) => current === null, 5000 );
	const person = await until( () => probe( `person(${JSON.stringify( npcId )})` ), ( held ) => BACK_TO_DAY.includes( held?.mode ), 5000 );
	const feet = await walkOff( probe, person?.id );

	return { conversation, acted, companion, person, feet };

}

/** Where crowd member `id`'s feet stand while they walk off, sampled a few times over WALK_OFF_MS: their `footing`s, without the ones they are gone for. */
async function walkOff( probe, id ) {

	const samples = [];
	for ( let sample = 0; id && sample < 4; sample ++ ) {

		await sleep( WALK_OFF_MS / 4 );
		const footing = await footingOf( probe, id );
		if ( footing ) samples.push( footing );

	}
	return samples;

}

/** Where crowd member `id`'s feet stand against the ground, or null without such a member. */
async function footingOf( probe, id ) {

	return id ? probe( `footing(${JSON.stringify( id )})` ) : null;

}

/**
 * A check that each named person's feet were measured at least once and that
 * every standing sample is within FOOTING of the ground under them. A seated
 * sample sits on its seat and is only counted; a person with no sample at all
 * (gone, never found) fails, since nothing was learnt about their feet.
 */
function grounded( name, people ) {

	const measured = people.map( ( [ id, samples ] ) => [ id ?? null, ( samples ?? [] ).filter( Boolean ) ] );
	const unmeasured = measured.filter( ( [ , samples ] ) => ! samples.length ).map( ( [ id ] ) => id );
	const standing = measured.flatMap( ( [ id, samples ] ) => samples.filter( ( footing ) => ! footing.seated ).map( ( footing ) => ( { id, ...footing } ) ) );
	const seated = measured.reduce( ( count, [ , samples ] ) => count + samples.filter( ( footing ) => footing.seated ).length, 0 );
	const off = standing.filter( ( footing ) => footing.gap === null || Math.abs( footing.gap ) > FOOTING )
		.map( ( { id, feet, ground, gap } ) => ( { id, feet, ground, gap } ) );

	return check( name, off.length === 0 && unmeasured.length === 0, { off, unmeasured, standing: standing.length, seated } );

}

/**
 * Stands the player at the edge of a staged scene, waits for it to stand,
 * screenshots it and checks that it stands and every element shows.
 */
async function visitScene( probe, shot, scene ) {

	const visit = await probe( `visitScene(${JSON.stringify( scene.sceneId )}, { timeoutMs: ${SCENE_WAIT_MS} })`, SCENE_WAIT_MS + PAGE_MS );
	await sleep( 800 );
	const missing = scene.elements.filter( ( entityId ) => ! visit.shown.includes( entityId ) );

	return {
		sceneId: scene.sceneId, place: scene.place, ...visit,
		shot: await shot( `scene-${scene.sceneId.replace( /[^\w.-]+/g, '_' )}` ),
		checks: [
			check( `the player stands at the edge of ${scene.sceneId}`, visit.placed, { status: scene.status, frame: scene.frame } ),
			check( `${scene.sceneId} stands around the player`, visit.standing, { ms: visit.ms } ),
			check( `every element of ${scene.sceneId} shows`, visit.standing && missing.length === 0, { elements: scene.elements, missing } ),
			...( scene.evidence === null ? [] : [ check( `the evidence of ${scene.sceneId} stands with it`, scene.evidence === 'staged', { evidence: scene.evidence } ) ] )
		]
	};

}

/**
 * Plays the objective step of `quest`: checks its place and people, opens it,
 * does it on the player's own path and, when that leaves it open, completes it
 * with the fast-forward. The step's record; `via` is `player`, `advance` or
 * null, and `failed` names each failed check.
 */
async function playStep( probe, questId, quest ) {

	const { objective } = quest;
	const step = quest.active.find( ( active ) => active.stepId === objective.stepId );
	const { place, route } = objective;
	const record = { stepId: step.stepId, kind: step.kind, text: step.text, place, venue: objective.venue, route, cast: step.cast, checks: [] };
	const started = Date.now();
	record.checks.push(
		check( 'the objective names a place the world has', Boolean( place?.exists ), { place } ),
		check( 'the walk graph reaches it', place?.kind === 'district' ? route.reason === 'district-area' : route.metres !== null, route ),
		check( 'its people are alive', step.cast.every( ( person ) => ! person.dead ), step.cast )
	);
	if ( step.kind === 'goto' ) record.checks.push( check( 'the place has an open interior to arrive in', place?.interior === true, { place } ) );
	if ( ( await probe( 'state()' ) ).conversation ) await probe( 'leave()' );

	const on = { questId, stepId: step.stepId, timeoutMs: STEP_MS };
	try {

		record.ready = await probe( `ready(${JSON.stringify( on )})`, STEP_MS * 2 + PAGE_MS );
		record.checks.push( check( 'the step opens', record.ready.available, record.ready ) );
		if ( record.ready.available ) record.played = await ( PLAY[ step.kind ] ?? PLAY.press )( { probe, on, step, record } );

	} catch ( error ) {

		record.checks.push( check( 'the player\'s path runs', false, { error: error.message } ) );

	}
	if ( ( await probe( 'state()' ) ).conversation ) await probe( 'leave()' );
	const now = await probe( `quest(${JSON.stringify( questId )})` );
	record.via = now.completed.includes( step.stepId ) ? 'player' : null;
	if ( ! record.via ) {

		record.advanced = await probe( `advance(${JSON.stringify( { questId, steps: 1, timeoutMs: STEP_MS } )})`, STEP_MS * 3 + PAGE_MS );
		const [ outcome ] = record.advanced.completed;
		if ( outcome?.stepId === step.stepId && outcome.ok ) record.via = 'advance';
		record.checks.push( check( 'the fast-forward completes it', record.via === 'advance', outcome ?? { stopped: record.advanced.stopped } ) );

	}
	record.seconds = ( Date.now() - started ) / 1000;
	record.failed = record.checks.filter( ( item ) => ! item.ok ).map( ( item ) => item.name );

	return record;

}

/** How the player does each kind of story step: each pushes its checks onto `record` and returns what it saw. */
const PLAY = {

	/** Stands before the person, opens the talk with E, sees the story topic and its replies, and commits the reply that completes it. */
	async talk( { probe, on, step, record } ) {

		const reached = await probe( `reach(${JSON.stringify( on )})`, STEP_MS * 2 + PAGE_MS );
		const { conversation } = reached.offered ? await probe( 'press()' ) : { conversation: null };
		const { chat } = await probe( 'state()' );
		const opening = await currentOpening( probe );
		const commit = step.choices?.find( ( choice ) => choice.completesStep );
		const chosen = conversation && commit ? await probe( `choose(${JSON.stringify( commit.text )})` ) : null;
		record.checks.push(
			check( 'its person stands there and E reaches them', reached.offered, reached ),
			check( 'E opens a conversation with them', Boolean( conversation ) && conversation.npcId === step.cast[ 0 ]?.npcId, conversation ),
			check( 'the story topic opens on its scene and its replies load', Boolean( chat.story ) && opening.from === 'scene' && chat.choices.some( ( choice ) => choice.text === commit?.text && ! choice.disabled ),
				{ story: chat.story, first: opening, choices: chat.choices, status: chat.status } ),
			check( 'the committing reply is taken', Boolean( chosen?.clicked ), chosen && { status: chosen.chat.status, lines: chosen.chat.lines.slice( - 2 ) } )
		);

		return { reached, conversation, story: chat.story, choices: chat.choices, chosen: chosen && { status: chosen.chat.status } };

	},

	/** Walks in at the door: standing in one of its rooms is arriving. */
	async goto( { probe, step, record } ) {

		const visit = await probe( `visit(${JSON.stringify( step.place )}, { timeoutMs: ${STEP_MS} })`, STEP_MS + PAGE_MS );
		record.checks.push( check( 'the player stands in one of its rooms', visit.room === step.place?.id, visit ) );

		return { visit };

	},

	/**
	 * Starts the escort with E, then walks behind a leader on its path, or
	 * stands at the destination for a follower to come; the escort completes
	 * the step once they are both there.
	 */
	async escort( { probe, on, step, record } ) {

		const reached = await probe( `reach(${JSON.stringify( on )})`, STEP_MS * 2 + PAGE_MS );
		const npcId = step.cast[ 0 ]?.npcId;
		// A player whose E did not start the escort reads why and presses again.
		const presses = [];
		let escort = null;
		for ( let attempt = 0; reached.offered && attempt < 2 && escort?.npcId !== npcId; attempt ++ ) {

			presses.push( await probe( 'press()' ) );
			escort = await until( () => probe( 'companion()' ), ( companion ) => companion?.kind === 'escort', 5000 );

		}
		record.checks.push(
			check( 'its person stands there and E offers the escort', reached.offered, reached ),
			check( 'E starts the escort', escort?.npcId === npcId, { escort, presses } )
		);
		if ( escort?.npcId !== npcId ) return { reached, escort, presses };

		const { objective } = await probe( `quest(${JSON.stringify( on.questId )})` );
		const ms = ( objective.route.metres ?? 0 ) / ESCORT_PACE * 1000 + ESCORT_SLACK_MS;
		const done = ( quest ) => quest.completed.includes( step.stepId );
		let walked;
		// A leader that has arrived waits for the player to step into the place, as a follower does at the door.
		if ( escort.mode === 'leading' ) walked = await probe( `trail(${JSON.stringify( npcId )}, { timeoutMs: ${Math.round( ms )} })`, ms + PAGE_MS );
		const arrived = walked?.companion?.walk === 'arrived';
		if ( ! walked || arrived ) {

			const visit = await probe( `visit(${JSON.stringify( objective.place )})` );
			walked = { ...walked, visit, arrived };
			walked.quest = await until( () => probe( `quest(${JSON.stringify( on.questId )})` ), ( quest ) => done( quest ) || ! quest.objective, arrived ? 10000 : ms );

		}
		const after = await until( () => probe( `quest(${JSON.stringify( on.questId )})` ), done, 5000 );
		const last = await probe( 'companion()' );
		record.checks.push( check( 'the escort arrives and completes the step', done( after ), {
			destination: objective.place, metres: objective.route.metres, mode: escort.mode, companion: last,
			samples: walked.samples?.slice( - 3 ), ms: walked.ms, visit: walked.visit
		} ) );

		return { reached, escort, presses: presses.length, destination: objective.place, walked: { ...walked, samples: walked.samples?.length, quest: undefined } };

	},

	/** Stands where E does the step and presses E. */
	async press( { probe, on, record } ) {

		const reached = await probe( `reach(${JSON.stringify( on )})`, STEP_MS * 2 + PAGE_MS );
		const pressed = reached.offered ? await probe( 'press()' ) : null;
		record.checks.push( check( 'E offers the step where it happens', reached.offered, reached ) );

		return { reached, pressed };

	}

};

/** The companion every half second until `done` holds for it or `milliseconds` pass. */
async function companionUntil( probe, done, milliseconds ) {

	const samples = [];
	const started = Date.now();
	do {

		samples.push( await probe( 'companion()' ) );
		if ( done( samples.at( - 1 ) ) ) break;
		await sleep( 500 );

	} while ( Date.now() - started < milliseconds );

	return samples;

}

/** `read()` every quarter second until `done` holds for its value or `milliseconds` pass; the last value. */
async function until( read, done, milliseconds ) {

	const started = Date.now();
	let value = await read();
	while ( ! done( value ) && Date.now() - started < milliseconds ) {

		await sleep( 250 );
		value = await read();

	}

	return value;

}

function sleep( milliseconds ) {

	return new Promise( ( done ) => setTimeout( done, milliseconds ) );

}

/** `promise`, or a rejection once `milliseconds` pass first. */
function within( promise, milliseconds ) {

	let timer;
	const late = new Promise( ( _, failed ) => { timer = setTimeout( () => failed( new Error( `no answer within ${milliseconds / 1000} s` ) ), milliseconds ); } );

	return Promise.race( [ promise, late ] ).finally( () => clearTimeout( timer ) );

}

function fail( message ) {

	console.error( `play-probe: ${message}` );
	process.exit( 2 );

}

function browserPath( requested ) {

	const named = requested ?? process.env.URBE_BROWSER;
	const onPath = ( name ) => ( process.env.PATH ?? '' ).split( delimiter ).map( ( dir ) => join( dir, name ) ).find( existsSync );
	const found = named ? ( existsSync( named ) ? named : onPath( named ) ) : BROWSERS.map( ( name ) => name.includes( '/' ) ? ( existsSync( name ) ? name : null ) : onPath( name ) ).find( Boolean );
	if ( ! found ) throw new Error( named ? `no browser at ${named}` : 'no Chromium-family browser found; pass --browser or set URBE_BROWSER' );

	return found;

}

/** One headless browser on a throwaway profile, driven over its DevTools pipe. */
class Browser {

	constructor( binary ) {

		this.profile = mkdtempSync( join( tmpdir(), 'urbe-play-probe-profile-' ) );
		// Its own process group, so closing takes every helper process with it.
		this.child = spawn( binary, [ ...FLAGS, `--user-data-dir=${this.profile}`, 'about:blank' ], {
			detached: true, stdio: [ 'ignore', 'ignore', 'pipe', 'pipe', 'pipe' ]
		} );
		this.cdp = new Cdp( this.child.stdio[ 3 ], this.child.stdio[ 4 ] );
		this.page = null;
		let tail = '';
		this.child.stderr.on( 'data', ( chunk ) => { tail = ( tail + chunk ).slice( - 2000 ); } );
		this.child.on( 'error', ( error ) => { tail += error.message; } );
		/** Settles once the browser answers, with `version` set. */
		this.started = within( this.cdp.send( 'Browser.getVersion' ), BROWSER_START_MS ).then(
			( { product } ) => { this.version = product; },
			( error ) => { throw new Error( `${binary} did not start: ${error.message}${tail && `\n${tail.trim()}`}` ); }
		);

	}

	/** A new tab with its runtime, page, network and request screening attached. */
	async open() {

		const { targetId } = await this.cdp.send( 'Target.createTarget', { url: 'about:blank' } );
		const { sessionId } = await this.cdp.send( 'Target.attachToTarget', { targetId, flatten: true } );
		const page = this.page = new Page( this.cdp, sessionId );
		await Promise.all( [ 'Runtime.enable', 'Page.enable', 'Network.enable' ].map( ( method ) => page.send( method ) ) );
		await page.send( 'Fetch.enable', { patterns: [ { urlPattern: '*', requestStage: 'Request' } ] } );

		return page;

	}

	async close() {

		const exited = new Promise( ( done ) => this.child.exitCode === null && this.child.signalCode === null ? this.child.once( 'exit', done ) : done() );
		await this.cdp.send( 'Browser.close' ).catch( () => {} );
		await Promise.race( [ exited, sleep( 5000 ) ] );
		this.kill();

	}

	kill() {

		try {

			process.kill( - this.child.pid, 'SIGKILL' );

		} catch {

			// The group already ended.

		}
		try {

			rmSync( this.profile, { recursive: true, force: true, maxRetries: 3 } );

		} catch ( error ) {

			console.error( `play-probe: could not remove ${this.profile}: ${error.message}` );

		}

	}

}

/** One attached tab. */
class Page {

	constructor( cdp, sessionId ) {

		this.cdp = cdp;
		this.sessionId = sessionId;

	}

	send( method, params = {} ) {

		return this.cdp.send( method, params, this.sessionId );

	}

	on( method, listener ) {

		this.cdp.on( method, ( params, sessionId ) => {

			if ( sessionId === this.sessionId ) ( async () => listener( params ) )().catch( ( error ) => console.error( `${method}: ${error.message}` ) );

		} );

	}

	async navigate( url ) {

		const loaded = new Promise( ( done, failed ) => {

			const timer = setTimeout( () => failed( new Error( `${url} did not load within 120 s` ) ), 120000 );
			this.on( 'Page.loadEventFired', () => { clearTimeout( timer ); done(); } );

		} );
		const { errorText } = await this.send( 'Page.navigate', { url } );
		if ( errorText ) throw new Error( `${url}: ${errorText}` );
		await loaded;

	}

	/** The expression's value, once its promise settles within `ms`. */
	async evaluate( expression, ms = PAGE_MS ) {

		const { result, exceptionDetails } = await within( this.send( 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true } ), ms );
		if ( exceptionDetails ) throw new Error( String( exceptionDetails.exception?.description ?? exceptionDetails.text ).split( '\n' )[ 0 ] );

		return result.value;

	}

	async screenshot( path ) {

		const { data } = await within( this.send( 'Page.captureScreenshot', { format: 'png' } ), PAGE_MS );
		writeFileSync( path, Buffer.from( data, 'base64' ) );

	}

}

/** The DevTools protocol over the browser's pipe, one NUL-ended JSON message each way, with flat sessions per tab. */
class Cdp {

	/** `input` is the browser's command pipe, `output` its message pipe. */
	constructor( input, output ) {

		this.input = input;
		this.open = true;
		this.next = 0;
		this.calls = new Map();
		this.listeners = new Map();
		let pending = [];
		output.setEncoding( 'utf8' );
		// A chunk continues the pending message; each NUL ends one and starts the next.
		output.on( 'data', ( chunk ) => {

			const [ more, ...next ] = chunk.split( '\0' );
			pending.push( more );
			for ( const part of next ) {

				this.#receive( JSON.parse( pending.join( '' ) ) );
				pending = [ part ];

			}

		} );
		const closed = () => {

			this.open = false;
			for ( const { failed, method } of this.calls.values() ) failed( new Error( `${method}: the browser closed` ) );
			this.calls.clear();

		};
		output.on( 'close', closed );
		output.on( 'error', closed );
		input.on( 'error', closed );

	}

	send( method, params = {}, sessionId = undefined ) {

		if ( ! this.open ) return Promise.reject( new Error( `${method}: the browser closed` ) );

		return new Promise( ( done, failed ) => {

			const id = ++ this.next;
			this.calls.set( id, { done, failed, method } );
			this.input.write( `${JSON.stringify( { id, method, params, ...( sessionId ? { sessionId } : {} ) } )}\0` );

		} );

	}

	on( method, listener ) {

		this.listeners.set( method, [ ...( this.listeners.get( method ) ?? [] ), listener ] );

	}

	#receive( message ) {

		if ( message.id === undefined ) {

			for ( const listener of this.listeners.get( message.method ) ?? [] ) listener( message.params, message.sessionId );
			return;

		}
		const call = this.calls.get( message.id );
		this.calls.delete( message.id );
		if ( message.error ) call?.failed( new Error( `${call.method}: ${message.error.message}` ) );
		else call?.done( message.result );

	}

}

await main();

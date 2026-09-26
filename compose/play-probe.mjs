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
 * pass, a talk line gets a stand-in reply in the browser, NPC speech reaches
 * /api/voice only while the voice scenario runs, and anything else is refused.
 * Without the voice scenario the page gets `voice=off` unless the URL names
 * it, so the other scenarios put nothing on the voice GPU. The page's Vite
 * socket never opens, so it reports nothing to the dev server.
 *
 * The browser takes its commands on this process's DevTools pipe and quits when
 * the pipe closes, however this process ends. SIGINT, SIGTERM and SIGHUP also
 * write the report and remove the browser's profile first.
 *
 * Scenarios: talk and chat (the default), voice, follow, lead. voice speaks a
 * person's first line and the reply to a chat line through the engine's Voice
 * box and page audio (muted); it needs the Voice box running behind the engine.
 * Options:
 *   --out <dir>          screenshots and report.json; default a new folder under the OS temp dir, never inside this checkout
 *   --base <url>         Engine origin for a world id, default http://localhost:5306
 *   --browser <path>     Chromium-family binary; default URBE_BROWSER, then Brave, Chrome or Chromium on PATH
 *   --backend <mode>     webgl (default, at low quality unless the URL names one) or webgpu; headless WebGPU
 *                        offers an adapter but cannot build the city's pipelines
 *   --talk <mode>        stub (default) answers talk in the browser; live lets the line reach the model, and the
 *                        engine keeps each exchange in that world's dialogue memory until it restarts
 *   --throwaway-engine   the engine serving the URL is a throwaway one nobody plays; --talk live on a game's out
 *                        (/out/games) needs it
 *   --line <text>        the chat scenario's line
 *   --crowd <n>          default 120
 *   --timeout <seconds>  load limit, default 600
 *
 * Exit status: 0 every scenario passed; 1 a check failed, a scenario errored or
 * is not driven yet; 2 the game never became playable; 128 plus the signal's
 * number when a signal stopped the run.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
/** The stand-in answer for each talk endpoint: the whole reply, or the stream's events. */
const TALK_STUBS = {
	'/api/talk': stub( 'application/json', JSON.stringify( { reply: STUB_REPLY } ) ),
	'/api/talk/stream': stub( 'application/x-ndjson', [
		{ type: 'delta', text: STUB_REPLY }, { type: 'sentence', index: 0, text: STUB_REPLY }, { type: 'done', reply: STUB_REPLY }
	].map( ( event ) => `${JSON.stringify( event )}\n` ).join( '' ) )
};
/** NPC speech routes, which pass only while the voice scenario runs. */
const VOICE_PATHS = new Set( [ '/api/voice', '/api/voice/prefetch' ] );
/** How long a line may take to start playing: a render queued behind another on a busy GPU. */
const VOICE_WAIT_MS = 120000;
/** The look fields the crowd bakes and the focused body is dressed with: body is the crowd variant's mesh. */
const LOOK = [ 'body', 'hairStyle', 'skin', 'shirt', 'trousers', 'hair', 'eyebrows', 'sleeve', 'hem' ];
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

			talked.during = await probe( 'appearance()' );
			if ( shots.length === 1 ) {

				await sleep( 800 );
				shots.push( await shot( 'talk-conversation' ) );
				const { feet } = await probe( 'state()' );
				apart = Math.round( Math.hypot( ...feet.map( ( value, axis ) => value - approached.person.position[ axis ] ) ) * 100 ) / 100;

			}
			await probe( 'leave()' );
			talked.after = await probe( `appearance(${JSON.stringify( { id: conversation.person } )})` );

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
				( talked ) => [ talked.after.crowd, talked.after.hero, LOOK ] )
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
		const said = await probe( `say(${JSON.stringify( options.line )})` );
		const requests = talk.slice( sent );
		checks.push(
			check( 'the line reaches /api/talk', requests.length > 0, requests[ 0 ] ),
			check( 'a reply shows', Boolean( said.reply ) && ( options.talk === 'live' || said.reply === STUB_REPLY ), { reply: said.reply } ),
			check( 'the chat shows no error', ! said.error, { status: said.status } )
		);

		return { checks, shots: [ await shot( 'chat' ) ], data: { conversation, said, requests } };

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

		const greeting = await probe( `voice({ played: 1, timeoutMs: ${VOICE_WAIT_MS} })` );
		const said = await probe( `say(${JSON.stringify( options.line )})` );
		const reply = await probe( `voice({ played: ${( greeting?.played ?? 0 ) + 1}, timeoutMs: ${VOICE_WAIT_MS} })` );
		const { chat } = await probe( 'state()' );
		const [ first ] = voice;
		// DevTools reports a stream the page reads to its end as canceled, so a
		// whole line is the page's own count: played, and none failed.
		checks.push(
			check( 'the game has its own voice and the engine offers it', greeting?.status === 'ok', greeting ),
			check( 'the first line comes from /api/voice as audio', first?.status === 200 && first.type === 'audio/wav', first ),
			check( 'the first line plays to its end', greeting?.played >= 1, greeting ),
			check( 'audio arrives past the WAV header', greeting?.bytes > 44, { bytes: greeting?.bytes } ),
			check( 'the reply to a chat line plays to its end', Boolean( said.reply ) && reply?.played > greeting?.played, { reply: said.reply, played: reply?.played } ),
			check( 'no line fails', reply?.failed === 0, { failed: reply?.failed, error: reply?.error } )
		);

		return { checks, shots: [ await shot( 'voice' ) ], data: { conversation, greeting, said, reply, lines: chat.lines, requests: voice } };

	},

	async follow( { probe } ) {

		return hook( await probe( 'follow()' ) );

	},

	async lead( { probe } ) {

		return hook( await probe( 'lead()' ) );

	}

};

async function main() {

	const options = parse( process.argv.slice( 2 ) );
	const url = playUrl( options );
	const played = posix.resolve( '/', url.searchParams.get( 'out' ) ?? '' );
	if ( options.talk === 'live' && played.startsWith( '/out/games/' ) && ! options[ 'throwaway-engine' ] ) {

		fail( `--talk live would leave this probe's lines in ${played}'s dialogue memory on the engine serving it; run it against a throwaway engine and pass --throwaway-engine` );

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
	await page.send( 'Emulation.setDeviceMetricsOverride', { ...VIEWPORT, deviceScaleFactor: 1, mobile: false } );
	await page.navigate( url.href );
	report.ready = await playable( page, options.timeout );
	console.log( `playable in ${report.ready.seconds} s: ${report.ready.state.backend} ${report.ready.state.tier}, ${report.ready.state.crowd} people` );

	const context = {
		options, talk: report.talkRequests, voice: report.voiceRequests,
		probe: ( call ) => page.evaluate( `window.urbe.automation.${call}` ),
		shot: async ( name ) => {

			await page.screenshot( join( out, `${name}.png` ) );
			return `${name}.png`;

		}
	};
	let status = 0;
	for ( const name of options.scenarios ) {

		const started = Date.now();
		const result = await SCENARIOS[ name ]( context ).catch( ( error ) => ( { error: error.message } ) );
		const outcome = result.error ? 'error' : result.unsupported ? 'unsupported'
			: result.checks?.length && result.checks.every( ( item ) => item.ok ) ? 'pass' : 'fail';
		if ( outcome !== 'pass' ) status = 1;
		report.scenarios.push( { name, status: outcome, seconds: ( Date.now() - started ) / 1000, ...result } );
		console.log( `${name}: ${outcome}${result.error ? ` (${result.error})` : result.unsupported ? ` (${result.unsupported})` : ''}` );
		for ( const item of result.checks ?? [] ) if ( ! item.ok ) console.log( `  failed: ${item.name} ${JSON.stringify( item.detail ?? {} )}` );

	}

	return status;

}

function parse( argv ) {

	const { values, positionals } = parseArgs( { args: argv, allowPositionals: true, options: {
		out: { type: 'string' }, base: { type: 'string', default: 'http://localhost:5306' },
		browser: { type: 'string' }, backend: { type: 'string', default: 'webgl' },
		talk: { type: 'string', default: 'stub' }, 'throwaway-engine': { type: 'boolean', default: false },
		line: { type: 'string', default: 'Hi. What do you do around here?' },
		crowd: { type: 'string', default: '120' }, timeout: { type: 'string', default: '600' }
	} } );
	const [ target, ...named ] = positionals;
	const scenarios = named.length ? named : [ 'talk', 'chat' ];
	const unknown = scenarios.filter( ( name ) => ! Object.hasOwn( SCENARIOS, name ) );
	const problems = [
		! target && 'name a world id or a play URL',
		unknown.length && `unknown scenario ${unknown.join( ', ' )}; known: ${Object.keys( SCENARIOS ).join( ', ' )}`,
		! [ 'webgpu', 'webgl' ].includes( values.backend ) && '--backend is webgl or webgpu',
		! [ 'stub', 'live' ].includes( values.talk ) && '--talk is stub or live',
		! /^\d+$/.test( values.crowd ) && '--crowd is a whole number',
		! /^\d+$/.test( values.timeout ) && '--timeout is whole seconds'
	].filter( Boolean );
	if ( problems.length ) {

		console.error( `play-probe: ${problems.join( '; ' )}\nusage: node compose/play-probe.mjs <world id | play url> [talk] [chat] [voice] [follow] [lead] [--out dir] [--base url] [--browser path] [--backend webgl|webgpu] [--talk stub|live] [--throwaway-engine] [--line text] [--crowd n] [--timeout seconds]` );
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
		const answer = method === 'POST' ? TALK_STUBS[ path ] : undefined;
		if ( answer ) {

			const entry = { at: at(), path, ...talkRequest( request ) };
			report.talkRequests.push( entry );
			if ( talk === 'live' ) {

				live.set( networkId, entry );
				return page.send( 'Fetch.continueRequest', { requestId } );

			}
			Object.assign( entry, { status: 200, stubbed: true } );
			return page.send( 'Fetch.fulfillRequest', { requestId, responseCode: 200, ...answer } );

		}
		if ( method === 'POST' && speaks && VOICE_PATHS.has( path ) ) {

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

/** A fulfilled response's headers and base64 body. */
function stub( type, body ) {

	return { responseHeaders: [ { name: 'Content-Type', value: type } ], body: Buffer.from( body ).toString( 'base64' ) };

}

/** What one talk request carried: the line, the person and which fields describe them. */
function talkRequest( request ) {

	const text = request.postData ?? ( request.postDataEntries ?? [] ).map( ( entry ) => Buffer.from( entry.bytes ?? '', 'base64' ).toString() ).join( '' );
	try {

		const { line, npc, behavior } = JSON.parse( text );
		return { line, npcId: npc?.npcId ?? null, npcFields: Object.keys( npc ?? {} ).sort(), behavior: behavior?.mode ?? null };

	} catch {

		return { unreadable: text.slice( 0, 200 ) };

	}

}

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
		if ( now?.loaded && ! now.probe && ( loadedAt ??= Date.now() ) < Date.now() - 15000 ) {

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

/** A scenario hook the probe does not drive yet. */
function hook( answer ) {

	return answer?.supported === false ? { unsupported: answer.reason, data: answer } : { data: answer, checks: [] };

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
		this.started = within( this.cdp.send( 'Browser.getVersion' ), 30000 ).then(
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

	async evaluate( expression ) {

		const { result, exceptionDetails } = await this.send( 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true } );
		if ( exceptionDetails ) throw new Error( String( exceptionDetails.exception?.description ?? exceptionDetails.text ).split( '\n' )[ 0 ] );

		return result.value;

	}

	async screenshot( path ) {

		const { data } = await this.send( 'Page.captureScreenshot', { format: 'png' } );
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

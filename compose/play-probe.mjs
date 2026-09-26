/**
 * Plays scripted scenarios in a running game, headless and read-only.
 *
 * `node compose/play-probe.mjs <world id | play url> [scenario ...] [options]`
 *
 * A world id opens `/?mode=game&out=/out/games/<id>` on `--base`. A play URL is
 * used as given, except that a catalog `game=<id>` becomes the same `out`
 * preview: a probed session never saves. The page gets `&automation`, which
 * installs Engine's automation probe, and a street crowd of `--crowd` unless
 * the URL names one. `/api/launcher` is blocked, and the page's Vite socket
 * never opens, so it reports nothing to the dev server.
 *
 * Scenarios: talk and chat (the default), follow, lead.
 * Options:
 *   --out <dir>          screenshots and report.json; default a new folder under the OS temp dir, never inside this checkout
 *   --base <url>         Engine origin for a world id, default http://localhost:5306
 *   --browser <path>     Chromium-family binary; default URBE_BROWSER, then Brave, Chrome or Chromium on PATH
 *   --backend <mode>     webgl (default, at low quality unless the URL names one) or webgpu; headless WebGPU
 *                        offers an adapter but cannot build the city's pipelines
 *   --talk <mode>        stub (default) answers /api/talk in the browser; live lets the line reach the model
 *   --line <text>        the chat scenario's line
 *   --crowd <n>          default 120
 *   --timeout <seconds>  load limit, default 600
 *
 * Exit status: 0 every scenario passed; 1 a check failed, a scenario errored or
 * is not driven yet; 2 the game never became playable.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const CHECKOUT = fileURLToPath( new URL( '..', import.meta.url ) );
const WORLD_ID = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;
const BROWSERS = [ '/opt/brave.com/brave/brave', 'brave-browser', 'google-chrome', 'chromium', 'chromium-browser' ];
const VIEWPORT = { width: 1600, height: 900 };
const FLAGS = [
	'--headless', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
	'--disable-background-networking', '--disable-component-update', '--mute-audio', '--hide-scrollbars',
	'--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan',
	`--window-size=${VIEWPORT.width},${VIEWPORT.height}`, '--remote-debugging-port=0'
];
const STUB_REPLY = 'I only stand in for the model. Nobody asked it.';
/** The look fields the crowd bakes and the focused body is dressed with. */
const LOOK = [ 'body', 'hairStyle', 'skin', 'shirt', 'trousers', 'hair', 'sleeve', 'hem' ];
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

	/** Walks up to the nearest person, then E: the crowd body before and the focused body after. */
	async talk( { probe, shot } ) {

		const people = await probe( 'people()' );
		const shots = new Set();
		let before = null;
		let conversation = null;
		for ( const person of people.slice( 0, 4 ) ) {

			const approached = await probe( `approach(${JSON.stringify( person.id )})` );
			if ( approached.target?.person !== person.id ) continue;
			before = approached.person;
			shots.add( await shot( 'talk-street' ) );
			conversation = await probe( `converse(${JSON.stringify( person.id )})` );
			if ( conversation ) break;

		}
		const checks = [
			check( 'a person is in reach of E', Boolean( before ), { people: people.length } ),
			check( 'E opens a conversation', Boolean( conversation ) )
		];
		if ( ! conversation ) return { checks, shots: [ ...shots ], data: { people } };

		const after = await probe( 'appearance()' );
		await sleep( 800 );
		shots.add( await shot( 'talk-conversation' ) );
		const { feet } = await probe( 'state()' );
		const apart = Math.hypot( ...feet.map( ( value, axis ) => value - before.position[ axis ] ) );
		checks.push(
			check( 'the player stays beside the person', apart < 3, { metres: Math.round( apart * 100 ) / 100 } ),
			check( 'the focused body shows', Boolean( after.hero ) ),
			differs( 'the crowd look holds through E', before.look, after.crowd, [ 'seed', ...LOOK ] ),
			differs( 'the focused body wears the crowd look', after.crowd, after.hero ?? {}, LOOK )
		);

		return { checks, shots: [ ...shots ], data: { before, conversation, after } };

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
	const out = outputDir( options.out );
	const report = {
		started: new Date().toISOString(), target: options.target, talk: options.talk, scenarios: [],
		talkRequests: [], blocked: [], console: []
	};
	let session = null;
	let status = 2;

	// However the run ends, the browser and its profile go with it.
	process.once( 'exit', () => session?.kill() );
	process.once( 'SIGINT', () => process.exit( 130 ) );

	try {

		session = await Browser.launch( options.browser );
		report.browser = session.version;
		report.url = url.href;
		console.log( `probe: ${url.href}` );
		console.log( `output: ${out}` );

		const page = await session.open( options.talk );
		watch( page, report );
		await page.send( 'Page.addScriptToEvaluateOnNewDocument', { source: QUIET_VITE } );
		await page.send( 'Emulation.setDeviceMetricsOverride', { ...VIEWPORT, deviceScaleFactor: 1, mobile: false } );
		await page.navigate( url.href );
		report.ready = await playable( page, options.timeout );
		console.log( `playable in ${report.ready.seconds} s: ${report.ready.state.backend} ${report.ready.state.tier}, ${report.ready.state.crowd} people` );

		const context = {
			options, talk: report.talkRequests,
			probe: ( call ) => page.evaluate( `window.urbe.automation.${call}` ),
			shot: async ( name ) => {

				await page.screenshot( join( out, `${name}.png` ) );
				return `${name}.png`;

			}
		};
		status = 0;
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

	} catch ( error ) {

		report.error = error.message;
		console.error( `probe: ${error.message}` );
		await session?.page?.screenshot( join( out, 'failed.png' ) ).catch( () => {} );

	} finally {

		report.finished = new Date().toISOString();
		writeFileSync( join( out, 'report.json' ), JSON.stringify( report, null, '\t' ) + '\n' );
		await session?.close();

	}
	console.log( `report: ${join( out, 'report.json' )}` );
	process.exit( status );

}

function parse( argv ) {

	const { values, positionals } = parseArgs( { args: argv, allowPositionals: true, options: {
		out: { type: 'string' }, base: { type: 'string', default: 'http://localhost:5306' },
		browser: { type: 'string' }, backend: { type: 'string', default: 'webgl' },
		talk: { type: 'string', default: 'stub' }, line: { type: 'string', default: 'Hi. What do you do around here?' },
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

		console.error( `play-probe: ${problems.join( '; ' )}\nusage: node compose/play-probe.mjs <world id | play url> [talk] [chat] [follow] [lead] [--out dir] [--base url] [--browser path] [--backend webgl|webgpu] [--talk stub|live] [--line text] [--crowd n] [--timeout seconds]` );
		process.exit( 2 );

	}

	return { ...values, target, scenarios, crowd: Number( values.crowd ), timeout: Number( values.timeout ) };

}

/** The read-only preview to open: never a catalog session, always with the probe. */
function playUrl( { target, base, crowd, backend } ) {

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

/** Records blocked launcher calls, talk requests, console warnings, page errors and failed responses into `report`. */
function watch( page, report ) {

	const at = () => ( Date.now() - Date.parse( report.started ) ) / 1000;
	const log = ( entry ) => { if ( report.console.length < 300 ) report.console.push( { at: at(), ...entry } ); };
	page.on( 'Runtime.consoleAPICalled', ( { type, args } ) => {

		if ( [ 'error', 'warning', 'assert' ].includes( type ) ) log( { type, text: args.map( ( arg ) => arg.value ?? arg.description ?? '' ).join( ' ' ).slice( 0, 600 ) } );

	} );
	page.on( 'Runtime.exceptionThrown', ( { exceptionDetails } ) => log( {
		type: 'exception', text: String( exceptionDetails.exception?.description ?? exceptionDetails.text ).slice( 0, 600 )
	} ) );
	page.on( 'Network.responseReceived', ( { response } ) => {

		if ( response.status >= 400 ) log( { type: 'http', text: `${response.status} ${response.url}` } );

	} );
	page.on( 'Fetch.requestPaused', ( { requestId, request, responseStatusCode } ) => {

		const path = new URL( request.url ).pathname;
		if ( path.startsWith( '/api/launcher' ) ) {

			report.blocked.push( { at: at(), request: `${request.method} ${path}` } );
			return page.send( 'Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' } );

		}
		const entry = { at: at(), path, ...talkRequest( request ) };
		report.talkRequests.push( entry );
		if ( responseStatusCode !== undefined ) {

			entry.status = responseStatusCode;
			return page.send( 'Fetch.continueRequest', { requestId } );

		}
		entry.status = 200;
		entry.stubbed = true;
		return page.send( 'Fetch.fulfillRequest', {
			requestId, responseCode: 200,
			responseHeaders: [ { name: 'Content-Type', value: 'application/json' } ],
			body: Buffer.from( JSON.stringify( { reply: STUB_REPLY } ) ).toString( 'base64' )
		} );

	} );

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

/** A check that `actual` repeats `expected` in every field; the detail names each field that differs. */
function differs( name, expected, actual, fields ) {

	const detail = Object.fromEntries( fields.filter( ( field ) => expected[ field ] !== actual[ field ] )
		.map( ( field ) => [ field, { expected: expected[ field ] ?? null, actual: actual[ field ] ?? null } ] ) );

	return check( name, Object.keys( detail ).length === 0, detail );

}

/** A scenario hook the probe does not drive yet. */
function hook( answer ) {

	return answer?.supported === false ? { unsupported: answer.reason, data: answer } : { data: answer, checks: [] };

}

function sleep( milliseconds ) {

	return new Promise( ( done ) => setTimeout( done, milliseconds ) );

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

/** One headless browser process driven over the DevTools protocol, with a throwaway profile. */
class Browser {

	static async launch( requested ) {

		const binary = browserPath( requested );
		const profile = mkdtempSync( join( tmpdir(), 'urbe-play-probe-profile-' ) );
		// Its own process group, so one signal takes every helper process with it.
		const child = spawn( binary, [ ...FLAGS, `--user-data-dir=${profile}`, 'about:blank' ], { detached: true, stdio: [ 'ignore', 'ignore', 'pipe' ] } );
		const browser = new Browser( child, profile );
		const endpoint = await new Promise( ( found, failed ) => {

			let tail = '';
			const timer = setTimeout( () => failed( new Error( `${binary} opened no DevTools endpoint: ${tail}` ) ), 30000 );
			child.once( 'error', failed );
			child.once( 'exit', ( code ) => failed( new Error( `${binary} exited with ${code}: ${tail}` ) ) );
			child.stderr.on( 'data', ( chunk ) => {

				tail = ( tail + chunk ).slice( - 2000 );
				const match = tail.match( /DevTools listening on (ws:\/\/\S+)/ );
				if ( match ) {

					clearTimeout( timer );
					found( match[ 1 ] );

				}

			} );

		} ).catch( ( error ) => {

			browser.kill();
			throw error;

		} );
		browser.cdp = await Cdp.connect( endpoint );
		browser.version = ( await browser.cdp.send( 'Browser.getVersion' ) ).product;

		return browser;

	}

	constructor( child, profile ) {

		this.child = child;
		this.profile = profile;
		this.page = null;

	}

	/** A new tab with its runtime, page and network interception attached; `talk` live lets /api/talk through. */
	async open( talk ) {

		const { targetId } = await this.cdp.send( 'Target.createTarget', { url: 'about:blank' } );
		const { sessionId } = await this.cdp.send( 'Target.attachToTarget', { targetId, flatten: true } );
		const page = this.page = new Page( this.cdp, sessionId );
		await Promise.all( [ 'Runtime.enable', 'Page.enable', 'Network.enable' ].map( ( method ) => page.send( method ) ) );
		await page.send( 'Fetch.enable', { patterns: [
			{ urlPattern: '*/api/launcher*', requestStage: 'Request' },
			{ urlPattern: '*/api/talk*', requestStage: talk === 'live' ? 'Response' : 'Request' }
		] } );

		return page;

	}

	async close() {

		const exited = new Promise( ( done ) => this.child.exitCode === null ? this.child.once( 'exit', done ) : done() );
		await this.cdp?.send( 'Browser.close' ).catch( () => {} );
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

			if ( sessionId === this.sessionId ) Promise.resolve( listener( params ) ).catch( ( error ) => console.error( `${method}: ${error.message}` ) );

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

/** The DevTools protocol over one browser socket, with flat sessions per tab. */
class Cdp {

	static async connect( url ) {

		const socket = new WebSocket( url );
		await new Promise( ( open, failed ) => {

			socket.onopen = open;
			socket.onerror = () => failed( new Error( `no DevTools connection at ${url}` ) );

		} );

		return new Cdp( socket );

	}

	constructor( socket ) {

		this.socket = socket;
		this.next = 0;
		this.calls = new Map();
		this.listeners = new Map();
		socket.onmessage = ( event ) => this.#receive( JSON.parse( event.data ) );
		socket.onclose = () => {

			for ( const { failed, method } of this.calls.values() ) failed( new Error( `${method}: the browser closed` ) );
			this.calls.clear();

		};

	}

	send( method, params = {}, sessionId = undefined ) {

		if ( this.socket.readyState !== WebSocket.OPEN ) return Promise.reject( new Error( `${method}: the browser closed` ) );

		return new Promise( ( done, failed ) => {

			const id = ++ this.next;
			this.calls.set( id, { done, failed, method } );
			this.socket.send( JSON.stringify( { id, method, params, ...( sessionId ? { sessionId } : {} ) } ) );

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

/**
 * Frames of a running game, without a window.
 *
 * `node compose/shoot.mjs <play url> <out dir> <shots.json>` loads the game in
 * a headless browser, waits for the world to be on screen, then walks the
 * camera through the shots and writes one PNG per shot. A shot is
 * `{ name, pos: [x, y, z], yaw, pitch, wait, js }`; every field but the name
 * is optional, and `js` runs in the page before the shot. Add `&backend=webgl&quality=low` to the URL: headless Chromium's
 * WebGPU cannot compile the city's pipelines.
 *
 * Playwright is resolved from here, or from the checkout `URBE_PLAYWRIGHT`
 * names when this one does not carry it.
 */
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';

const require = createRequire( process.env.URBE_PLAYWRIGHT
	? `${process.env.URBE_PLAYWRIGHT}/package.json`
	: import.meta.url );
let chromium;

try {

	( { chromium } = require( 'playwright' ) );

} catch {

	console.error( 'shoot: no playwright here. Install it, or set URBE_PLAYWRIGHT to a checkout that has it.' );
	process.exit( 2 );

}

const [ url, outDir, shotsFile ] = process.argv.slice( 2 );

if ( ! url || ! outDir || ! shotsFile ) {

	console.error( 'usage: node compose/shoot.mjs <play url> <out dir> <shots.json>' );
	process.exit( 2 );

}

const shots = JSON.parse( readFileSync( shotsFile, 'utf8' ) );
mkdirSync( outDir, { recursive: true } );

const browser = await chromium.launch( { headless: true, args: [
	'--ignore-gpu-blocklist', '--no-sandbox', '--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan'
] } );
const page = await browser.newPage( { viewport: { width: 1600, height: 900 } } );
const lines = [];
page.on( 'console', ( m ) => { const t = m.text(); if ( /error|warn|unresolved|E_|not cast|missing|hitch/i.test( t ) ) lines.push( t.slice( 0, 200 ) ); } );
page.on( 'pageerror', ( e ) => lines.push( 'pageerror ' + String( e ).slice( 0, 200 ) ) );

await page.goto( url, { waitUntil: 'load', timeout: 120000 } );
await page.waitForFunction( () => !! window.urbe?.playStartedAt && window.urbe.stats?.drawCalls > 20, null, { timeout: 600000, polling: 1000 } );
await page.evaluate( () => { const g = window.urbe; g.input.onLockChange = () => {}; g.view.setPaused( false ); if ( g.view.pause?.element ) g.view.pause.element.style.display = 'none'; } );
console.log( 'on screen' );

for ( const shot of shots ) {
	await page.evaluate( ( s ) => {
		const g = window.urbe;
		if ( s.pos ) g.body.teleport( { x: s.pos[ 0 ], y: s.pos[ 1 ], z: s.pos[ 2 ] } );
		if ( s.yaw !== undefined ) g.controller.yaw = s.yaw;
		if ( s.pitch !== undefined ) g.controller.pitch = s.pitch;
		g.controller.update( 0 );
	}, shot );

	// A shot may also run its own line first: opening a panel, reading a value.
	if ( shot.js ) {

		const answer = await page.evaluate( shot.js );
		if ( answer !== undefined ) console.log( `${shot.name} js:`, JSON.stringify( answer ).slice( 0, 700 ) );

	}
	await page.waitForTimeout( shot.wait ?? 6000 );
	const info = await page.evaluate( () => {
		const g = window.urbe;
		return {
			pos: g.body.position.toArray().map( ( v ) => + v.toFixed( 1 ) ),
			fps: + ( 1000 / g.stats.frameMs ).toFixed( 0 ), draws: g.stats.drawCalls,
			interiors: g.stream?.floors?.size ?? g.stream?.live ?? null,
			indoors: g.indoors ?? null
		};
	} );
	await page.screenshot( { path: `${outDir}/${shot.name}.png` } );
	console.log( shot.name, JSON.stringify( info ) );
}
if ( lines.length ) console.log( 'console:\n' + lines.slice( - 14 ).join( '\n' ) );
await browser.close();
